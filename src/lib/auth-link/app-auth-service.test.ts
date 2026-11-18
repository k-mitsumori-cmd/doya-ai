import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import jwt from 'jsonwebtoken'
import {
  confirmLink, decideWebSignIn, exchangeIdToken, logout, me, refreshSession, sendLinkCode, readBearer, type AuthDeps,
} from './app-auth-service'
import { MemoryRepo } from './testing/memory-repo'
import { JwksUnavailableError } from './jwks'
import { hashLinkCode, LINK_MAX_ATTEMPTS, LINK_REQUEST_TTL_MS } from './link-code'
import { sha256Hex, REFRESH_TOKEN_TTL_MS } from './device-token'
import type { Jwks } from './id-token'

// 試験用に作った鍵だけを使う。本物の Apple・Google・DB・メールには触れない。
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const jwks: Jwks = { keys: [jwk as any] }
const AUD_G = 'google-ios-client'
const AUD_A = 'jp.example.doya'
let clock = new Date('2026-11-18T03:00:00Z')
const nowSec = () => Math.floor(clock.getTime() / 1000)
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

function makeDeps(over: Partial<AuthDeps> = {}) {
  const repo = new MemoryRepo()
  const mails: Array<{ to: string; subject: string; html: string }> = []
  const created: string[] = []
  let n = 1
  const deps: AuthDeps = {
    repo,
    now: () => clock,
    // 呼ぶたびに別の値を返す（連番から作る。本物の乱数は使わない）
    randomBytes: (size) => { const k = n++; return Uint8Array.from({ length: size }, (_, i) => (k * 37 + i * 11 + (k >> 3)) & 0xff) },
    getJwks: async () => jwks,
    audiences: { google: [AUD_G], apple: [AUD_A] },
    sendMail: async (m) => { mails.push(m); return { success: true } },
    onUserCreated: async (id) => { created.push(id) },
    ...over,
  }
  return { deps, repo, mails, created }
}

let jtiSeq = 0 // 呼ぶたびに別のトークンにする（同じトークンの2回の使用は、別の試験で確かめる）
const sign = (claims: Record<string, unknown>) => jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: 'k1', noTimestamp: true })
const NONCE = 'nonce-abcdefgh'
const google = (over: Record<string, unknown> = {}) => sign({ iss: 'https://accounts.google.com', aud: AUD_G, sub: 'g-1', exp: nowSec() + 600, nonce: NONCE, email: 'Taro@Example.com', email_verified: true, name: 'Taro', jti: `j${++jtiSeq}`, ...over })
const apple = (over: Record<string, unknown> = {}) => sign({ iss: 'https://appleid.apple.com', aud: AUD_A, sub: 'a-1', exp: nowSec() + 600, nonce: sha(NONCE), email: 'taro@example.com', email_verified: 'true', is_private_email: 'false', jti: `j${++jtiSeq}`, ...over })
const body = (provider: 'google' | 'apple', idToken: string, extra: Record<string, unknown> = {}) => ({ provider, idToken, nonce: NONCE, platform: 'ios', deviceLabel: 'iPhone', ...extra })

test('Google で初めてログイン: User と Account が1つずつでき、トークンが返る。メールは返さない', async () => {
  const { deps, repo, created } = makeDeps()
  const r = await exchangeIdToken(deps, body('google', google()))
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.body).sort(), ['accessExpiresAt', 'accessToken', 'refreshExpiresAt', 'refreshToken', 'user'])
  assert.equal(JSON.stringify(r.body).includes('example.com'), false)
  assert.equal(repo.users.size, 1)
  const u = [...repo.users.values()][0]
  assert.equal(u.email, 'taro@example.com')
  assert.equal(u.emailNormalized, 'taro@example.com')
  assert.equal(u.name, 'Taro')
  assert.deepEqual(repo.accounts.map((a) => [a.provider, a.providerAccountId, a.emailVerified]), [['google', 'g-1', true]])
  assert.deepEqual(created, [u.id])
  // Session の期限は1時間、AppDevice には sha256 だけが入る
  assert.equal(repo.sessions[0].expires.getTime() - clock.getTime(), 3600_000)
  assert.equal(repo.devices[0].refreshTokenHash, sha256Hex(r.body.refreshToken as string))
  assert.equal(JSON.stringify(repo.devices).includes(r.body.refreshToken as string), false)
})

