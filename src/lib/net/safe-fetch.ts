// ============================================
// SSRF安全な外部HTTP取得ユーティリティ
// - private/loopback/metadata IP を遮断（IPv4-mapped IPv6 も復号して判定）
// - リダイレクトは手動追従し、各ホップで宛先を再検証（追従によるバイパス防止）
// - 検証で得た安全なIPに接続をピン留め（DNSリバインディング TOCTOU 対策。通常fetchへのフォールバックは禁止）
// ============================================
import dns from 'dns/promises'
import net from 'net'
import { Agent, fetch as pinnedFetch } from 'undici'

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
    p[0] === 0 || p[0] >= 224 ||
    (p[0] === 192 && p[1] === 0 && (p[2] === 0 || p[2] === 2)) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || (p[1] === 51 && p[2] === 100))) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113)
  )
}

/** private/loopback/link-local/metadata 判定。IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:7f00:1) は埋め込みIPv4を復号 */
export function isPrivateIP(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[([^\]]+)\]$/, '$1')
  if (net.isIPv4(v)) return ipv4Private(v)
  if (!net.isIPv6(v) || v.includes('%')) return true
  // WHATWG URL canonicalizes expanded and dotted IPv6 before prefix checks.
  const canonical = new URL(`http://[${v}]/`).hostname.slice(1, -1)
  const mapped = canonical.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/)
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16)
    return ipv4Private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  // Only ordinary global unicast. This excludes local, multicast, compatible
  // IPv4 and NAT64 forms; reject transition/documentation ranges within 2000::/3.
  const [first, second] = canonical.split(':').map(part => parseInt(part || '0', 16))
  return (first & 0xe000) !== 0x2000 || first === 0x2002 ||
    (first === 0x2001 && (second < 0x200 || second === 0xdb8)) ||
    (first === 0x3fff && second < 0x1000)
}

/** ホスト名を解決し、全アドレスが公開IPであることを確認して安全な接続先IPを1つ返す（無ければthrow） */
async function resolvePublicIp(hostname: string): Promise<string> {
  const h = hostname.toLowerCase().replace(/^\[([^\]]+)\]$/, '$1').replace(/\.$/, '')
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
  if (rawUrl.length > 8192) throw new Error('URLが長すぎます')
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { throw new Error('不正なURL形式です') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('http/httpsのみ許可されています')
  if (parsed.username || parsed.password) throw new Error('認証情報を含むURLは許可されていません')
  const pinnedIp = await resolvePublicIp(parsed.hostname)
  return { url: parsed, pinnedIp }
}

/** 検証済みIPに接続をピン留め。TLSのSNI/証明書は元hostnameのまま。 */
function makePinnedDispatcher(pinnedIp: string): Agent {
  const family = net.isIPv6(pinnedIp) ? 6 : 4
  return new Agent({
    connect: {
        // hostname を再解決させず検証済みIPへ強制接続（TLSのSNI/証明書は元hostnameのまま）。
        // undici は all:true で lookup を呼ぶため配列形で返す（単一形だと ERR_INVALID_IP_ADDRESS）。net.connect(all:false)にも両対応。
        lookup: (_hostname: string, options: any, cb: (err: Error | null, address: any, family?: number) => void) => {
          if (options && options.all) cb(null, [{ address: pinnedIp, family }])
          else cb(null, pinnedIp, family)
        },
    },
  })
}

/** DNS lookup cannot itself be cancelled; discard its result at the deadline. */
function withinDeadline<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) { task.catch(() => {}); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD'
  /** Check headers and cancel the body without downloading it. */
  headersOnly?: boolean
  timeoutMs?: number
  maxRedirects?: number
  /** Maximum decompressed response bytes (default 2 MiB, ceiling 8 MiB). */
  maxBytes?: number
  /** Optional parent deadline, e.g. a bounded browser resource-loading session. */
  signal?: AbortSignal
  /** Return false to stop a shared byte budget before retaining the chunk. */
  onBytes?: (byteLength: number) => boolean
  /** Accept ヘッダ。未指定時は HTML を期待し、非HTMLレスポンスは null を返す */
  accept?: string
  /** Diagnostics contain no URL, response body, or credentials. */
  onFailure?: (failure: SafeFetchFailure) => void
}

export type SafeFetchFailure = {
  reason: 'url_rejected' | 'dns' | 'network' | 'timeout' | 'http' | 'content_type' | 'redirect' | 'body'
  status?: number
}

