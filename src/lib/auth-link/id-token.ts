import { createHash, createPublicKey, timingSafeEqual, type JsonWebKey } from 'node:crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { isApplePrivateRelay, normalizeEmail } from './email-normalize'

/**
 * Apple・Google の id_token の検証（ネットワークに触らない）。
 * 公開鍵（JWKS）は呼び出し側が取得（Google: https://www.googleapis.com/oauth2/v3/certs、Apple: https://appleid.apple.com/auth/keys）
 * して引数で渡す。取得・キャッシュ・鍵の入れ替わりへの再取得は、呼び出し側（次の担当）の仕事。
 *
 * 確かめるもの: 署名（RS256 だけ許す）、iss、aud、exp、nonce（必須）、sub があること。
 * email_verified と is_private_email は、真偽値にそろえて返す（Apple は文字列 'true' で返すことがある）。
 */

export type IdTokenProvider = 'google' | 'apple'

export type Jwks = { keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> }

export type VerifyIdTokenInput = {
  token: string
  provider: IdTokenProvider
  jwks: Jwks
  /** 許す aud（iOS のクライアント ID など。Apple は Bundle ID）。1つ以上 */
  audience: string | string[]
  /**
   * アプリが作った生の nonce。トークンの nonce と突き合わせる。
   * Apple の iOS は、アプリが SHA-256（16進）にしたものを Apple に渡すため、トークンの nonce は生の値のハッシュのことがある。
   * このため Apple は「生の値」または「SHA-256 の16進」のどちらかが一致すれば通す。Google は生の値だけ。
   */
  nonce: string
  now: Date
  /** 時計のずれの許容（秒）。既定は 60 */
  clockToleranceSec?: number
}

export type IdTokenFailure =
  | 'malformed'
  | 'unsupported-alg'
  | 'no-matching-key'
  | 'bad-key'
  | 'bad-signature'
  | 'expired'
  | 'not-yet-valid'
  | 'bad-issuer'
  | 'bad-audience'
  | 'missing-sub'
  | 'missing-nonce'
  | 'nonce-mismatch'

export type VerifiedIdentity = {
  provider: IdTokenProvider
  /** 提供元の不変の ID（Account.providerAccountId に入れる） */
  sub: string
  /** 提供元が返したメール（無ければ null）。小文字・trim 済み */
  email: string | null
  /** 提供元が確認済みと返したか。claim が無ければ false */
  emailVerified: boolean
  /** Apple の「メールを隠す」か（claim の is_private_email、またはドメイン） */
  isPrivateEmail: boolean
}

export type VerifyIdTokenResult = { ok: true; identity: VerifiedIdentity } | { ok: false; reason: IdTokenFailure }

const ISSUERS: Record<IdTokenProvider, string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
}

/** 真偽値、または文字列 'true' / 'false' を真偽値にする。それ以外（undefined など）は null。 */
export function parseBooleanClaim(v: unknown): boolean | null {
  if (v === true || v === 'true') return true
  if (v === false || v === 'false') return false
  return null
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function nonceMatches(provider: IdTokenProvider, claim: string, raw: string): boolean {
  if (safeEqual(claim, raw)) return true
  if (provider === 'apple') {
    const hashed = createHash('sha256').update(raw, 'utf8').digest('hex')
    return safeEqual(claim, hashed)
  }
  return false
}

export function verifyIdToken(input: VerifyIdTokenInput): VerifyIdTokenResult {
  const { token, provider, jwks, audience, nonce, now } = input
  const tolerance = input.clockToleranceSec ?? 60
  const fail = (reason: IdTokenFailure): VerifyIdTokenResult => ({ ok: false, reason })

  if (typeof token !== 'string' || token.split('.').length !== 3) return fail('malformed')
  if (typeof nonce !== 'string' || !nonce) return fail('missing-nonce')

  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded === 'string' || !decoded.header) return fail('malformed')
  // alg を RS256 だけに固定する。none や HS256（公開鍵を共通鍵にする攻撃）は、署名の確認の前に弾く
  if (decoded.header.alg !== 'RS256') return fail('unsupported-alg')

  const kid = decoded.header.kid
  const candidates = (jwks?.keys ?? []).filter((k) => k && k.kty === 'RSA' && (kid ? k.kid === kid : true))
  const jwk = candidates[0]
  if (!jwk) return fail('no-matching-key')

  let key
  try {
    key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' })
  } catch {
    return fail('bad-key')
  }

  const audiences = Array.isArray(audience) ? audience : [audience]
  if (audiences.length === 0 || audiences.some((a) => !a)) return fail('bad-audience')

  let claims: JwtPayload
  try {
    const verified = jwt.verify(token, key, {
      algorithms: ['RS256'],
      issuer: ISSUERS[provider],
      audience: audiences as [string, ...string[]],
      clockTimestamp: Math.floor(now.getTime() / 1000),
      clockTolerance: tolerance,
    })
    if (typeof verified === 'string') return fail('malformed')
    claims = verified
  } catch (e) {
    const err = e as { name?: string; message?: string }
    const msg = err.message ?? ''
    if (err.name === 'TokenExpiredError') return fail('expired')
    if (err.name === 'NotBeforeError') return fail('not-yet-valid')
    if (/issuer/.test(msg)) return fail('bad-issuer')
    if (/audience/.test(msg)) return fail('bad-audience')
    if (/signature/.test(msg)) return fail('bad-signature')
    return fail('malformed')
  }

  if (typeof claims.exp !== 'number') return fail('expired')
  if (typeof claims.sub !== 'string' || !claims.sub) return fail('missing-sub')

  const claimNonce = (claims as Record<string, unknown>).nonce
  if (typeof claimNonce !== 'string' || !claimNonce) return fail('missing-nonce')
  if (!nonceMatches(provider, claimNonce, nonce)) return fail('nonce-mismatch')

  const rawEmail = typeof (claims as Record<string, unknown>).email === 'string' ? ((claims as Record<string, unknown>).email as string) : null
  const email = normalizeEmail(rawEmail)
  const verifiedClaim = parseBooleanClaim((claims as Record<string, unknown>).email_verified)
  const privateClaim = parseBooleanClaim((claims as Record<string, unknown>).is_private_email)

  return {
    ok: true,
    identity: {
      provider,
      sub: claims.sub,
      email,
      // email が無いときは、確認済みとは言わない
      emailVerified: Boolean(email) && verifiedClaim === true,
      isPrivateEmail: privateClaim === true || isApplePrivateRelay(email),
    },
  }
}
