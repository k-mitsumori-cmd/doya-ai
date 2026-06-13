// ============================================
// SSRF安全な外部HTTP取得ユーティリティ
// - private/loopback/metadata IP を遮断（IPv4-mapped IPv6 も復号して判定）
// - リダイレクトは手動追従し、各ホップで宛先を再検証（追従によるバイパス防止）
// - 検証で得た安全なIPに接続をピン留め（DNSリバインディング TOCTOU 対策。undici利用、無ければフォールバック）
// ============================================
import dns from 'dns/promises'
import net from 'net'

const UA = 'Mozilla/5.0 (compatible; DoyaBot/1.0)'

const BLOCKED_HOSTNAMES = new Set([
  'localhost', '169.254.169.254', 'metadata.google.internal', 'metadata.azure.com', '100.100.100.200',
])

function ipv4Private(v: string): boolean {
  const p = v.split('.').map(Number)
  return (
    p[0] === 127 || p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || // CGNAT 100.64/10
    p[0] === 0
  )
}

/** private/loopback/link-local/metadata 判定。IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:7f00:1) は埋め込みIPv4を復号 */
export function isPrivateIP(ip: string): boolean {
  let v = ip.toLowerCase()
  // dotted IPv4-mapped: ::ffff:127.0.0.1
  const mappedDotted = v.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mappedDotted) v = mappedDotted[1]
  // hex IPv4-mapped: ::ffff:7f00:1  → 127.0.0.1
  const mappedHex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16)
    v = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  }
  if (net.isIPv4(v)) return ipv4Private(v)
  if (net.isIPv6(v)) {
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')
  }
  return false
}

/** ホスト名を解決し、全アドレスが公開IPであることを確認して安全な接続先IPを1つ返す（無ければthrow） */
async function resolvePublicIp(hostname: string): Promise<string> {
  const h = hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(h)) throw new Error('このホストへのアクセスは禁止されています')
  if (net.isIP(h)) {
    if (isPrivateIP(h)) throw new Error('プライベートIPへのアクセスは禁止されています')
    return h
  }
  const addrs = await dns.lookup(h, { all: true })
  if (!addrs.length) throw new Error('名前解決に失敗しました')
  for (const a of addrs) if (isPrivateIP(a.address)) throw new Error('解決先がプライベートIPです（SSRF防止）')
  return addrs[0].address
}

/** URLを検証し、{ パース済みURL, ピン留めする安全なIP } を返す */
export async function assertUrlSafe(rawUrl: string): Promise<{ url: URL; pinnedIp: string }> {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { throw new Error('不正なURL形式です') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('http/httpsのみ許可されています')
  const pinnedIp = await resolvePublicIp(parsed.hostname)
  return { url: parsed, pinnedIp }
}

// undici の動的importは一度だけ（ホットパスでの再解決を避ける）。利用不可なら null を記憶。
let undiciModPromise: Promise<any> | null = null
async function getUndici(): Promise<any | null> {
  if (undiciModPromise === null) {
    undiciModPromise = import('undici').then((m) => m).catch(() => null)
  }
  return undiciModPromise
}

/** 検証済みIPに接続をピン留めする undici dispatcher を生成（利用不可なら null） */
async function makePinnedDispatcher(pinnedIp: string): Promise<any | null> {
  const undici: any = await getUndici()
  if (!undici?.Agent) return null
  const family = net.isIPv6(pinnedIp) ? 6 : 4
  try {
    return new undici.Agent({
      connect: {
        // hostname を再解決させず検証済みIPへ強制接続（TLSのSNI/証明書は元hostnameのまま）。
        // undici は all:true で lookup を呼ぶため配列形で返す（単一形だと ERR_INVALID_IP_ADDRESS）。net.connect(all:false)にも両対応。
        lookup: (_hostname: string, options: any, cb: (err: Error | null, address: any, family?: number) => void) => {
          if (options && options.all) cb(null, [{ address: pinnedIp, family }])
          else cb(null, pinnedIp, family)
        },
      },
    })
  } catch {
    return null
  }
}

export interface SafeFetchOptions {
  timeoutMs?: number
  maxRedirects?: number
  /** Accept ヘッダ。未指定時は HTML を期待し、非HTMLレスポンスは null を返す */
  accept?: string
}

/**
 * SSRF安全に本文テキストを取得する。
 * リダイレクトは手動で追従し、各ホップで宛先を再検証＋IPピン留め。
 * 失敗・非許可・上限超過時は null（throwしない）。
 */
export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 10000
  const maxRedirects = opts.maxRedirects ?? 3
  let current = rawUrl
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const { url, pinnedIp } = await assertUrlSafe(current) // 各ホップで再検証
      const dispatcher = await makePinnedDispatcher(pinnedIp)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: 'manual', // 追従先を自前で再検証するため自動追従しない
        headers: { 'User-Agent': UA, 'Accept': opts.accept || 'text/html,application/xhtml+xml' },
        ...(dispatcher ? ({ dispatcher } as any) : {}),
      }).catch(() => null)

      // ボディ読み取りが終わってから dispatcher を閉じる（close前に閉じると本文取得が不安定になるため）
      const finish = <T>(v: T): T => {
        clearTimeout(timer)
        if (dispatcher?.close) dispatcher.close().catch(() => {})
        return v
      }

      if (!res) { finish(null); return null }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        finish(null)
        if (!loc) return null
        try { current = new URL(loc, url).toString() } catch { return null }
        continue // 次ループで再検証
      }
      if (!res.ok) { finish(null); return null }
      const ct = res.headers.get('content-type') || ''
      if (opts.accept === undefined && !ct.includes('html') && ct !== '') { finish(null); return null }
      const text = await res.text() // close前に本文を読み切る
      return finish(text)
    }
    return null // リダイレクト上限超過
  } catch {
    return null
  }
}

/** HTMLからスクリプト/スタイル/タグを除去してプレーンテキスト化 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
