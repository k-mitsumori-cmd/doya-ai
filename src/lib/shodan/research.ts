// ============================================
// ドヤ商談準備（Shodan）リサーチエンジン
// 企業URLだけを起点に、深掘り調査を行う：
//  - 実従業員数（gBizINFO 優先 / サイト記載 フォールバック）
//  - マーケティング実施状況（SNS / 問い合わせ導線 / MA・解析ツール / 広告痕跡）
//  - 実施中のマーケ・保有サイト/チャネル（公式サイト/オウンドメディアの所在・SNS・PR TIMES）
//    ※記事数・更新頻度は信頼できる取得が難しいため計測しない
// 外部HTTP取得は SSRF安全な共有ユーティリティ（@/lib/net/safe-fetch）経由。
// ============================================
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { scrapeCompanyWebsite } from '@/lib/doyalist/collect/web-scraper'
import { searchGbizInfo } from '@/lib/doyalist/collect/gbizinfo'
import type { CompanyResearch, PressRelease } from './types'

// ---- HTMLユーティリティ ----
function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeEntities(og[1].trim())
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t?.[1]) return decodeEntities(t[1].trim())
  return undefined
}
function extractOgImage(html: string, baseUrl: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!m?.[1]) return null
  try { return new URL(m[1].trim(), baseUrl).toString() } catch { return null }
}
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}
function extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = []
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  let base: URL
  try { base = new URL(baseUrl) } catch { return out }
  while ((m = re.exec(html)) && out.length < 400) {
    let href = m[1].trim()
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    try { href = new URL(href, base).toString() } catch { continue }
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 60)
    out.push({ href, text })
  }
  return out
}
function sameHost(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, '')
    const hb = new URL(b).hostname.replace(/^www\./, '')
    return ha === hb || ha.endsWith('.' + hb) || hb.endsWith('.' + ha)
  } catch { return false }
}

// ---- マーケティング実施状況の検出 ----
function detectMarketing(html: string, links: { href: string; text: string }[]) {
  const lower = html.toLowerCase()
  const snsMap: { key: string; label: string }[] = [
    { key: 'twitter.com', label: 'X(Twitter)' }, { key: 'x.com/', label: 'X(Twitter)' },
    { key: 'facebook.com', label: 'Facebook' }, { key: 'instagram.com', label: 'Instagram' },
    { key: 'youtube.com', label: 'YouTube' }, { key: 'youtu.be', label: 'YouTube' },
    { key: 'linkedin.com', label: 'LinkedIn' }, { key: 'note.com', label: 'note' },
    { key: 'tiktok.com', label: 'TikTok' }, { key: 'line.me', label: 'LINE' },
  ]
  const snsChannels = Array.from(new Set(snsMap.filter((s) => lower.includes(s.key)).map((s) => s.label)))

  const martech: { key: string | RegExp; label: string }[] = [
    { key: 'googletagmanager.com', label: 'Google Tag Manager' },
    { key: 'google-analytics.com', label: 'Google Analytics' },
    { key: 'gtag(', label: 'Google Analytics(GA4)' },
    { key: 'js.hs-scripts.com', label: 'HubSpot' }, { key: 'hs-analytics', label: 'HubSpot' },
    { key: 'munchkin.marketo', label: 'Marketo' }, { key: 'pardot', label: 'Pardot' },
    { key: 'salesforce', label: 'Salesforce' }, { key: 'ptengine', label: 'Ptengine' },
    { key: 'facebook.net/en_us/fbevents', label: 'Meta Pixel' }, { key: 'fbq(', label: 'Meta Pixel' },
    { key: 'clarity.ms', label: 'Microsoft Clarity' }, { key: 'karte.io', label: 'KARTE' },
  ]
  const martechTools = Array.from(new Set(martech.filter((t) => (typeof t.key === 'string' ? lower.includes(t.key) : t.key.test(lower))).map((t) => t.label)))

  const formKeywords = ['お問い合わせ', 'お問合せ', 'contact', '資料請求', '無料相談', 'お見積', 'デモ', 'トライアル']
  const hasContactForm = formKeywords.some((k) => lower.includes(k.toLowerCase())) || /<form[\s>]/i.test(html)
  const magnetKeywords = ['資料ダウンロード', '資料dl', 'ホワイトペーパー', 'whitepaper', 'メルマガ', 'ニュースレター', 'newsletter', '無料ダウンロード', 'eブック', 'ebook']
  const hasLeadMagnet = magnetKeywords.some((k) => lower.includes(k.toLowerCase()))
  const runsAds = lower.includes('googleads') || lower.includes('googlesyndication') || lower.includes('doubleclick') || lower.includes('gclid') || martechTools.includes('Meta Pixel')

  const bits: string[] = []
  bits.push(snsChannels.length ? `SNS ${snsChannels.length}媒体運用` : 'SNS露出は確認できず')
  bits.push(martechTools.length ? `計測/MA ${martechTools.length}種導入` : '計測タグ未検出')
  if (hasContactForm) bits.push('問い合わせ導線あり')
  if (hasLeadMagnet) bits.push('リード獲得施策あり')
  if (runsAds) bits.push('広告運用の痕跡あり')
  const summary = bits.join(' / ')

  return { snsChannels, hasContactForm, hasLeadMagnet, martechTools, runsAds, summary }
}

