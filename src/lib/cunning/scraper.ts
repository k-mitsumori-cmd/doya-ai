// ============================================
// ドヤカンニング URL取り込み（軽量スクレイパー）
// ============================================
// ナレッジ取り込み・企業URL解析で共用。HTMLを取得し本文テキストへ素朴に変換する。
// ユーザー指定URLをサーバーが取得し本文を返すため SSRF 対策が必須:
//  - DNS解決した全IPがプライベート/ループバック/リンクローカル等でないか検証
//  - リダイレクトは手動で追い、各ホップの宛先を再検証（DNSリバインド/メタデータ到達を防ぐ）
import dns from 'dns'
import net from 'net'
import { Agent } from 'undici'
import { withTimeout } from '@/lib/fetch-timeout'

export interface ScrapeResult {
  url: string
  title: string
  text: string
}

/** IPv4/IPv6 が内部・予約レンジか（SSRFで狙われる宛先）。 */
function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip)
  if (kind === 4) return isBlockedV4(ip)
  if (kind === 6) {
    const h = expandIpv6(ip)
    if (!h) return true // 解析不能はブロック
    // :: (unspecified) / ::1 (loopback)
    if (h.every((x) => x === 0)) return true
    if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true
    // IPv4-mapped(::ffff:0:0/96) / IPv4-compat(deprecated) / NAT64(64:ff9b::/96) は埋め込みv4で判定。
    // ※ dotted(::ffff:1.2.3.4) でも hex(::ffff:0102:0304) でも同じ16bitに展開されるので両形を遮断。
    const mapped = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff
    const nat64 = h[0] === 0x64 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0
    const compat =
      h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0 && (h[6] !== 0 || h[7] > 1)
    if (mapped || nat64 || compat) {
      const v4 = `${(h[6] >> 8) & 0xff}.${h[6] & 0xff}.${(h[7] >> 8) & 0xff}.${h[7] & 0xff}`
      return isBlockedV4(v4)
    }
    // fc00::/7 (ULA: fc/fd), fe80::/10 (link-local)
    if ((h[0] & 0xfe00) === 0xfc00) return true
    if ((h[0] & 0xffc0) === 0xfe80) return true
    return false
  }
  return true // 解析不能はブロック
}

/** net.isIP済みのIPv6文字列を8ヘクステット(各16bit)へ完全展開。:: と埋め込みIPv4末尾に対応。失敗はnull。 */
function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0] // zone id 除去
  // 末尾の埋め込みIPv4(a.b.c.d)を2ヘクステットに変換
  const m = s.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (m) {
    const v4 = m[2].split('.').map((n) => parseInt(n, 10))
    if (v4.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
    s = m[1] + (((v4[0] << 8) | v4[1]) >>> 0).toString(16) + ':' + (((v4[2] << 8) | v4[3]) >>> 0).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : []
  let parts: string[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    parts = [...head, ...Array(missing).fill('0'), ...tail]
  } else {
    parts = head
  }
  if (parts.length !== 8) return null
  const out = parts.map((p) => (p === '' ? 0 : parseInt(p, 16)))
  if (out.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  return out
}

function isBlockedV4(ip: string): boolean {
  const parts = ip.split('.').map((n) => parseInt(n, 10))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  return false
}

interface ValidatedTarget {
  url: URL
  address: string // 検証済みの接続先IP（このIPに接続をピン留めしリバインドを防ぐ）
  family: number
}

/** http(s) かつ解決先IPが全て公開アドレスであることを検証。検証済みIPを返す。失敗時 throw。 */
async function assertPublicUrl(url: string): Promise<ValidatedTarget> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error('URLの形式が不正です')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('http(s) のURLを指定してください')
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  // ホスト名がそのままIPリテラルのケース
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error('内部アドレスへのアクセスは許可されていません')
    return { url: u, address: host, family: net.isIP(host) }
  }
  // DNS解決した全アドレスを検証（1つでも内部ならブロック）
  let addrs: { address: string; family: number }[]
  try {
    addrs = await dns.promises.lookup(host, { all: true })
  } catch {
    throw new Error('ホスト名を解決できませんでした')
  }
  if (addrs.length === 0) throw new Error('ホスト名を解決できませんでした')
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new Error('内部アドレスへのアクセスは許可されていません')
    }
  }
  // 全て公開アドレス。最初のアドレスに接続をピン留めする（fetchの再解決で内部に振られるのを防ぐ）
  return { url: u, address: addrs[0].address, family: addrs[0].family }
}

/** 検証済みIPへ接続を固定する undici Agent（DNSリバインドTOCTOU対策）。TLSはhostnameで検証される。 */
function pinnedAgent(address: string, family: number): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname: string, options: any, cb: any) => {
        if (options && options.all) cb(null, [{ address, family }])
        else cb(null, address, family)
      },
    },
  })
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t　]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/** URLを取得して本文テキスト化（最大 maxChars 文字）。SSRF対策済み。 */
export async function scrapeUrl(url: string, maxChars = 12000): Promise<ScrapeResult> {
  const timeoutMs = Number(process.env.CUNNING_SCRAPE_TIMEOUT_MS) || 20000

  return withTimeout('scrapeUrl', timeoutMs, async (signal) => {
    // リダイレクトを手動で追い、各ホップの宛先を毎回検証し、検証済みIPへ接続をピン留め
    let current = await assertPublicUrl(url)
    let res: Response | null = null
    for (let hop = 0; hop < 5; hop++) {
      const agent = pinnedAgent(current.address, current.family)
      try {
        res = await fetch(current.url.toString(), {
          signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaCunning/1.0)' },
          dispatcher: agent,
        } as any)
      } finally {
        agent.close().catch(() => {})
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) break
        current = await assertPublicUrl(new URL(loc, current.url).toString())
        continue
      }
      break
    }
    if (!res) throw new Error('URL取得に失敗しました')
    if (res.status >= 300 && res.status < 400) throw new Error('リダイレクトが多すぎます')
    if (!res.ok) throw new Error(`URL取得に失敗しました (${res.status})`)

    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const finalUrl = current.url.toString()
    const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : finalUrl
    const text = stripHtml(html).slice(0, maxChars)
    return { url: finalUrl, title, text }
  })
}
