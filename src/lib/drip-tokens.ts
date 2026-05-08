import crypto from 'crypto'

const HMAC_SECRET = process.env.DRIP_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'drip-unsubscribe-fallback-secret'
const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90日間有効

export function generateUnsubscribeToken(userId: string): string {
  const payload = JSON.stringify({ userId, t: Date.now() })
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('base64url')
  const encoded = Buffer.from(payload).toString('base64url')
  return `${encoded}.${signature}`
}

export function verifyAndDecodeToken(token: string): { userId: string } {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new Error('Invalid token format')
  }

  const [encoded, signature] = parts
  const payload = Buffer.from(encoded, 'base64url').toString('utf-8')

  const expectedSig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('base64url')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new Error('Invalid token signature')
  }

  const decoded = JSON.parse(payload)
  if (!decoded.userId) throw new Error('Invalid token: missing userId')

  if (decoded.t && Date.now() - decoded.t > TOKEN_MAX_AGE_MS) {
    throw new Error('Token expired')
  }

  return { userId: decoded.userId }
}
