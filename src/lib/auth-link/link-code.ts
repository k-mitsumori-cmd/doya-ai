import { sha256Hex, type RandomBytes } from './device-token'

export const LINK_REQUEST_TTL_MS = 15 * 60 * 1000
export const LINK_MAX_ATTEMPTS = 5

/** 6桁の確認コード。偏りを避けるため、乱数が 4,294,000,000 以上のときは取り直す（呼び出しの上限 8 回）。 */
export function generateLinkCode(randomBytes: RandomBytes): string {
  for (let i = 0; i < 8; i++) {
    const b = randomBytes(4)
    if (!b || b.length < 4) throw new Error('randomBytes must return 4 bytes')
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
    if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, '0')
  }
  throw new Error('could not generate a code')
}

/** コードは、待ちの ID と組にして SHA-256 にする（別の待ちのコードと使い回せない）。平文は DB に置かない。 */
export function hashLinkCode(requestId: string, code: string): string {
  return sha256Hex(`${requestId}:${code}`)
}

/** 画面に出す宛先の手がかり。例: taro@example.com -> t***@example.com */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

export function isValidCodeFormat(code: unknown): code is string {
  return typeof code === 'string' && /^\d{6}$/.test(code)
}