// ---- オウンドメディア検出＆規模・更新頻度 ----
const MEDIA_PATH_KEYS = ['blog', 'news', 'column', 'columns', 'magazine', 'media', 'topics', 'archives', 'journal', 'article', 'articles', 'press', 'pickup', 'knowledge', 'insight', 'report', 'case', 'voice']
function findMediaUrls(links: { href: string; text: string }[], baseUrl: string): string[] {
  const out = new Set<string>()
  for (const { href, text } of links) {
    if (!sameHost(href, baseUrl)) continue
    let path = ''
    try { path = new URL(href).pathname.toLowerCase() } catch { continue }
    const hitPath = MEDIA_PATH_KEYS.some((k) => path.split('/').includes(k) || path.includes(`/${k}/`) || path.endsWith(`/${k}`))
    const hitText = /ブログ|ニュース|コラム|お知らせ|記事|メディア|事例|プレス|読み物/.test(text)
    if (hitPath || hitText) out.add(href.split('#')[0])
  }
  return Array.from(out).slice(0, 4)
}
// オウンドメディア/関連サイトの「有無と所在」だけを収集する。
// ※記事数・更新頻度は信頼できる取得が難しいため計測しない（仕様変更）。
function summarizeOwnedMedia(mediaUrls: string[]) {
  // 記事数・更新頻度・規模は信頼できる取得が難しいため計測しない（所在＝mediaUrls のみ収集）。
  return {
    hasOwnedMedia: mediaUrls.length > 0,
    mediaUrls,
    articleCountEstimate: 0,
    latestArticleDate: null as string | null,
    updateFrequency: 'unknown' as CompanyResearch['ownedMedia']['updateFrequency'],
    frequencyNote: '記事数・更新頻度は信頼できる取得が難しいため計測していません',
    siteScale: 'unknown' as CompanyResearch['ownedMedia']['siteScale'],
  }
}

