import { NextResponse, type NextRequest } from 'next/server'
import { appAuthOffResponse } from './app-auth-flag'
import { handleAppAuth } from './route-helpers.server'
import { consumeWebHandoff, createWebHandoff, devLogin, reviewLogin, type AuthDeps } from './app-auth-service'
import { APP_REQUEST_HEADER, sessionCookieName } from './bearer-cookie'
import { isDevLoginAllowed } from './dev-login'
import { readReviewLoginConfig } from './review-login'
import { HANDOFF_VERIFIER_HEADER, resolveOrigin } from './web-handoff'

/**
 * web-handoff（2本）と dev-login の、route の中身。route は、これを呼ぶだけにする。
 * makeDeps は試験用（本番は省略して、本物の部品を使う）。
 */
type MakeDeps = () => AuthDeps | Promise<AuthDeps>

function originOf(req: NextRequest): string | null {
  return resolveOrigin({ nextauthUrl: process.env.NEXTAUTH_URL, host: req.headers.get('host'), forwardedProto: req.headers.get('x-forwarded-proto') })
}

/** POST /api/app/auth/web-handoff */
export async function handleWebHandoffCreate(req: NextRequest, makeDeps?: MakeDeps): Promise<NextResponse> {
  return handleAppAuth(
    req,
    (deps, { body, authorization, headers }) =>
      createWebHandoff(deps, { authorization, appHeader: headers.get(APP_REQUEST_HEADER), body, origin: originOf(req) }),
    { makeDeps },
  )
}

const FAIL_PATH = '/auth/signin?error=HandoffInvalid'

function redirectTo(req: NextRequest, path: string): NextResponse {
  const origin = originOf(req) ?? req.nextUrl.origin
  const res = NextResponse.redirect(new URL(path, origin), 302)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  return res
}

/**
 * GET /api/app/auth/web-handoff/consume?code=
 * 受け取る側の束縛: ヘッダー x-doya-handoff の verifier の SHA-256 が、作成時の challenge と一致するときだけ成功する。無い・不一致のときは、コードを消費せずに失敗の応答にする。
 * 成功: Web の通常のセッションの Cookie（HttpOnly・SameSite=Lax・Path=/・https なら Secure）をセットして、検証済みの next へ 302。
 * 失敗: 理由を出さず、/auth/signin?error=HandoffInvalid へ 302。
 */
export async function handleWebHandoffConsume(req: NextRequest, makeDeps?: MakeDeps): Promise<NextResponse> {
  const off = appAuthOffResponse()
  if (off) return off
  try {
    let deps: AuthDeps
    if (makeDeps) deps = await makeDeps()
    else {
      const { createRealAuthDeps } = await import('./deps.server')
      deps = createRealAuthDeps()
    }
    const r = await consumeWebHandoff(deps, req.nextUrl.searchParams.get('code'), req.headers.get(HANDOFF_VERIFIER_HEADER))
    if (!r.ok) return redirectTo(req, FAIL_PATH)
    const res = redirectTo(req, r.nextPath)
    const name = sessionCookieName(process.env.NEXTAUTH_URL)
    const origin = originOf(req) ?? req.nextUrl.origin
    res.cookies.set({
      name,
      value: r.sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: name.startsWith('__Secure-') || origin.startsWith('https://'),
      expires: r.expires,
    })
    return res
  } catch {
    return redirectTo(req, FAIL_PATH)
  }
}

/** POST /api/app/auth/review-login。旗・審査用のメールとコードがそろわなければ、理由を出さずに 404 */
export async function handleReviewLogin(req: NextRequest, makeDeps?: MakeDeps): Promise<NextResponse> {
  const cfg = readReviewLoginConfig(process.env)
  if (!cfg) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
  return handleAppAuth(req, (deps, { body }) => reviewLogin(deps, body, cfg), { makeDeps })
}

/** POST /api/app/auth/dev-login。動かしてよい条件がそろわなければ、理由を出さずに 404 */
export async function handleDevLogin(req: NextRequest, makeDeps?: MakeDeps): Promise<NextResponse> {
  if (!isDevLoginAllowed(process.env, req.headers.get('host'))) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
  }
  return handleAppAuth(req, (deps, { body }) => devLogin(deps, body), { makeDeps })
}
