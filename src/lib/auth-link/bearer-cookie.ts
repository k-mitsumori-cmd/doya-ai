/**
 * Authorization: Bearer を、next-auth のセッション Cookie に置き換える規則（純粋関数。Edge の middleware から呼ぶ）。
 * 確かめた根拠: docs/architecture/2026-11-18-app/spike-middleware-bearer.md。
 * ⚠️ Edge で動くので、node:crypto などの node 専用の部品を import しない（device-token.ts の isSafeTokenValue と同じ規則を、ここに持つ）。
 */

/** device-token.ts の isSafeTokenValue と同じ範囲（試験で一致を確かめる） */
export const SAFE_BEARER_VALUE = /^[A-Za-z0-9_-]{16,256}$/

/** next-auth の既定の Cookie 名。NEXTAUTH_URL が https なら __Secure- が付く（useSecureCookies と同じ規則）。 */
export function sessionCookieName(nextauthUrl: string | undefined | null): string {
  return (nextauthUrl ?? '').startsWith('https://') ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
}

export type BearerResult =
  /** Authorization が無い、または Bearer でない。何もしない（Cookie のままの要求） */
  | { kind: 'none' }
  /** Bearer だが値の形が不正。401 を返す */
  | { kind: 'invalid' }
  /** cookie ヘッダーを、この値に置き換える。authorization は取り除く */
  | { kind: 'replace'; cookie: string }

const SESSION_COOKIE = /^(__Secure-)?next-auth\.session-token(\.\d+)?$/

export function bearerToCookie(args: {
  authorization: string | null | undefined
  cookie: string | null | undefined
  nextauthUrl: string | null | undefined
}): BearerResult {
  const { authorization, cookie, nextauthUrl } = args
  if (!authorization) return { kind: 'none' }
  const m = /^Bearer(?:\s+(.*))?$/i.exec(authorization.trim())
  if (!m) return { kind: 'none' }
  const token = m[1] ?? ''
  if (!SAFE_BEARER_VALUE.test(token)) return { kind: 'invalid' }
  // Bearer を優先する。同じ名前（分割した .0 .1 も）の Cookie は捨て、ほかの Cookie は残す
  const kept = (cookie ?? '')
    .split(/;\s*/)
    .filter((part) => {
      if (!part) return false
      const name = part.split('=')[0].trim()
      return !SESSION_COOKIE.test(name)
    })
  kept.push(`${sessionCookieName(nextauthUrl)}=${token}`)
  return { kind: 'replace', cookie: kept.join('; ') }
}

/** アプリ用の認証 API 自身は、Authorization を自分で読むので、置き換えない。 */
export function isAppAuthRoute(pathname: string): boolean {
  return pathname === '/api/app/auth' || pathname.startsWith('/api/app/auth/')
}
