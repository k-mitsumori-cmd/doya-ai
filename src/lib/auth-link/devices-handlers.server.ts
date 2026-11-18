import type { NextRequest, NextResponse } from 'next/server'
import { handleAppAuth } from './route-helpers.server'
import type { AuthDeps } from './app-auth-service'
import { listDevices, revokeDevice, setPushToken } from './devices'

/**
 * 「ログイン中の端末」の API 3本の、route の中身。route は、これを呼ぶだけにする。
 * 旗がオフなら、handleAppAuth が 404 を返す（DB もセッションも読まない）。
 * makeDeps・getCookieUserId は試験用（本番は省略して、本物の部品を使う）。
 */
type Opts = { makeDeps?: () => AuthDeps | Promise<AuthDeps>; getCookieUserId?: () => Promise<string | null> }

/** Web の Cookie のセッションのユーザー ID。取れなければ null */
async function defaultCookieUserId(): Promise<string | null> {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions).catch(() => null)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

async function principalInput(authorization: string | null, opts: Opts) {
  // Authorization があるときは Bearer だけを見る。無いときだけ Cookie のセッションを調べる
  const cookieUserId = authorization ? null : await (opts.getCookieUserId ?? defaultCookieUserId)()
  return { authorization, cookieUserId }
}

/** GET /api/app/auth/devices */
export function handleDevicesList(req: NextRequest, opts: Opts = {}): Promise<NextResponse> {
  return handleAppAuth(req, async (deps, { authorization }) => listDevices(deps, await principalInput(authorization, opts)), { readBody: false, makeDeps: opts.makeDeps })
}

/** DELETE /api/app/auth/devices/[id] */
export function handleDeviceRevoke(req: NextRequest, id: string, opts: Opts = {}): Promise<NextResponse> {
  return handleAppAuth(req, async (deps, { authorization }) => revokeDevice(deps, await principalInput(authorization, opts), id), { readBody: false, makeDeps: opts.makeDeps })
}

/** POST /api/app/auth/devices/[id]/push-token（Bearer だけ） */
export function handlePushToken(req: NextRequest, id: string, opts: Opts = {}): Promise<NextResponse> {
  return handleAppAuth(req, (deps, { authorization, body }) => setPushToken(deps, authorization, id, body), { makeDeps: opts.makeDeps })
}
