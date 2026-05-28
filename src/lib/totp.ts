import * as OTPAuth from 'otpauth'

const ISSUER = 'ドヤAI Admin'

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

export function getTotpUri(secret: string, label: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  return totp.toString()
}

export function verifyToken(secret: string, token: string): boolean {
  if (!token || !secret) return false
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  // window: 1 (±30秒のドリフトを許容)
  const delta = totp.validate({ token: token.replace(/\s/g, ''), window: 1 })
  return delta !== null
}
