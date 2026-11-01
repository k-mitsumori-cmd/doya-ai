import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

// ============================================
// ナグサメのゲスト ID（Cookie）
// ============================================
// なぜ署名するか（2026-10-18 のシステム点検で発見）:
//   以前は Cookie の値をそのまま guestId として数えていた。
//   Cookie を消すか書き換えるだけで、ゲストの 1 日 3 回の枠が何度でも使えた。
// 今の形式: Cookie 値 = UUID + '.' + 署名。署名が合わない値は使わず、新しい ID を発行する。
// ⚠️ ID を作り直されても枠が増えないよう、ゲストは接続元 IP ごとの上限も別に数える（limits.ts）。

export const GUEST_COOKIE = 'mitsuboshi_guest_id'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function guestSecret(): string {
  const secret = process.env.MITSUBOSHI_GUEST_SECRET || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'mitsuboshi-guest-dev-secret')
  if (!secret) throw new Error('MITSUBOSHI_GUEST_SECRET or NEXTAUTH_SECRET is required')
  return secret
}

function sign(id: string): string {
  return createHmac('sha256', guestSecret()).update(`nagusame-guest:v1\n${id}`).digest('base64url').slice(0, 32)
}

/** 新しいゲスト ID と、その Cookie 値を作る */
export function issueGuestId(): { guestId: string; cookieValue: string } {
  const guestId = randomUUID()
  return { guestId, cookieValue: `${guestId}.${sign(guestId)}` }
}

/** Cookie 値を検証し、正しければゲスト ID を返す。署名の無い値・合わない値は null。 */
export function readGuestId(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null
  const dot = cookieValue.indexOf('.')
  if (dot < 0) return null
  const id = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  if (!UUID_RE.test(id)) return null
  const expected = Buffer.from(sign(id))
  const actual = Buffer.from(sig)
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null
}

export function guestCookieHeader(cookieValue: string): string {
  const parts = [
    `${GUEST_COOKIE}=${cookieValue}`,
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 30}`,
    'SameSite=Lax',
    'HttpOnly',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}
