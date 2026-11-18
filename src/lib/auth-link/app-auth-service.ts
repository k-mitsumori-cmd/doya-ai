import { decideLink } from './link-decision'
import { isApplePrivateRelay, normalizeEmail } from './email-normalize'
import { verifyIdToken, parseBooleanClaim, type IdTokenProvider, type Jwks, type VerifiedIdentity } from './id-token'
import {
  decideRefresh, isSafeTokenValue, isSessionLive, issueSession, rotateSession, sha256Hex,
  generateOpaqueToken, type RandomBytes,
} from './device-token'
import { JwksUnavailableError } from './jwks'
import {
  generateLinkCode, hashLinkCode, isValidCodeFormat, maskEmail, LINK_MAX_ATTEMPTS, LINK_REQUEST_TTL_MS,
} from './link-code'
import { UniqueViolationError, type AuthRepo, type LinkRequestRecord } from './repo'

/**
 * アプリ用の認証の処理（トークンの交換・更新・ログアウト、結び付けの確認）。DB は repo、時刻・乱数・通信・メール送信は deps で受け取る。
 * 返すのは { status, body }。Next.js の部品（NextResponse など）には依存しない。
 * ログ・エラーにトークン・メール・id_token を出さない（このファイルは console を使わない）。
 * 設計: docs/architecture/2026-11-18-app/account-integrity.md、契約: docs/architecture/2026-11-18-app/api-contract.md
 */

export type ServiceResult = { status: number; body: Record<string, unknown> }

export type SendMail = (p: { to: string; subject: string; html: string }) => Promise<{ success: boolean }>

export type AuthDeps = {
  repo: AuthRepo
  now: () => Date
  randomBytes: RandomBytes
  /** Apple・Google の公開鍵。forceRefresh は、鍵の入れ替わりの疑いのとき */
  getJwks: (provider: IdTokenProvider, opts?: { forceRefresh?: boolean }) => Promise<Jwks>
  /** 許す aud（iOS のクライアント ID など）。空なら、その提供元は未設定として 503 を返す */
  audiences: Record<IdTokenProvider, string[]>
  sendMail: SendMail
  /** 新しいユーザーを作った直後の処理（初回ログインの記録・ドリップのエンロール・通知）。失敗しても交換は成功にする */
  onUserCreated?: (userId: string) => Promise<void>
}

const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ServiceResult => ({ status, body: { code, ...extra } })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
const optStr = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)
const PLATFORMS = new Set(['ios', 'android'])

/** Authorization ヘッダーから Bearer の値を取り出す。形が不正なら null。 */
export function readBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return m && isSafeTokenValue(m[1]) ? m[1] : null
}

async function sessionFromBearer(deps: AuthDeps, authorization: string | null | undefined) {
  const token = readBearer(authorization)
  if (!token) return null
  const session = await deps.repo.findSession(token)
  if (!session || !isSessionLive(session, deps.now())) return null
  return session
}

type TokenUser = { id: string; name: string | null; image: string | null }

async function issueFor(deps: AuthDeps, user: TokenUser, device: { deviceLabel: string | null; platform: string }): Promise<ServiceResult> {
  const now = deps.now()
  const issued = issueSession({ now, randomBytes: deps.randomBytes })
  await deps.repo.createSession({
    userId: user.id,
    sessionToken: issued.accessToken,
    sessionExpires: issued.accessExpiresAt,
    device: { ...issued.device, deviceLabel: device.deviceLabel, platform: device.platform },
  })
  return {
    status: 200,
    body: {
      accessToken: issued.accessToken,
      accessExpiresAt: issued.accessExpiresAt.toISOString(),
      refreshToken: issued.refreshToken,
      refreshExpiresAt: issued.device.expiresAt.toISOString(),
      user: { id: user.id, name: user.name, image: user.image },
    },
  }
}

