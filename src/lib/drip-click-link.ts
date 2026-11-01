import crypto from 'crypto'

// ============================================
// ドリップメールのクリック計測リンク（/api/t/click/{trackingId}/{linkId}）
// ============================================
// なぜ署名するか（2026-10-18 のシステム点検で発見）:
//   以前の linkId は「元の URL を base64url にしただけ」だった。
//   そのため誰でも自社ドメインの URL から任意のサイトへ 302 で飛ばせ、
//   フィッシングの踏み台になっていた。
// 今の形式: linkId = base64url(URL) + '.' + 署名（trackingId と URL に対する HMAC）
// 署名のない古い linkId（送信済みメールのリンク）は、自社ドメイン宛てのときだけ転送する。
// それ以外はサイトのトップへ送る（リンク切れにはせず、外部へは飛ばさない）。

const SIG_LENGTH = 32

function clickSecret(): string {
  const secret = process.env.DRIP_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'drip-click-dev-secret')
  if (!secret) throw new Error('DRIP_UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET is required')
  return secret
}

function signature(trackingId: string, url: string): string {
  return crypto.createHmac('sha256', clickSecret()).update(`drip-click:v1\n${trackingId}\n${url}`).digest('base64url').slice(0, SIG_LENGTH)
}

/** 送信時に使う: 元の URL から署名付きの linkId を作る */
export function createClickLinkId(trackingId: string, url: string): string {
  return `${Buffer.from(url).toString('base64url')}.${signature(trackingId, url)}`
}

const TRUSTED_HOSTS = ['surisuta.jp']

/** 署名のない古いリンクで転送してよい宛先か（自社ドメインとそのサブドメインだけ） */
export function isTrustedLegacyHost(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return TRUSTED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export type ClickResolution =
  | { kind: 'signed'; url: string }
  | { kind: 'legacy'; url: string }
  | { kind: 'rejected' }

/** 受信時に使う: linkId から転送先を決める。署名が合わない・宛先が不正なら rejected。 */
export function resolveClickLink(trackingId: string, linkId: string): ClickResolution {
  const dot = linkId.lastIndexOf('.')
  const encoded = dot >= 0 ? linkId.slice(0, dot) : linkId
  const sig = dot >= 0 ? linkId.slice(dot + 1) : ''
  let url: string
  try {
    url = Buffer.from(encoded, 'base64url').toString('utf-8')
  } catch {
    return { kind: 'rejected' }
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { kind: 'rejected' }
  } catch {
    return { kind: 'rejected' }
  }
  if (sig) {
    const expected = Buffer.from(signature(trackingId, url))
    const actual = Buffer.from(sig)
    if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) return { kind: 'signed', url }
    return { kind: 'rejected' }
  }
  return isTrustedLegacyHost(url) ? { kind: 'legacy', url } : { kind: 'rejected' }
}