test('同じ (provider, sub) で2回ログインしても、同じ User で、ユーザーは増えない', async () => {
  const { deps, repo, created } = makeDeps()
  const a = await exchangeIdToken(deps, body('google', google()))
  const b = await exchangeIdToken(deps, body('google', google()))
  assert.equal((a.body.user as any).id, (b.body.user as any).id)
  assert.equal(repo.users.size, 1)
  assert.equal(created.length, 1)
  assert.equal(repo.devices.length, 2)
})

test('Google のユーザーがいるとき、同じメールを確認済みで返す Apple は require-confirmation。別のユーザーも Session もできない', async () => {
  const { deps, repo } = makeDeps()
  await exchangeIdToken(deps, body('google', google()))
  const before = { users: repo.users.size, sessions: repo.sessions.length, devices: repo.devices.length }
  const r = await exchangeIdToken(deps, body('apple', apple()))
  assert.equal(r.status, 409)
  assert.equal(r.body.code, 'LINK_CONFIRMATION_REQUIRED')
  assert.equal(typeof r.body.requestId, 'string')
  assert.deepEqual(r.body.methods, ['previous-login', 'email-code'])
  assert.equal(r.body.emailHint, 't***@example.com')
  assert.deepEqual({ users: repo.users.size, sessions: repo.sessions.length, devices: repo.devices.length }, before)
  assert.equal(repo.accounts.length, 1)
  // 同じ人がもう一度試しても、待ちは作り直さない
  const again = await exchangeIdToken(deps, body('apple', apple()))
  assert.equal(again.body.requestId, r.body.requestId)
  assert.equal(repo.links.size, 1)
})

test('大文字・空白だけ違うメールは同じユーザーとして照合される（Apple の email が TARO@Example.com でも確認の手順になる）', async () => {
  const { deps } = makeDeps()
  await exchangeIdToken(deps, body('google', google()))
  const r = await exchangeIdToken(deps, body('apple', apple({ email: '  TARO@Example.COM ' })))
  assert.equal(r.body.code, 'LINK_CONFIRMATION_REQUIRED')
})

test('Gmail のドットだけ違うメールは、自動では同じユーザーにしない（別のユーザーができる）', async () => {
  const { deps, repo } = makeDeps()
  await exchangeIdToken(deps, body('google', google({ email: 'a.b@gmail.com' })))
  const r = await exchangeIdToken(deps, body('apple', apple({ email: 'ab@gmail.com' })))
  assert.equal(r.status, 200)
  assert.equal(repo.users.size, 2)
})

test('Apple の隠しメール: 新規1人だけ。既存ユーザーには結び付かない。2回めのログインでも増えない。照合用の列は空', async () => {
  const { deps, repo } = makeDeps()
  await exchangeIdToken(deps, body('google', google()))
  const relay = () => apple({ sub: 'a-relay', email: 'xyz@privaterelay.appleid.com', is_private_email: 'true' })
  const r1 = await exchangeIdToken(deps, body('apple', relay(), { givenName: '太郎', familyName: '山田' }))
  const r2 = await exchangeIdToken(deps, body('apple', relay()))
  assert.equal(r1.status, 200)
  assert.equal((r1.body.user as any).id, (r2.body.user as any).id)
  assert.equal(repo.users.size, 2)
  const u = repo.users.get((r1.body.user as any).id)!
  assert.equal(u.email, 'xyz@privaterelay.appleid.com')
  assert.equal(u.emailNormalized, null)
  assert.equal(u.name, '山田 太郎')
})