/**
 * SSRF安全に本文テキストを取得する。
 * リダイレクトは手動で追従し、各ホップで宛先を再検証＋IPピン留め。
 * 失敗・非許可・上限超過時は null（throwしない）。
 */
export interface SafeFetchedResource {
  status?: number
  body: Buffer
  contentType: string
  url: string
}

export async function safeFetchResource(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchedResource | null> {
  const bounded = (value: number | undefined, fallback: number, ceiling: number): number =>
    Number.isFinite(value) && value! >= 0 ? Math.min(Math.floor(value!), ceiling) : fallback
  const timeoutMs = bounded(opts.timeoutMs, 10000, 120000)
  const maxRedirects = bounded(opts.maxRedirects, 3, 10)
  const maxBytes = bounded(opts.maxBytes, 2 * 1024 * 1024, 8 * 1024 * 1024)
  const controller = new AbortController()
  const abortFromParent = () => controller.abort()
  if (opts.signal?.aborted) controller.abort()
  else opts.signal?.addEventListener('abort', abortFromParent, { once: true })
  // One deadline covers DNS, all redirects and the decompressed response body.
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let current = rawUrl
  let phase: SafeFetchFailure['reason'] = 'url_rejected'
  const fail = (reason: SafeFetchFailure['reason'], status?: number): null => {
    try { opts.onFailure?.({ reason, ...(status !== undefined ? { status } : {}) }) } catch { /* diagnostics must not break callers */ }
    return null
  }
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      phase = 'url_rejected'
      const { url, pinnedIp } = await withinDeadline(assertUrlSafe(current), controller.signal)
      phase = 'network'
      const dispatcher = makePinnedDispatcher(pinnedIp)
      try {
        // Use undici directly: framework fetch wrappers/caches must not discard
        // the dispatcher and silently perform a second, unvalidated DNS lookup.
        const res = await pinnedFetch(url.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          method: opts.method || 'GET',
          headers: { 'User-Agent': UA, 'Accept': opts.accept || 'text/html,application/xhtml+xml' },
          dispatcher,
        })
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location')
          // Cancel an unread body before releasing this hop's connection.
          void res.body?.cancel().catch(() => {})
          if (!loc || hop === maxRedirects) return fail('redirect')
          try { current = new URL(loc, url).toString() } catch { return fail('redirect') }
          continue
        }
        if (!res.ok) {
          void res.body?.cancel().catch(() => {})
          return fail('http', res.status)
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase()
        if (opts.accept === undefined && !ct.includes('html') && ct !== '') {
          void res.body?.cancel().catch(() => {})
          return fail('content_type')
        }
        if (opts.headersOnly || opts.method === 'HEAD') {
          void res.body?.cancel().catch(() => {})
          return { body: Buffer.alloc(0), contentType: ct, url: url.toString(), status: res.status }
        }
        phase = 'body'
        if (Number(res.headers.get('content-length')) > maxBytes) {
          void res.body?.cancel().catch(() => {})
          return fail('body')
        }
        if (!res.body) return { body: Buffer.alloc(0), contentType: ct, url: url.toString() }
        const reader = res.body.getReader()
        // A fixed buffer also bounds overhead from millions of tiny chunks.
        const bytes = Buffer.allocUnsafe(maxBytes)
        let length = 0
        try {
          while (true) {
            const { done, value } = await withinDeadline(reader.read(), controller.signal)
            if (done) break
            if (opts.onBytes?.(value.byteLength) === false) return fail('body')
            if (length + value.byteLength > maxBytes) return fail('body')
            bytes.set(value, length)
            length += value.byteLength
          }
          return { body: bytes.subarray(0, length), contentType: ct, url: url.toString() }
        } finally {
          // Also abort endless, chunked or compressed responses at the byte cap.
          void reader.cancel().catch(() => {})
          reader.releaseLock()
        }
      } finally {
        // close() waits for unread streams; destroy() releases them on all exits.
        await dispatcher.destroy().catch(() => {})
      }
    }
    return fail('redirect')
  } catch (error) {
    const code = (error as { code?: string })?.code
    return fail(controller.signal.aborted ? 'timeout' :
      code === 'ENOTFOUND' || code === 'EAI_AGAIN' ? 'dns' : phase)
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', abortFromParent)
  }
}

/** Text compatibility wrapper; all outbound IO remains in the pinned transport. */
export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<string | null> {
  const resource = await safeFetchResource(rawUrl, opts)
  return resource ? resource.body.toString('utf8') : null
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
