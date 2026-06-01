// ============================================
// ドヤスライド URL内容の取得（参考情報スクレイピング）
// ============================================
import * as cheerio from 'cheerio'
import { lookup } from 'dns/promises'

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15000

// 解決IPが内部/予約レンジかどうか（IPv4/IPv6・マップド表記を含む）
function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().trim()
  if (v.includes(':')) {
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fe80')) return true // link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local (ULA)
    const mapped = v.match(/(?:::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  const parts = v.split('.').map((n) => Number(n))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true // 不明は安全側で拒否
  const [a, b] = parts
  if (a === 0 || a === 127) return true // this-host / loopback
  if (a === 10) return true
  if (a === 169 && b === 254) return true // link-local / クラウドメタデータ
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast / reserved
  return false
}

function parseHttpUrl(raw: string, base?: URL): URL {
  let u: URL
  try {
    u = base ? new URL(raw, base) : new URL(raw)
  } catch {
    throw new Error('URLの形式が正しくありません')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('http(s) のURLのみ対応しています')
  }
  return u
}

// ホスト名をDNS解決し、いずれかの解決IPが内部レンジなら拒否
// （これにより 10進/16進IP表記・内部を指すドメインも遮断される）
async function assertResolvedHostIsPublic(host: string): Promise<void> {
  let records: { address: string }[]
  try {
    records = await lookup(host, { all: true })
  } catch {
    throw new Error('ホスト名を解決できませんでした')
  }
  if (!records.length) throw new Error('ホスト名を解決できませんでした')
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new Error('このURLは取得できません（内部アドレス宛て）')
    }
  }
}

// 手動でリダイレクトを追い、各ホップで再検証する（SSRF対策）
async function safeFetch(startUrl: string, signal: AbortSignal): Promise<Response> {
  let current = parseHttpUrl(startUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertResolvedHostIsPublic(current.hostname)
    const res = await fetch(current.toString(), {
      headers: { 'User-Agent': CHROME_UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual',
      signal,
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return res
      current = parseHttpUrl(loc, current) // 次ホップを再検証
      continue
    }
    return res
  }
  throw new Error('リダイレクトが多すぎます')
}

export interface ScrapedPage {
  url: string
  title: string
  description: string
  text: string // 本文抽出（最大12000字）
}

/** URLのHTMLを取得し、タイトル・説明・本文テキストを抽出（SSRF対策つき） */
export async function scrapeUrlText(raw: string): Promise<ScrapedPage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let html: string
  let finalUrl: string
  try {
    const res = await safeFetch(raw, controller.signal)
    if (!res.ok) throw new Error(`ページ取得に失敗しました (${res.status})`)
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('html') && !ctype.includes('text')) {
      throw new Error('HTMLページではありません')
    }
    html = await res.text()
    finalUrl = res.url || raw
  } finally {
    clearTimeout(timer)
  }

  const $ = cheerio.load(html)
  const title = $('title').first().text().trim()
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    ''
  $('script, style, svg, noscript, iframe, link, nav, footer, header').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000)

  return { url: finalUrl, title, description, text }
}