test('Apple の2回め以降（メール無し）のログインは、Account で login-existing。メールを null で上書きしない', async () => {
  const { deps, repo } = makeDeps()
  const first = await exchangeIdToken(deps, body('apple', apple({ sub: 'a-9', email: 'x@example.com' })))
  const noMail = apple({ sub: 'a-9' }) as string
  const claims: any = jwt.decode(noMail); delete claims.email; delete claims.email_verified; delete claims.is_private_email
  const second = await exchangeIdToken(deps, body('apple', sign(claims)))
  assert.equal((first.body.user as any).id, (second.body.user as any).id)
  assert.equal(repo.accounts[0].providerEmail, 'x@example.com')
})

test('未確認のメールの Google は、既存ユーザーと照合せず、メールを入れない別のユーザーになる', async () => {
  const { deps, repo } = makeDeps()
  await exchangeIdToken(deps, body('google', google()))
  const r = await exchangeIdToken(deps, body('google', google({ sub: 'g-2', email_verified: false })))
  assert.equal(r.status, 200)
  assert.equal(repo.users.size, 2)
  assert.equal(repo.users.get((r.body.user as any).id)!.email, null)
})

test('id_token が不正: 署名・aud・nonce・期限・提供元の不一致は 401。入力が不正なら 400。鍵の取得に失敗なら 502。未設定なら 503', async () => {
  const { deps, repo } = makeDeps()
  const cases: Array<[string, unknown, number, string]> = [
    ['aud', body('google', google({ aud: 'other' })), 401, 'ID_TOKEN_INVALID'],
    ['nonce', { ...body('google', google()), nonce: 'wrong-nonce-xyz' }, 401, 'ID_TOKEN_INVALID'],
    ['exp', body('google', google({ exp: nowSec() - 3600 })), 401, 'ID_TOKEN_INVALID'],
    ['provider', body('apple', google()), 401, 'ID_TOKEN_INVALID'],
    ['not object', null, 400, 'INVALID_REQUEST'],
    ['bad provider', { ...body('google', google()), provider: 'facebook' }, 400, 'INVALID_REQUEST'],
    ['bad platform', { ...body('google', google()), platform: 'web' }, 400, 'INVALID_REQUEST'],
    ['short nonce', { ...body('google', google()), nonce: 'abc' }, 400, 'INVALID_REQUEST'],
    ['no token', { provider: 'google', nonce: NONCE, platform: 'ios' }, 400, 'INVALID_REQUEST'],
  ]
  for (const [name, b, status, code] of cases) {
    const r = await exchangeIdToken(deps, b)
    assert.equal(r.status, status, name)
    assert.equal(r.body.code, code, name)
  }
  assert.equal(repo.users.size, 0)
  const down = makeDeps({ getJwks: async () => { throw new JwksUnavailableError() } })
  assert.equal((await exchangeIdToken(down.deps, body('google', google()))).status, 502)
  const none = makeDeps({ audiences: { google: [], apple: [] } })
  assert.equal((await exchangeIdToken(none.deps, body('google', google()))).status, 503)
})

test('鍵の入れ替わり: kid が見つからなければ、鍵を1回だけ取り直す', async () => {
  const calls: boolean[] = []
  const { deps } = makeDeps({
    getJwks: async (_p, o) => { calls.push(Boolean(o?.forceRefresh)); return o?.forceRefresh ? jwks : { keys: [] as any } },
  })
  const r = await exchangeIdToken(deps, body('google', google()))
  assert.equal(r.status, 200)
  assert.deepEqual(calls, [false, true])
})

test('エラーの応答にトークン・メール・id_token を含めない', async () => {
  const { deps } = makeDeps()
  const tok = google({ aud: 'other' })
  const r = await exchangeIdToken(deps, body('google', tok))
  const text = JSON.stringify(r)
  assert.equal(text.includes(tok), false)
  assert.equal(text.includes('example.com'), false)
})

