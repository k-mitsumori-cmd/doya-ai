/**
 * アプリのセッションから Web のセッション Cookie への引き渡し（web-handoff）の、純粋な規則。
 * 契約: docs/architecture/2026-11-18-app/api-contract.md の「web-handoff」。
 */

/** 引き渡しのコードの有効期間（60秒） */
export const HANDOFF_TTL_MS = 60 * 1000
/** 引き渡したあとの Web のセッションの期間。next-auth の session.maxAge（src/lib/auth.ts、24時間）と同じにする */
export const WEB_SESSION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * next（引き渡しのあとに開くパス）として許すか。
 * 許すのは、「/」で始まり、「//」で始まらず、/api/ の下ではなく、空白・制御文字（改行・タブ）・バックスラッシュを含まない、同じサイトのパス（クエリは可）。
 * タブや改行は、ブラウザが URL から取り除くため、「/」+ タブ + 「/evil.com」が「//evil.com」に化ける。ここで空白と制御文字をすべて拒否する。
 */
export function isSafeNextPath(next: unknown): next is string {
  if (typeof next !== 'string') return false
  if (next.length < 1 || next.length > 1024) return false
  if (!next.startsWith('/') || next.startsWith('//')) return false
  if (/[\u0000- \u007f-\u009f\\]/.test(next)) return false
  const path = next.split(/[?#]/)[0]
  if (path === '/api' || path.startsWith('/api/')) return false
  // 解釈し直しても、同じサイトのままか（別のオリジンに化けないか）
  try {
    const base = 'http://handoff.invalid'
    const u = new URL(next, base)
    if (u.origin !== base) return false
  } catch {
    return false
  }
  return true
}

const HOST_PATTERN = /^[A-Za-z0-9.\-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:]+\](:\d{1,5})?$/

/**
 * 引き渡しの URL の origin（https://example.com のような、パスを含まない部分）を決める。
 * 固定の環境変数 NEXTAUTH_URL があればその origin。無ければ、リクエストの Host（形を確かめたもの）から作る。
 * プロトコルは、localhost・127.0.0.1・[::1] なら http（x-forwarded-proto が https ならそちら）、それ以外は https。
 * 決められなければ null。
 */
export function resolveOrigin(args: { nextauthUrl?: string | null; host?: string | null; forwardedProto?: string | null }): string | null {
  if (args.nextauthUrl) {
    try {
      const u = new URL(args.nextauthUrl)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin
    } catch { /* 次へ */ }
  }
  const host = (args.host ?? '').trim()
  if (!host || !HOST_PATTERN.test(host)) return null
  const hostname = hostnameOf(host)
  const local = LOCAL_HOSTNAMES.has(hostname)
  const proto = args.forwardedProto === 'https' ? 'https' : local ? 'http' : 'https'
  return `${proto}://${host}`
}

export const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Host ヘッダーからポートを除いた名前（小文字）。IPv6 は [::1] の形のまま返す。 */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase()
  if (h.startsWith('[')) {
    const end = h.indexOf(']')
    return end === -1 ? h : h.slice(0, end + 1)
  }
  return h.replace(/:\d{1,5}$/, '')
}
