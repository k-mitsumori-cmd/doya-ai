// ============================================
// ドヤ商談準備（Shodan）リサーチエンジン
// 企業URLだけを起点に、深掘り調査を行う：
//  - 実従業員数（gBizINFO 優先 / サイト記載 フォールバック）
//  - マーケティング実施状況（SNS / 問い合わせ導線 / MA・解析ツール / 広告痕跡）
//  - オウンドメディア・サイト規模（ブログ/ニュースの有無・記事数・最新日・更新頻度）
// 外部HTTP取得は SSRF安全な共有ユーティリティ（@/lib/net/safe-fetch）経由。
// ============================================
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { scrapeCompanyWebsite } from '@/lib/doyalist/collect/web-scraper'
import { searchGbizInfo } from '@/lib/doyalist/collect/gbizinfo'
import type { CompanyResearch } from './types'

// ---- HTMLユーティリティ ----
function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeEntities(og[1].trim())
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t?.[1]) return decodeEntities(t[1].trim())
  return undefined
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
function extractDates(html: string): string[] {
  // 単一パスで「年(月)(日)」を抽出。日があればYMD、無ければその月の1日扱い。
  // 1正規表現で1出現＝1件なので、同一日付の二重カウントは起きない。
  // 重複（出現回数）は保持する（1日複数投稿の頻度を正しく数えるため）。未来日は除外。
  const dates: string[] = []
  const re = /(20\d{2})\s*[.\-/年]\s*(\d{1,2})\s*(?:[.\-/月]\s*(\d{1,2})\s*日?)?/g
  const todayTs = Date.now() + 86400000 // 当日のタイムゾーン差を許容する余白
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const y = Number(m[1]); const mo = Number(m[2] || '1'); const d = Number(m[3] || '1')
    if (y < 2005 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) continue
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ts = new Date(iso + 'T00:00:00Z').getTime()
    if (!Number.isFinite(ts) || ts > todayTs) continue // 未来日は記事更新の指標にしない
    dates.push(iso)
  }
  return dates
}
// 記事リンク判定：日付/記事系パス、または連番ID。ナビ/フッターの汎用リンクを除外。
function looksLikeArticleLink(href: string, baseUrl: string): boolean {
  if (!sameHost(href, baseUrl)) return false
  let p = ''
  try { p = new URL(href).pathname } catch { return false }
  return /\/\d{4}\/\d{1,2}\//.test(p) || /\/\d{4,}(?:[/.\-]|$)/.test(p) || /\/(post|posts|entry|entries|article|articles|news|blog|column|columns|story|stories)\/[^/]+/i.test(p)
}
async function analyzeOwnedMedia(mediaUrls: string[], baseUrl: string) {
  let articleCountEstimate = 0
  const allDates: string[] = []
  for (const url of mediaUrls.slice(0, 3)) {
    const html = await safeFetchText(url, { timeoutMs: 8000 })
    if (!html) continue
    const links = extractLinks(html, url)
    // 記事っぽいリンク（日付/記事系パス・連番ID）の数で記事量を概算（重複URLは除外）
    const articleLinks = Array.from(new Set(links.filter((l) => looksLikeArticleLink(l.href, baseUrl)).map((l) => l.href.split('#')[0].split('?')[0])))
    articleCountEstimate += articleLinks.length
    allDates.push(...extractDates(html))
  }
  const uniqueSorted = Array.from(new Set(allDates)).sort().reverse()
  const latestArticleDate = uniqueSorted[0] || null

  // 更新頻度：最新記事日の新しさ＋直近1年の日付出現“回数”（重複保持）で判定
  let updateFrequency: CompanyResearch['ownedMedia']['updateFrequency'] = 'unknown'
  let frequencyNote = '更新状況を判定できる日付情報が乏しい'
  if (latestArticleDate) {
    const latest = new Date(latestArticleDate + 'T00:00:00Z').getTime()
    const now = Date.now()
    const daysSince = Math.floor((now - latest) / 86400000)
    const lastYear = allDates.filter((d) => now - new Date(d + 'T00:00:00Z').getTime() < 365 * 86400000).length
    if (daysSince > 365) { updateFrequency = 'inactive'; frequencyNote = `最新記事が約${Math.floor(daysSince / 30)}ヶ月前。実質的に更新が止まっている可能性` }
    else if (lastYear >= 24 || daysSince <= 14) { updateFrequency = 'high'; frequencyNote = `直近1年で${lastYear}件前後を確認。週1ペースに近い活発さ` }
    else if (lastYear >= 8 || daysSince <= 60) { updateFrequency = 'medium'; frequencyNote = `直近1年で${lastYear}件前後。月1〜2回ペースの更新` }
    else { updateFrequency = 'low'; frequencyNote = `直近1年で${lastYear}件前後。更新は散発的` }
  }
  let siteScale: CompanyResearch['ownedMedia']['siteScale'] = 'unknown'
  if (articleCountEstimate >= 60) siteScale = 'large'
  else if (articleCountEstimate >= 20) siteScale = 'medium'
  else if (articleCountEstimate > 0 || mediaUrls.length > 0) siteScale = 'small'

  return {
    hasOwnedMedia: mediaUrls.length > 0,
    mediaUrls,
    articleCountEstimate,
    latestArticleDate,
    updateFrequency,
    frequencyNote,
    siteScale,
  }
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
  // メディア解析は並行で実行
  const [basic, mediaInfo] = await Promise.all([
    scrapeCompanyWebsite(targetUrl, homepage != null ? homepage : undefined).catch(() => null),
    analyzeOwnedMedia(findMediaUrls(links, targetUrl), targetUrl),
  ])

  const companyName = basic?.companyName || titleName
  const gbiz = await lookupGbiz(companyName, targetUrl)

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
    marketing,
    ownedMedia: mediaInfo,
    rawNotes: homepage ? htmlToText(homepage).slice(0, 1500) : undefined,
  }
  return research
}