// ---- 更新・再利用・ログアウト ----
test('更新: 新しいトークンが出て、古い Session は消え、古いリフレッシュトークンの再利用で系統が全部止まる', async () => {
  const { deps, repo } = makeDeps()
  const login = await exchangeIdToken(deps, body('google', google()))
  const rt0 = login.body.refreshToken as string
  clock = new Date(clock.getTime() + 3600_000 * 2)
  const r1 = await refreshSession(deps, { refreshToken: rt0 })
  assert.equal(r1.status, 200)
  assert.notEqual(r1.body.refreshToken, rt0)
  assert.equal(repo.sessions.length, 1)
  assert.equal(repo.sessions[0].sessionToken, r1.body.accessToken)
  // 新しいトークンでさらに更新
  clock = new Date(clock.getTime() + 3600_000)
  const r2 = await refreshSession(deps, { refreshToken: r1.body.refreshToken })
  assert.equal(r2.status, 200)
  // 古い rt0 を、猶予（10秒）より後に再利用 → 系統の全部を失効
  clock = new Date(clock.getTime() + 60_000)
  const reuse = await refreshSession(deps, { refreshToken: rt0 })
  assert.equal(reuse.status, 401)
  assert.deepEqual(reuse.body, { code: 'REFRESH_TOKEN_INVALID', reason: 'reused' })
  assert.equal(repo.sessions.length, 0)
  assert.ok(repo.devices.every((d) => d.revokedAt))
  // 最新のリフレッシュトークンも使えなくなっている
  const after = await refreshSession(deps, { refreshToken: r2.body.refreshToken })
  assert.equal(after.status, 401)
  assert.equal(after.body.reason, 'revoked')
})

test('更新: 猶予（10秒）の中の再送は 409 で、系統は止めない', async () => {
  const { deps, repo } = makeDeps()
  const login = await exchangeIdToken(deps, body('google', google()))
  const rt0 = login.body.refreshToken as string
  await refreshSession(deps, { refreshToken: rt0 })
  clock = new Date(clock.getTime() + 5000)
  const again = await refreshSession(deps, { refreshToken: rt0 })
  assert.equal(again.status, 409)
  assert.equal(again.body.code, 'REFRESH_RETRY_CONFLICT')
  assert.ok(repo.devices.some((d) => !d.revokedAt))
})

test('更新: 期限切れ・知らないトークン・形が不正なトークンは 401。本文が不正なら 400', async () => {
  const { deps } = makeDeps()
  const login = await exchangeIdToken(deps, body('google', google()))
  const rt = login.body.refreshToken as string
  assert.equal((await refreshSession(deps, { refreshToken: 'z'.repeat(43) })).body.reason, 'unknown')
  assert.equal((await refreshSession(deps, { refreshToken: 'bad;token' })).body.reason, 'malformed')
  assert.equal((await refreshSession(deps, {})).status, 400)
  clock = new Date(clock.getTime() + REFRESH_TOKEN_TTL_MS + 1000)
  assert.deepEqual((await refreshSession(deps, { refreshToken: rt })).body, { code: 'REFRESH_TOKEN_INVALID', reason: 'expired' })
})

test('ログアウト: Session と端末の系統が失効し、そのあとの更新・me は 401。Bearer が不正なら 401', async () => {
  const { deps, repo } = makeDeps()
  const login = await exchangeIdToken(deps, body('google', google()))
  const at = login.body.accessToken as string
  assert.equal((await me(deps, `Bearer ${at}`)).status, 200)
  assert.equal((await logout(deps, 'Bearer short')).status, 401)
  assert.equal((await logout(deps, undefined)).status, 401)
  assert.equal((await logout(deps, `Bearer ${at}`)).status, 200)
  assert.equal(repo.sessions.length, 0)
  assert.equal((await me(deps, `Bearer ${at}`)).status, 401)
  assert.equal((await refreshSession(deps, { refreshToken: login.body.refreshToken })).body.reason, 'revoked')
})

test('me: 最小の情報だけ（id・name・image・plan・hasCompany）。メールは返さない。期限切れの Session は 401', async () => {
  const { deps, repo } = makeDeps()
  const login = await exchangeIdToken(deps, body('google', google()))
  const uid = (login.body.user as any).id
  repo.companies.add(uid)
  const r = await me(deps, `Bearer ${login.body.accessToken}`)
  assert.deepEqual(Object.keys(r.body).sort(), ['hasCompany', 'id', 'image', 'name', 'plan'])
  assert.equal(r.body.hasCompany, true)
  clock = new Date(clock.getTime() + 3600_001)
  assert.equal((await me(deps, `Bearer ${login.body.accessToken}`)).status, 401)
})