// ---- PR TIMES からプレスリリース（市場・企業動向）を収集 ----
function parsePrtimes(html: string): PressRelease[] {
  const out: PressRelease[] = []
  const seen = new Set<string>()
  // リリース詳細リンク: /main/html/rd/p/000000123.000012345.html
  const re = /\/main\/html\/rd\/p\/\d+\.\d+\.html/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 12) {
    const path = m[0]
    const url = 'https://prtimes.jp' + path
    if (seen.has(url)) continue
    seen.add(url)
    // 周辺ウィンドウからタイトル・画像・日付を拾う
    const start = Math.max(0, m.index - 900)
    const win = html.slice(start, m.index + 900)
    // 画像（lazy対応）
    const img = win.match(/(?:data-src|data-original|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1]
      || win.match(/(?:data-src|src)=["'](https?:\/\/(?:prcdn|prtimes|images\.prtimes)[^"']+)["']/i)?.[1]
    // タイトル（aタグのテキスト or alt or title属性）
    let title = ''
    const aTextRe = new RegExp(`<a[^>]+href=["'][^"']*${path.replace(/[.]/g, '\\.')}["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i')
    const aText = html.match(aTextRe)?.[1]
    if (aText) title = decodeEntities(aText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    if (!title) title = decodeEntities((win.match(/alt=["']([^"']{8,})["']/i)?.[1] || win.match(/title=["']([^"']{8,})["']/i)?.[1] || '').trim())
    if (!title) continue
    const date = win.match(/(20\d{2})[年.\-/](\d{1,2})[月.\-/](\d{1,2})/)?.[0]?.replace(/[年月]/g, '-').replace(/日/g, '') || null
    out.push({ title: title.slice(0, 120), url, date, image: img || null, source: 'PR TIMES' })
  }
  return out
}

async function researchPressReleases(companyName: string | undefined): Promise<PressRelease[]> {
  if (!companyName) return []
  const name = companyName.replace(/[|｜\-–—].*$/, '').trim().slice(0, 40)
  if (!name) return []
  const urls = [
    `https://prtimes.jp/main/html/searchrlp/company_name/${encodeURIComponent(name)}`,
    `https://prtimes.jp/main/action.php?run=html&page=searchkey&search_word=${encodeURIComponent(name)}`,
  ]
  for (const u of urls) {
    const html = await safeFetchText(u, { timeoutMs: 9000 }).catch(() => null)
    if (!html) continue
    const items = parsePrtimes(html)
    if (items.length) return items.slice(0, 8)
  }
  return []
}

// ---- gBizINFO で実従業員数などの公的データを引く ----
async function lookupGbiz(companyName: string | undefined, targetUrl: string) {
  if (!companyName) return null
  const cleaned = companyName.replace(/[|｜\-–—].*$/, '').trim().slice(0, 40)
  if (!cleaned) return null
  const r = await searchGbizInfo({ keyword: cleaned, limit: 20 }).catch(() => null)
  if (!r || !r.companies.length) return null
  const byUrl = r.companies.find((c) => c.companyUrl && sameHost(c.companyUrl, targetUrl))
  return byUrl || r.companies.find((c) => c.name.includes(cleaned) || cleaned.includes(c.name.replace(/^(株式会社|有限会社|合同会社)/, ''))) || r.companies[0]
}

function parseEmployee(s?: string | null): number | null {
  if (!s) return null
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 企業URLを起点に深掘り調査を実行して CompanyResearch を返す。
 * 失敗しても可能な範囲で部分結果を返す（throwしない）。
 */
export async function researchCompany(targetUrl: string): Promise<CompanyResearch> {
  // ホームページは一度だけ取得し、リンク抽出・マーケ検出・会社情報抽出で共有する
  const homepage = await safeFetchText(targetUrl, { timeoutMs: 12000 })
  const links = homepage ? extractLinks(homepage, targetUrl) : []
  const titleName = homepage ? extractTitle(homepage) : undefined

  // 取得済みHTMLを渡して二重取得を回避（会社名/事業内容/従業員数記載 等を抽出）
  const basic = await scrapeCompanyWebsite(targetUrl, homepage || undefined).catch(() => null)
  // オウンドメディア/関連サイトは「所在」だけ収集（記事数・更新頻度は計測しない）
  const mediaInfo = summarizeOwnedMedia(findMediaUrls(links, targetUrl))

  const companyName = basic?.companyName || titleName
  const [gbiz, pressReleases] = await Promise.all([
    lookupGbiz(companyName, targetUrl),
    researchPressReleases(companyName),
  ])

  const employeeFromGbiz = parseEmployee(gbiz?.employeeNumber)
  const employeeFromSite = parseEmployee(basic?.employeeCount)
  const employeeCount = employeeFromGbiz ?? employeeFromSite
  const employeeCountSource: CompanyResearch['employeeCountSource'] = employeeFromGbiz != null ? 'gbizinfo' : employeeFromSite != null ? 'website' : 'unknown'

  const marketing = detectMarketing(homepage || '', links)

  const research: CompanyResearch = {
    companyName: gbiz?.name || companyName,
    url: targetUrl,
    corporateNumber: gbiz?.corporateNumber,
    employeeCount,
    employeeCountSource,
    capital: gbiz?.capitalStock || basic?.capital || null,
    industry: gbiz?.industry || basic?.industry || null,
    foundedYear: gbiz?.foundingYear || gbiz?.dateOfEstablishment || (basic?.foundedYear ? String(basic.foundedYear) : null),
    address: gbiz?.address || basic?.address || null,
    representative: gbiz?.representativeName || basic?.representative || null,
    description: basic?.description || gbiz?.businessSummary || undefined,
    services: basic?.services || undefined,
    ogImage: homepage ? extractOgImage(homepage, targetUrl) : null,
    crawledUrls: Array.from(new Set([targetUrl, ...mediaInfo.mediaUrls])).slice(0, 5),
    pressReleases,
    marketing,
    ownedMedia: mediaInfo,
    rawNotes: homepage ? htmlToText(homepage).slice(0, 1500) : undefined,
  }
  return research
}
