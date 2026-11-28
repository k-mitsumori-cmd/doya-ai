import { isAppAuthEnabled } from './app-auth-flag'
import { hostnameOf, LOCAL_HOSTNAMES } from './web-handoff'

/**
 * 開発用ログイン（POST /api/app/auth/dev-login）を動かしてよいか。手元の開発だけで使う。
 * 次の5つがすべてそろったときだけ true。1つでも欠ければ false（呼び出し側は、理由を出さずに 404 にする）。
 *   (a) 旗 APP_AUTH_ENABLED がオン
 *   (b) APP_DEV_LOGIN が '1'
 *   (c) NODE_ENV が production ではない
 *   (d) VERCEL が未設定（Vercel の上では動かさない）
 *   (e) リクエストの Host が localhost・127.0.0.1・[::1]（ポート付き可）
 * 本番のビルドに入れない作りの、1つ目の止め方。2つ目は、'dev' の提供元を、id_token の検証・結び付けの決定が受け付けないこと（試験で確かめる）。
 */
export function isDevLoginAllowed(env: Record<string, string | undefined>, host: string | null | undefined): boolean {
  if (!isAppAuthEnabled(env)) return false
  if (env.APP_DEV_LOGIN !== '1') return false
  if (env.NODE_ENV === 'production') return false
  if (env.VERCEL) return false
  if (!host) return false
  return LOCAL_HOSTNAMES.has(hostnameOf(host))
}

/** 開発用ログインが作るログイン手段の提供元。本物のログイン（exchange・Web）では受け付けない。 */
export const DEV_PROVIDER = 'dev'