test('readBearer: 形が不正な値は null', () => {
  assert.equal(readBearer(`Bearer ${'a'.repeat(30)}`), 'a'.repeat(30))
  for (const v of [undefined, null, '', 'Bearer', 'Bearer x', `Bearer ${'a'.repeat(20)};b`, 'Basic abc']) assert.equal(readBearer(v as any), null)
})

// ---- 結び付けの確認 ----
async function pending() {
  const ctx = makeDeps()
  await exchangeIdToken(ctx.deps, body('google', google()))
  const r = await exchangeIdToken(ctx.deps, body('apple', apple()))
  return { ...ctx, requestId: r.body.requestId as string }
}
const lastCode = (mails: Array<{ html: string }>) => /(\d{6})<\/strong>/.exec(mails[mails.length - 1].html)![1]

test('コードでの確認: コードが既存ユーザーのメールに送られ、入力すると Account が足されてログインできる。ユーザーは増えない', async () => {
  const { deps, repo, mails, requestId } = await pending()
  const s = await sendLinkCode(deps, { requestId })
  assert.deepEqual(s, { status: 200, body: { sent: true, emailHint: 't***@example.com' } })
  assert.equal(mails[0].to, 'taro@example.com')
  assert.match(mails[0].html, /確認コード/)
  assert.equal(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(mails[0].subject + mails[0].html), false)
  assert.notEqual(repo.links.get(requestId)!.codeHash, lastCode(mails))
  const c = await confirmLink(deps, { body: { requestId, code: lastCode(mails), platform: 'ios', deviceLabel: 'iPhone' } })
  assert.equal(c.status, 200)
  assert.ok(c.body.accessToken && c.body.refreshToken)
  assert.equal(repo.users.size, 1)
  assert.deepEqual(repo.accounts.map((a) => a.provider).sort(), ['apple', 'google'])
  assert.equal(new Set(repo.accounts.map((a) => a.userId)).size, 1)
  assert.equal(mails.length, 2) // 追加したことのお知らせ
  assert.match(mails[1].subject, /追加しました/)
  // そのあと Apple でログインすると、同じユーザー
  const again = await exchangeIdToken(deps, body('apple', apple()))
  assert.equal((again.body.user as any).id, (c.body.user as any).id)
  assert.equal(repo.users.size, 1)
  // 使用済みの待ちは使えない
  assert.equal((await confirmLink(deps, { body: { requestId, code: lastCode(mails.slice(0, 1)), platform: 'ios' } })).status, 410)
})

test('コード: 5回まち違えると使えなくなる（正しいコードでも）。残り回数を返す', async () => {
  const { deps, mails, requestId } = await pending()
  await sendLinkCode(deps, { requestId })
  const right = lastCode(mails)
  const wrong = right === '000000' ? '111111' : '000000'
  // 5回めまでは照合され、まち違えるたびに残りが減る（5回めは残り0）。6回めからは、正しいコードでも 429
  for (let i = 1; i <= LINK_MAX_ATTEMPTS; i++) {
    const r = await confirmLink(deps, { body: { requestId, code: wrong, platform: 'ios' } })
    assert.deepEqual([r.status, r.body.code, r.body.remainingAttempts], [400, 'LINK_CODE_INVALID', LINK_MAX_ATTEMPTS - i])
  }
  assert.equal((await confirmLink(deps, { body: { requestId, code: wrong, platform: 'ios' } })).status, 429)
  assert.equal((await confirmLink(deps, { body: { requestId, code: right, platform: 'ios' } })).status, 429)
})

test('コード: 15分を過ぎた待ちは使えない（送信も確認も 410）', async () => {
  const { deps, mails, requestId } = await pending()
  await sendLinkCode(deps, { requestId })
  clock = new Date(clock.getTime() + LINK_REQUEST_TTL_MS)
  assert.equal((await confirmLink(deps, { body: { requestId, code: lastCode(mails), platform: 'ios' } })).status, 410)
  assert.equal((await sendLinkCode(deps, { requestId })).status, 410)
})

