import { isValidExpoPushToken } from './push-token'
import { readBearer, type AuthDeps, type ServiceResult } from './app-auth-service'
import { isSessionLive } from './device-token'

/**
 * 「ログイン中の端末」の処理（一覧・失効）と、プッシュトークンの登録。DB は repo、時刻は deps で受け取る。
 * 返すのは { status, body }。メール・トークンのハッシュ・プッシュトークンは、どの応答にも含めない。
 * 契約: docs/architecture/2026-11-18-app/api-contract.md の「ログイン中の端末」。
 */

const fail = (status: number, code: string): ServiceResult => ({ status, body: { code } })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** URL の id（cuid など）として許す形。それ以外は、DB を引かずに 404 にする */
const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/

export type Principal = { userId: string; /** Bearer のときだけ。いまの端末の判定に使う */ sessionId: string | null }
export type PrincipalInput = {
  authorization: string | null | undefined
  /** Web の Cookie のセッションから取ったユーザー ID（Authorization が無いときだけ使う）。取れなければ null */
  cookieUserId?: string | null
}

/**
 * 誰の要求かを決める。Authorization があれば、Bearer だけを見る（Bearer が不正なら、Cookie に切り替えずに失敗にする）。
 * 無ければ、Web の Cookie のセッション。退会済みのユーザーは、どちらでも通さない。
 */
export async function resolvePrincipal(deps: AuthDeps, input: PrincipalInput, opts: { bearerOnly?: boolean } = {}): Promise<Principal | null> {
  let principal: Principal | null = null
  if (input.authorization) {
    const token = readBearer(input.authorization)
    if (!token) return null
    const session = await deps.repo.findSession(token)
    if (!session || !isSessionLive(session, deps.now())) return null
    principal = { userId: session.userId, sessionId: session.id }
  } else if (!opts.bearerOnly && input.cookieUserId) {
    principal = { userId: input.cookieUserId, sessionId: null }
  }
  if (!principal) return null
  const user = await deps.repo.getUser(principal.userId)
  if (!user || user.deletedAt) return null
  return principal
}

export async function listDevices(deps: AuthDeps, input: PrincipalInput): Promise<ServiceResult> {
  const p = await resolvePrincipal(deps, input)
  if (!p) return fail(401, 'INVALID_TOKEN')
  const rows = await deps.repo.listLiveDevices(p.userId, deps.now())
  return {
    status: 200,
    body: {
      devices: rows.map((d) => ({
        id: d.id,
        deviceLabel: d.deviceLabel,
        platform: d.platform,
        lastUsedAt: (d.lastUsedAt ?? d.createdAt).toISOString(),
        createdAt: d.createdAt.toISOString(),
        isCurrent: p.sessionId !== null && d.sessionId === p.sessionId,
      })),
    },
  }
}

/**
 * 端末を失効させる（自分の、いま使える端末だけ。他人の id・存在しない id・失効済みは、同じ 404）。
 * 系統の全行に失効を入れ、対の Session と、その端末から引き渡した Web のセッションを消す。
 * いまの端末を消すのは、ログアウトと同じ（loggedOutCurrent: true）。
 */
export async function revokeDevice(deps: AuthDeps, input: PrincipalInput, id: unknown): Promise<ServiceResult> {
  const p = await resolvePrincipal(deps, input)
  if (!p) return fail(401, 'INVALID_TOKEN')
  if (typeof id !== 'string' || !DEVICE_ID.test(id)) return fail(404, 'NOT_FOUND')
  const now = deps.now()
  const device = await deps.repo.findLiveDevice(id, p.userId, now)
  if (!device) return fail(404, 'NOT_FOUND')
  await deps.repo.revokeFamily(device.familyId, now)
  return { status: 200, body: { ok: true, loggedOutCurrent: p.sessionId !== null && device.sessionId === p.sessionId } }
}

/**
 * プッシュトークンの登録（body: { token: string }）と取り消し（body: { token: null }）。
 * アプリ（Bearer）だけが呼べる。自分の、いま使える端末だけ。形が Expo のトークンでなければ 400。
 */
export async function setPushToken(deps: AuthDeps, authorization: string | null | undefined, id: unknown, body: unknown): Promise<ServiceResult> {
  const p = await resolvePrincipal(deps, { authorization }, { bearerOnly: true })
  if (!p) return fail(401, 'INVALID_TOKEN')
  if (typeof id !== 'string' || !DEVICE_ID.test(id)) return fail(404, 'NOT_FOUND')
  if (!isObj(body) || !('token' in body)) return fail(400, 'INVALID_REQUEST')
  const token = body.token
  if (token !== null && !isValidExpoPushToken(token)) return fail(400, 'INVALID_REQUEST')
  const ok = await deps.repo.setDevicePushToken(id, p.userId, token, deps.now())
  if (!ok) return fail(404, 'NOT_FOUND')
  return { status: 200, body: { ok: true, enabled: token !== null } }
}