// ---------------------------------------------------------------------------
// POST /api/app/auth/exchange
// ---------------------------------------------------------------------------
export async function exchangeIdToken(deps: AuthDeps, raw: unknown): Promise<ServiceResult> {
  if (!isObj(raw)) return fail(400, 'INVALID_REQUEST')
  const provider = raw.provider
  const idToken = str(raw.idToken, 8192)
  const nonce = str(raw.nonce, 256)
  const platform = typeof raw.platform === 'string' ? raw.platform : ''
  if ((provider !== 'google' && provider !== 'apple') || !idToken || !nonce || nonce.length < 8 || !PLATFORMS.has(platform)) {
    return fail(400, 'INVALID_REQUEST')
  }
  const deviceLabel = optStr(raw.deviceLabel, 100)
  const audience = deps.audiences[provider]
  if (!audience || audience.length === 0) return fail(503, 'NOT_CONFIGURED')

  // 1. id_token の検証。鍵の入れ替わり（kid が見つからない）のときは、1回だけ鍵を取り直す
  let verified
  try {
    const run = async (forceRefresh: boolean) =>
      verifyIdToken({ token: idToken, provider, jwks: await deps.getJwks(provider, { forceRefresh }), audience, nonce, now: deps.now() })
    verified = await run(false)
    if (!verified.ok && verified.reason === 'no-matching-key') verified = await run(true)
  } catch (e) {
    if (e instanceof JwksUnavailableError) return fail(502, 'JWKS_UNAVAILABLE')
    throw e
  }
  if (!verified.ok) return fail(401, 'ID_TOKEN_INVALID', { reason: verified.reason })
  const identity: VerifiedIdentity = verified.identity

  // 2. 結び付けの決定（Web と同じ関数）
  const existingAccount = await deps.repo.findAccount(identity.provider, identity.sub)
  const matchable = Boolean(identity.email) && identity.emailVerified && !identity.isPrivateEmail
  const userByEmail = !existingAccount && matchable && identity.email ? await deps.repo.findUserByEmail(identity.email) : null
  const decision = decideLink({
    identity: { provider: identity.provider, providerAccountId: identity.sub, email: identity.email, emailVerified: identity.emailVerified },
    existingAccount: existingAccount ? { userId: existingAccount.userId } : null,
    userByEmail: userByEmail ? { userId: userByEmail.id } : null,
    currentUserId: null,
  })

  const device = { deviceLabel, platform }
  switch (decision.action) {
    case 'login-existing': {
      const user = await deps.repo.getUser(decision.userId)
      if (!user || user.deletedAt) return fail(401, 'ACCOUNT_UNAVAILABLE')
      // Apple はメールを初回しか返さない。返ってきたときだけ控えを更新する（null で上書きしない）
      if (identity.email) {
        await deps.repo.touchAccount(identity.provider, identity.sub, { providerEmail: identity.email, emailVerified: identity.emailVerified })
      }
      return issueFor(deps, user, device)
    }
    case 'create-user': {
      const given = optStr(raw.givenName, 50)
      const family = optStr(raw.familyName, 50)
      const name = identity.name ?? ([family, given].filter(Boolean).join(' ') || null)
      const storeEmail = decision.emailPolicy === 'store' || decision.emailPolicy === 'contact-only'
      let created: { id: string }
      try {
        created = await deps.repo.createUserWithAccount({
          // User.email に入れるのは、store と contact-only だけ。照合に使う emailNormalized は store だけ（隠したメールは照合しない）
          email: storeEmail ? identity.email : null,
          emailNormalized: decision.emailPolicy === 'store' ? normalizeEmail(identity.email) : null,
          emailVerified: decision.emailPolicy === 'store' ? deps.now() : null,
          name,
          image: identity.picture ?? null,
          account: { provider: identity.provider, providerAccountId: identity.sub, providerEmail: identity.email, emailVerified: identity.emailVerified },
        })
      } catch (e) {
        // 同時に同じ人が来た。やり直させる（2回目は、できあがった Account で login-existing になる）
        if (e instanceof UniqueViolationError) return fail(409, 'RETRY')
        throw e
      }
      if (deps.onUserCreated) await deps.onUserCreated(created.id).catch(() => {})
      return issueFor(deps, { id: created.id, name, image: identity.picture ?? null }, device)
    }
    case 'require-confirmation': {
      const now = deps.now()
      // 15分のあいだ、同じ組み合わせの待ちは1つだけ。作り直さず、同じ待ちを返す（確認コードの送りすぎを防ぐ）
      let request = await deps.repo.findLiveLinkRequest(identity.provider, identity.sub, decision.targetUserId, now)
      if (!request) {
        const id = generateOpaqueToken(deps.randomBytes)
        await deps.repo.createLinkRequest({
          id, userId: decision.targetUserId, provider: identity.provider, providerAccountId: identity.sub,
          providerEmail: identity.email, expiresAt: new Date(now.getTime() + LINK_REQUEST_TTL_MS),
        })
        request = { id } as LinkRequestRecord
      }
      const target = await deps.repo.getUser(decision.targetUserId)
      return fail(409, 'LINK_CONFIRMATION_REQUIRED', {
        requestId: request.id,
        methods: [...decision.methods],
        emailHint: maskEmail(target?.email),
      })
    }
    case 'link-to-current':
    case 'reject':
    default:
      return fail(400, 'INVALID_REQUEST')
  }
}