test('コード: 形が不正・送っていない待ち・1つの待ちに2回送る・知らない ID は、それぞれ拒む', async () => {
  const { deps, requestId } = await pending()
  assert.equal((await confirmLink(deps, { body: { requestId, code: '12345', platform: 'ios' } })).status, 400)
  assert.equal((await confirmLink(deps, { body: { requestId, code: '123456', platform: 'ios' } })).body.code, 'CODE_NOT_SENT')
  await sendLinkCode(deps, { requestId })
  assert.equal((await sendLinkCode(deps, { requestId })).body.code, 'CODE_ALREADY_SENT')
  assert.equal((await sendLinkCode(deps, { requestId: 'q'.repeat(43) })).status, 410)
  assert.equal((await sendLinkCode(deps, { requestId: 'bad id' })).status, 400)
})

test('メールの送信に失敗したら 502 で、コードは取り消されて再び送れる', async () => {
  const ctx = await pending()
  let ok = false
  const deps2 = { ...ctx.deps, sendMail: async () => ({ success: ok }) }
  assert.equal((await sendLinkCode(deps2, { requestId: ctx.requestId })).status, 502)
  assert.equal(ctx.repo.links.get(ctx.requestId)!.codeHash, null)
  ok = true
  assert.equal((await sendLinkCode(deps2, { requestId: ctx.requestId })).status, 200)
})

test('前のログイン手段での確認: 既存ユーザーとしてログインした Bearer で { requestId } を送ると Account が足される。別のユーザーの Bearer は 403', async () => {
  const { deps, repo, requestId } = await pending()
  const owner = [...repo.users.values()][0]
  const login = await exchangeIdToken(deps, body('google', google()))
  const c = await confirmLink(deps, { authorization: `Bearer ${login.body.accessToken}`, body: { requestId } })
  assert.deepEqual(c, { status: 200, body: { linked: true } })
  assert.deepEqual(repo.accounts.filter((a) => a.userId === owner.id).map((a) => a.provider).sort(), ['apple', 'google'])
  // 別のユーザー
  const ctx2 = await pending()
  const other = await exchangeIdToken(ctx2.deps, body('google', google({ sub: 'g-other', email: 'other@example.com' })))
  const denied = await confirmLink(ctx2.deps, { authorization: `Bearer ${other.body.accessToken}`, body: { requestId: ctx2.requestId } })
  assert.equal(denied.status, 403)
  assert.equal(ctx2.repo.accounts.filter((a) => a.provider === 'apple').length, 0)
  // Bearer が不正
  assert.equal((await confirmLink(ctx2.deps, { authorization: 'Bearer nope', body: { requestId: ctx2.requestId } })).status, 401)
})

test('確認の途中で、同じログイン手段がほかのユーザーに付いたら 409', async () => {
  const { deps, repo, mails, requestId } = await pending()
  await sendLinkCode(deps, { requestId })
  const stranger = repo.addUser({ id: 'stranger' })
  repo.accounts.push({ provider: 'apple', providerAccountId: 'a-1', providerEmail: null, emailVerified: null, userId: stranger.id })
  const c = await confirmLink(deps, { body: { requestId, code: lastCode(mails), platform: 'ios' } })
  assert.deepEqual([c.status, c.body.code], [409, 'IDENTITY_TAKEN'])
})

test('コードの形: 6桁・待ちの ID と組のハッシュ', () => {
  assert.notEqual(hashLinkCode('r1', '123456'), hashLinkCode('r2', '123456'))
  assert.match(hashLinkCode('r1', '123456'), /^[0-9a-f]{64}$/)
})

