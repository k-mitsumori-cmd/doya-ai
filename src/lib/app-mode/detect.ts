/**
 * アプリ表示モードの判定（単一ソース。純粋関数。Edge の middleware からも呼ぶので、node 専用の部品を import しない）。
 *
 * アプリ（ドヤバディ）の WebView で表示されているときだけ、課金の導線と計測を出さない。
 * Web のブラウザで見る人には、何も変えない。
 *
 * 旗: 環境変数 APP_MODE_ENABLED が '1' のときだけオン。既定はオフ。オフなら、判定は常に「アプリではない」。
 * クライアント側は、next.config.js が APP_MODE_ENABLED を NEXT_PUBLIC_APP_MODE_ENABLED に写す（ビルド時に埋まる。変えたら再デプロイが要る）。
 * アプリ認証の旗 APP_AUTH_ENABLED とは別。
 * 仕組み: docs/architecture/2026-11-18-app/app-mode-web.md
 */

/** アプリの WebView の User-Agent に付く名前（アプリ側 app/tool/[id].tsx の applicationNameForUserAgent） */
export const APP_UA_TOKEN = 'DoyaBuddyApp'
/** web-handoff の consume が、アプリ用セッションの Cookie と一緒にセットする印。値は '1' だけ */
export const APP_MODE_COOKIE = 'doya_app'
export const APP_MODE_COOKIE_VALUE = '1'

type Env = Record<string, string | undefined>

/** サーバー（middleware を含む）の旗。APP_MODE_ENABLED === '1' のときだけオン。 */
export function isAppModeEnabled(env: Env = process.env): boolean {
  return env.APP_MODE_ENABLED === '1'
}

/** User-Agent に、アプリの名前が（1語として）含まれるか。大文字小文字は区別しない。DoyaBuddyAppX や NotDoyaBuddyApp は対象外。 */
export function hasAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return /(?:^|[\s(;,])DoyaBuddyApp(?:[/\s;,)]|$)/i.test(userAgent)
}

/** Cookie の文字列（リクエストの cookie ヘッダー、または document.cookie）に、doya_app=1 があるか。 */
export function hasAppCookie(cookie: string | null | undefined): boolean {
  if (!cookie) return false
  for (const part of cookie.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === APP_MODE_COOKIE && part.slice(i + 1).trim() === APP_MODE_COOKIE_VALUE) return true
  }
  return false
}

/** リクエスト（サーバー側）の判定。旗がオフなら常に false。 */
export function isAppRequest(
  headers: { get(name: string): string | null | undefined },
  env: Env = process.env,
): boolean {
  if (!isAppModeEnabled(env)) return false
  return hasAppUserAgent(headers.get('user-agent')) || hasAppCookie(headers.get('cookie'))
}

/** ブラウザ側の判定（純粋関数。旗・User-Agent・Cookie を引数で受ける）。旗がオフなら常に false。 */
export function decideAppModeClient(args: {
  enabled: boolean
  userAgent: string | null | undefined
  cookie: string | null | undefined
}): boolean {
  if (!args.enabled) return false
  return hasAppUserAgent(args.userAgent) || hasAppCookie(args.cookie)
}
