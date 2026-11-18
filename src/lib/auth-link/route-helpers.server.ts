import { NextResponse, type NextRequest } from 'next/server'
import { appAuthOffResponse } from './app-auth-flag'
import type { AuthDeps, ServiceResult } from './app-auth-service'

const MAX_BODY_BYTES = 16 * 1024

/**
 * アプリ用の認証 API の共通の入口。旗がオフなら 404（何も読まない・何も作らない）。
 * 本文は JSON で 16KB まで。例外は中身を出さず 500 { code: 'INTERNAL' } にする（ログにも、トークン・メール・id_token を出さない）。
 */
export async function handleAppAuth(
  req: NextRequest,
  run: (deps: AuthDeps, ctx: { body: unknown; authorization: string | null; headers: Headers }) => Promise<ServiceResult>,
  /** makeDeps は試験用（本番は省略して、本物の部品を使う） */
  opts: { readBody?: boolean; makeDeps?: () => AuthDeps | Promise<AuthDeps> } = {},
): Promise<NextResponse> {
  const off = appAuthOffResponse()
  if (off) return off
  try {
    let body: unknown = null
    if (opts.readBody !== false) {
      const text = await req.text()
      if (text.length > MAX_BODY_BYTES) return json({ code: 'INVALID_REQUEST' }, 413)
      try { body = text ? JSON.parse(text) : null } catch { return json({ code: 'INVALID_REQUEST' }, 400) }
    }
    let deps: AuthDeps
    if (opts.makeDeps) deps = await opts.makeDeps()
    else {
      const { createRealAuthDeps } = await import('./deps.server')
      deps = createRealAuthDeps()
    }
    const r = await run(deps, { body, authorization: req.headers.get('authorization'), headers: req.headers })
    return json(r.body, r.status)
  } catch {
    return json({ code: 'INTERNAL' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
