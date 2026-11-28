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

/** アプリからの要求に付ける専用のヘッダー。これが付いている要求だけを、置き換えの対象にする。 */
export const APP_REQUEST_HEADER = 'x-doya-app'
export const APP_REQUEST_HEADER_VALUE = '1'

export function bearerToCookie(args: {
  /** x-doya-app ヘッダーの値。'1' のときだけ置き換える。無ければ何もしない（401 も返さない） */
  appHeader?: string | null | undefined
  authorization: string | null | undefined
  cookie: string | null | undefined
  nextauthUrl: string | null | undefined
}): BearerResult {
  const { appHeader, authorization, cookie, nextauthUrl } = args
  // アプリの要求だけが対象。Cron（CRON_SECRET）や webhook など、Authorization を自分で読む既存の呼び出しには触らない
  if (appHeader !== APP_REQUEST_HEADER_VALUE) return { kind: 'none' }
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

/**
 * x-doya-app が付いていても置き換えない経路（1か所で定義する）。
 *  - /api/app/auth/: 交換・更新・ログアウトなどは、Authorization を自分で読む
 *  - /api/cron/、/api/stripe/webhook、/api/admin/: アプリから呼ばない経路（自前の秘密・署名・管理者の認証を使う）
 */
export const BEARER_EXCLUDED_PREFIXES = ['/api/app/auth', '/api/cron', '/api/stripe/webhook', '/api/admin'] as const

/** 完全に一致するか、その下の経路のとき真（/api/app/authx のような別の名前は含めない） */
export function isAppAuthRoute(pathname: string): boolean {
  return BEARER_EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