// ---- Web（NextAuth）の signIn ----
test('Web の Apple: 同じメールの既存ユーザーがいれば確認の画面へ。隠したメール・未確認・初めての人・既存の Account は通す', async () => {
  const { repo } = makeDeps()
  repo.addUser({ id: 'u1', email: 'taro@example.com', emailNormalized: null }) // 埋め戻し前の既存の行（emailNormalized が空）でも見つかる
  const p = { provider: 'apple', providerAccountId: 'a-web' }
  assert.equal(await decideWebSignIn(repo, { ...p, profile: { email: 'Taro@Example.com', email_verified: 'true' } }), '/auth/signin?error=LinkConfirmationRequired')
  assert.equal(await decideWebSignIn(repo, { ...p, profile: { email: 'x@privaterelay.appleid.com', email_verified: 'true' } }), true)
  assert.equal(await decideWebSignIn(repo, { ...p, profile: { email: 'taro@example.com', email_verified: 'false' } }), true)
  assert.equal(await decideWebSignIn(repo, { ...p, profile: { email: 'new@example.com', email_verified: true } }), true)
  assert.equal(await decideWebSignIn(repo, { ...p, profile: null }), true)
  repo.accounts.push({ provider: 'apple', providerAccountId: 'a-web', providerEmail: null, emailVerified: null, userId: 'u1' })
  assert.equal(await decideWebSignIn(repo, { ...p, profile: { email: 'taro@example.com', email_verified: 'true' } }), true)
  assert.equal(await decideWebSignIn(repo, { provider: 'facebook', providerAccountId: 'x', profile: null }), '/auth/signin?error=AccessDenied')
})


// ---- 指摘への対応（独立の監査・自動レビュー） ----
test('確認コードの回数制限: 数百本を同時に送っても、照合できるのは5回まで。そのあとは正しいコードでも 429', async () => {
  const { deps, repo, mails, requestId } = await pending()
  await sendLinkCode(deps, { requestId })
  const right = lastCode(mails)
  const wrong = right === '000000' ? '111111' : '000000'
  const results = await Promise.all(Array.from({ length: 400 }, () => confirmLink(deps, { body: { requestId, code: wrong, platform: 'ios' } })))
  assert.equal(results.filter((r) => r.status === 400).length, LINK_MAX_ATTEMPTS)
  assert.equal(results.filter((r) => r.status === 429).length, 400 - LINK_MAX_ATTEMPTS)
  assert.equal(repo.links.get(requestId)!.attempts, LINK_MAX_ATTEMPTS)
  assert.equal((await confirmLink(deps, { body: { requestId, code: right, platform: 'ios' } })).status, 429)
  assert.equal(repo.accounts.filter((a) => a.provider === 'apple').length, 0)
})

test('確認コードの回数制限: 正しいコードを含む同時の送信でも、Account が足されるのは1回だけ', async () => {
  const { deps, repo, mails, requestId } = await pending()
  await sendLinkCode(deps, { requestId })
  const right = lastCode(mails)
  const rs = await Promise.all(Array.from({ length: 20 }, () => confirmLink(deps, { body: { requestId, code: right, platform: 'ios' } })))
  assert.equal(rs.filter((r) => r.status === 200).length, 1)
  assert.equal(repo.accounts.filter((a) => a.provider === 'apple').length, 1)
})

test('同時に2回 send-code を呼んでも、送られるのは1回だけ', async () => {
  const { deps, mails, requestId } = await pending()
  const rs = await Promise.all([sendLinkCode(deps, { requestId }), sendLinkCode(deps, { requestId }), sendLinkCode(deps, { requestId })])
  assert.equal(rs.filter((r) => r.status === 200).length, 1)
  assert.equal(mails.length, 1)
})

test('メールが確認済みでない既存ユーザーとは、メールでは結び付けない。別のユーザーも作らず、コードも出さない（409 LINK_TARGET_UNVERIFIED）', async () => {
  const { deps, repo } = makeDeps()
  repo.addUser({ id: 'seeded', email: 'taro@example.com', emailNormalized: 'taro@example.com', emailVerifiedForLink: false })
  const r = await exchangeIdToken(deps, body('google', google()))
  assert.deepEqual([r.status, r.body.code], [409, 'LINK_TARGET_UNVERIFIED'])
  assert.equal(repo.users.size, 1)
  assert.equal(repo.links.size, 0)
  assert.equal(repo.accounts.length, 0)
  assert.equal(repo.sessions.length, 0)
  // Web の Apple も同じ（確認の画面ではなく、拒否）
  assert.equal(await decideWebSignIn(repo, { provider: 'apple', providerAccountId: 'a-x', profile: { email: 'taro@example.com', email_verified: 'true' } }), '/auth/signin?error=AccessDenied')
})