// ---------------------------------------------------------------------------
// POST /api/app/auth/refresh
// ---------------------------------------------------------------------------
export async function refreshSession(deps: AuthDeps, raw: unknown): Promise<ServiceResult> {
  if (!isObj(raw) || typeof raw.refreshToken !== 'string') return fail(400, 'INVALID_REQUEST')
  const token = raw.refreshToken
  if (!isSafeTokenValue(token)) return fail(401, 'REFRESH_TOKEN_INVALID', { reason: 'malformed' })
  const now = deps.now()
  const row = await deps.repo.findDeviceByHash(sha256Hex(token))
  const decision = decideRefresh({ token, row, now, options: { reuseLeewayMs: 10_000 } })
  switch (decision.action) {
    case 'reject':
      if (decision.reason === 'retry-conflict') return fail(409, 'REFRESH_RETRY_CONFLICT')
      return fail(401, 'REFRESH_TOKEN_INVALID', { reason: decision.reason })
    case 'revoke-family':
      // 古いトークンの再利用。その端末の系統を全部失効させ、Session の行も消す
      await deps.repo.revokeFamily(decision.familyId, decision.revokedAt)
      return fail(401, 'REFRESH_TOKEN_INVALID', { reason: 'reused' })
    case 'rotate': {
      const user = row ? await deps.repo.getUser(row.userId) : null
      if (!row || !user || user.deletedAt) {
        if (row) await deps.repo.revokeFamily(row.familyId, now)
        return fail(401, 'REFRESH_TOKEN_INVALID', { reason: 'revoked' })
      }
      const next = rotateSession({ familyId: decision.familyId, now, randomBytes: deps.randomBytes })
      const won = await deps.repo.rotateDevice({
        old: row, rotatedAt: decision.rotatedAt, userId: row.userId,
        sessionToken: next.accessToken, sessionExpires: next.accessExpiresAt,
        device: { ...next.device, deviceLabel: row.deviceLabel, platform: row.platform },
      })
      // 同時に来た別の更新に先を越された。新しいトークンは出さず、やり直させる
      if (!won) return fail(409, 'REFRESH_RETRY_CONFLICT')
      return {
        status: 200,
        body: {
          accessToken: next.accessToken,
          accessExpiresAt: next.accessExpiresAt.toISOString(),
          refreshToken: next.refreshToken,
          refreshExpiresAt: next.device.expiresAt.toISOString(),
          user: { id: user.id, name: user.name, image: user.image },
        },
      }
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/app/auth/logout、GET /api/app/auth/me
// ---------------------------------------------------------------------------
export async function logout(deps: AuthDeps, authorization: string | null | undefined): Promise<ServiceResult> {
  const session = await sessionFromBearer(deps, authorization)
  if (!session) return fail(401, 'INVALID_TOKEN')
  await deps.repo.revokeBySessionId(session.id, deps.now())
  return { status: 200, body: { ok: true } }
}

export async function me(deps: AuthDeps, authorization: string | null | undefined): Promise<ServiceResult> {
  const session = await sessionFromBearer(deps, authorization)
  if (!session) return fail(401, 'INVALID_TOKEN')
  const user = await deps.repo.getUser(session.userId)
  if (!user || user.deletedAt) return fail(401, 'INVALID_TOKEN')
  return {
    status: 200,
    body: { id: user.id, name: user.name, image: user.image, plan: user.plan, hasCompany: await deps.repo.hasCompany(user.id) },
  }
}

// ---------------------------------------------------------------------------
// 結び付けの確認（link/send-code、link/confirm）
// ---------------------------------------------------------------------------
async function liveRequest(deps: AuthDeps, requestId: unknown): Promise<{ request: LinkRequestRecord } | { error: ServiceResult }> {
  if (typeof requestId !== 'string' || !isSafeTokenValue(requestId)) return { error: fail(400, 'INVALID_REQUEST') }
  const request = await deps.repo.getLinkRequest(requestId)
  if (!request || request.consumedAt || request.expiresAt.getTime() <= deps.now().getTime() || !request.userId) {
    return { error: fail(410, 'LINK_REQUEST_EXPIRED') }
  }
  return { request }
}

function mailBody(lines: string[]): string {
  return `<div style="font-family:sans-serif;line-height:1.8;color:#111">${lines.map((l) => `<p>${l}</p>`).join('')}</div>`
}

/** 確認コードを、つなぐ先の既存ユーザーのメールへ送る。1つの待ちにつき1回だけ。 */
export async function sendLinkCode(deps: AuthDeps, raw: unknown): Promise<ServiceResult> {
  if (!isObj(raw)) return fail(400, 'INVALID_REQUEST')
  const r = await liveRequest(deps, raw.requestId)
  if ('error' in r) return r.error
  const { request } = r
  if (request.codeHash) return fail(409, 'CODE_ALREADY_SENT')
  const target = request.userId ? await deps.repo.getUser(request.userId) : null
  if (!target || target.deletedAt || !target.email || !target.email.includes('@')) return fail(422, 'NO_EMAIL')

  const code = generateLinkCode(deps.randomBytes)
  await deps.repo.setLinkCode(request.id, hashLinkCode(request.id, code))
  const sent = await deps.sendMail({
    to: target.email,
    subject: '【ドヤバディ】ログイン方法を追加するための確認コード',
    html: mailBody([
      'ドヤバディをご利用いただき、ありがとうございます。',
      '新しいログイン方法を、このアカウントに追加する操作がありました。次の確認コードをアプリに入力してください。',
      `確認コード: <strong style="font-size:20px;letter-spacing:4px">${code}</strong>`,
      '確認コードの有効期限は15分です。',
      'お心当たりがない場合は、このメールを破棄してください。確認コードを入力しなければ、ログイン方法は追加されません。',
    ]),
  }).catch(() => ({ success: false }))
  if (!sent.success) {
    // 送れなかったので、再び送れるようにコードを取り消す
    await deps.repo.setLinkCode(request.id, null)
    return fail(502, 'EMAIL_SEND_FAILED')
  }
  return { status: 200, body: { sent: true, emailHint: maskEmail(target.email) } }
}

async function notifyLinked(deps: AuthDeps, userId: string, provider: string) {
  const user = await deps.repo.getUser(userId)
  if (!user?.email) return
  const label = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : provider
  await deps
    .sendMail({
      to: user.email,
      subject: '【ドヤバディ】新しいログイン方法を追加しました',
      html: mailBody([
        'ドヤバディをご利用いただき、ありがとうございます。',
        `アカウントに、新しいログイン方法（${label}）を追加しました。`,
        'お心当たりがない場合は、お手数ですが、ドヤバディのお問い合わせ窓口までご連絡ください。',
      ]),
    })
    .catch(() => {})
}

/**
 * 結び付けの確認。2つの方法。
 *  - コード: { requestId, code, platform, deviceLabel? }。ログインしていない状態から、コードで確かめる。成功したらログインのトークンを返す。
 *  - 前のログイン手段: Authorization: Bearer 付きで { requestId }。すでに既存のユーザーとしてログインしていて、待ちのつなぎ先が同じユーザーのときだけ。
 */
export async function confirmLink(deps: AuthDeps, args: { authorization?: string | null; body: unknown }): Promise<ServiceResult> {
  const raw = args.body
  if (!isObj(raw)) return fail(400, 'INVALID_REQUEST')
  const r = await liveRequest(deps, raw.requestId)
  if ('error' in r) return r.error
  const { request } = r
  const targetUserId = request.userId as string
  const account = { provider: request.provider, providerAccountId: request.providerAccountId, providerEmail: request.providerEmail, emailVerified: true }
  const now = deps.now()

  const link = async (): Promise<ServiceResult | null> => {
    // ログイン手段が、いつの間にかほかのユーザーに付いていないか
    const taken = await deps.repo.findAccount(account.provider, account.providerAccountId)
    if (taken && taken.userId !== targetUserId) return fail(409, 'IDENTITY_TAKEN')
    if (!(await deps.repo.consumeLinkRequest(request.id, now))) return fail(409, 'LINK_REQUEST_USED')
    if (!taken) await deps.repo.addAccount(targetUserId, account)
    return null
  }

  if (args.authorization) {
    // 前のログイン手段でのログイン済みの場合
    const session = await sessionFromBearer(deps, args.authorization)
    if (!session) return fail(401, 'INVALID_TOKEN')
    if (session.userId !== targetUserId) return fail(403, 'LINK_TARGET_MISMATCH')
    const err = await link()
    if (err) return err
    await notifyLinked(deps, targetUserId, account.provider)
    return { status: 200, body: { linked: true } }
  }

  // コード
  if (!isValidCodeFormat(raw.code)) return fail(400, 'INVALID_REQUEST')
  const platform = typeof raw.platform === 'string' ? raw.platform : ''
  if (!PLATFORMS.has(platform)) return fail(400, 'INVALID_REQUEST')
  if (!request.codeHash) return fail(409, 'CODE_NOT_SENT')
  if (request.attempts >= LINK_MAX_ATTEMPTS) return fail(429, 'LINK_TOO_MANY_ATTEMPTS')
  if (hashLinkCode(request.id, raw.code) !== request.codeHash) {
    const attempts = await deps.repo.incrementLinkAttempts(request.id)
    if (attempts >= LINK_MAX_ATTEMPTS) return fail(429, 'LINK_TOO_MANY_ATTEMPTS')
    return fail(400, 'LINK_CODE_INVALID', { remainingAttempts: LINK_MAX_ATTEMPTS - attempts })
  }
  const target = await deps.repo.getUser(targetUserId)
  if (!target || target.deletedAt) return fail(410, 'LINK_REQUEST_EXPIRED')
  const err = await link()
  if (err) return err
  await notifyLinked(deps, targetUserId, account.provider)
  return issueFor(deps, target, { deviceLabel: optStr(raw.deviceLabel, 100), platform })
}

// ---------------------------------------------------------------------------
// Web（NextAuth）の signIn コールバック用。Apple のときだけ使う。
// ---------------------------------------------------------------------------
/**
 * 戻り値: true なら NextAuth が続きを処理する。文字列なら、その URL へ移動させる。
 * 同じメールの既存ユーザーがいるときは、自動では結び付けず /auth/signin?error=LinkConfirmationRequired へ移動する
 * （確認の画面は次の段。いまは、Web でその人が入れない代わりに、別のユーザーを作らない）。
 */
export async function decideWebSignIn(
  repo: Pick<AuthRepo, 'findAccount' | 'findUserByEmail'>,
  input: { provider: string; providerAccountId: string; profile: { email?: unknown; email_verified?: unknown } | null | undefined },
): Promise<true | string> {
  const email = normalizeEmail(input.profile?.email)
  const verified = parseBooleanClaim(input.profile?.email_verified) === true
  const existingAccount = await repo.findAccount(input.provider, input.providerAccountId)
  const matchable = Boolean(email) && verified && !isApplePrivateRelay(email)
  const userByEmail = !existingAccount && matchable && email ? await repo.findUserByEmail(email) : null
  const d = decideLink({
    identity: { provider: input.provider, providerAccountId: input.providerAccountId, email: email, emailVerified: verified },
    existingAccount,
    userByEmail: userByEmail ? { userId: userByEmail.id } : null,
    currentUserId: null,
  })
  if (d.action === 'require-confirmation') return '/auth/signin?error=LinkConfirmationRequired'
  if (d.action === 'reject') return '/auth/signin?error=AccessDenied'
  return true
}
