import jwt from 'jsonwebtoken'
import AppleProvider from 'next-auth/providers/apple'

/**
 * Web（NextAuth）の Apple ログイン。環境変数が4つとも揃っているときだけ、providers に足す。
 *  - APPLE_CLIENT_ID: Services ID
 *  - APPLE_TEAM_ID、APPLE_KEY_ID、APPLE_PRIVATE_KEY（.p8 の中身。改行は \n の文字でもよい）
 * 1つでも欠ければ null を返し、何も足さない（既存の Google のログインは何も変わらない）。
 * Apple の client_secret は、秘密鍵で署名した JWT（ES256）で、最長6か月。ここでは約150日。起動のたびに作る。
 * 値は、Apple Developer の設定（株式会社スリスタの組織）ができてから、環境変数に入れる（三森さんの承認のあと）。
 */
export type AppleEnv = Record<string, string | undefined>

const APPLE_SECRET_TTL_SEC = 150 * 24 * 60 * 60

export function buildAppleClientSecret(a: { teamId: string; clientId: string; keyId: string; privateKey: string; now: Date }): string {
  const iat = Math.floor(a.now.getTime() / 1000)
  return jwt.sign({ iss: a.teamId, iat, exp: iat + APPLE_SECRET_TTL_SEC, aud: 'https://appleid.apple.com', sub: a.clientId }, a.privateKey, {
    algorithm: 'ES256',
    keyid: a.keyId,
  })
}

export function buildAppleProviders(env: AppleEnv = process.env, now: Date = new Date()) {
  const { APPLE_CLIENT_ID: clientId, APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: rawKey } = env
  if (!clientId || !teamId || !keyId || !rawKey) return []
  try {
    const privateKey = rawKey.replace(/\\n/g, '\n')
    return [AppleProvider({ clientId, clientSecret: buildAppleClientSecret({ teamId, clientId, keyId, privateKey, now }) })]
  } catch {
    // 鍵が読めないときは、Apple を足さずに起動する（Google のログインを止めない）
    return []
  }
}