test('同じ id_token の2回めの使用は 401（already-used）。ユーザーは増えず、最初の1回は成功する', async () => {
  const { deps, repo } = makeDeps()
  const tok = google()
  const a = await exchangeIdToken(deps, body('google', tok))
  const b = await exchangeIdToken(deps, body('google', tok))
  assert.equal(a.status, 200)
  assert.deepEqual([b.status, b.body.code, b.body.reason], [401, 'ID_TOKEN_INVALID', 'already-used'])
  assert.equal(repo.users.size, 1)
  assert.equal(repo.devices.length, 1)
  // 同時の2回でも1回だけ成功
  const t2 = google({ sub: 'g-race', email: 'race@example.com' })
  const rs = await Promise.all([exchangeIdToken(deps, body('google', t2)), exchangeIdToken(deps, body('google', t2))])
  assert.equal(rs.filter((r) => r.status === 200).length, 1)
  // 確認の手順になった id_token も、使用済みになる
  const g2 = google({ sub: 'g-3', email: 'g3@example.com' }); await exchangeIdToken(deps, body('google', g2))
  const ap = apple({ sub: 'a-3', email: 'g3@example.com' })
  assert.equal((await exchangeIdToken(deps, body('apple', ap))).body.code, 'LINK_CONFIRMATION_REQUIRED')
  assert.equal((await exchangeIdToken(deps, body('apple', ap))).body.reason, 'already-used')
})

test('Google の azp: 許可リストに無い azp は 401（bad-authorized-party）。azp が無いトークン・リスト内の azp は通る', async () => {
  const { deps } = makeDeps()
  const bad = await exchangeIdToken(deps, body('google', google({ azp: 'web-client-id' })))
  assert.deepEqual([bad.status, bad.body.reason], [401, 'bad-authorized-party'])
  assert.equal((await exchangeIdToken(deps, body('google', google({ sub: 'g-ok', email: 'ok1@example.com', azp: AUD_G })))).status, 200)
  assert.equal((await exchangeIdToken(deps, body('google', google({ sub: 'g-ok2', email: 'ok2@example.com' })))).status, 200)
})

test('id_token の使い回し: 署名の末尾の別の書き方の同じトークンは、すでに使った扱いではなく不正（malformed）として拒否され、ユーザーも増えない。claims が違えば通る', async () => {
  const { deps, repo } = makeDeps()
  const t = google({ jti: 'fixed-jti', sub: 'g-mal', email: 'mal@example.com' })
  assert.equal((await exchangeIdToken(deps, body('google', t))).status, 200)
  const [h, p, sg] = t.split('.')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const alt = alphabet.split('').find((c) => c !== sg.slice(-1) && Buffer.from(sg.slice(0, -1) + c, 'base64url').equals(Buffer.from(sg, 'base64url')))!
  for (const variant of [`${h}.${p}.${sg}=`, `${h}.${p}.${sg.slice(0, -1)}${alt}`]) {
    const r = await exchangeIdToken(deps, body('google', variant))
    assert.equal(r.status, 401)
    assert.notEqual(r.status, 200)
  }
  assert.equal(repo.users.size, 1)
  assert.equal(repo.devices.length, 1)
  // 同じ jti でも、元のトークンの2回めは拒否（already-used）
  assert.equal((await exchangeIdToken(deps, body('google', t))).body.reason, 'already-used')
  // claims（sub）が違えば、同じ jti でも通る
  assert.equal((await exchangeIdToken(deps, body('google', google({ jti: 'fixed-jti', sub: 'g-mal2', email: 'mal2@example.com' })))).status, 200)
})
