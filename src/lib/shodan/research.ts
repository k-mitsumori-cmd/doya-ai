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
function extractDates(html: string): string[] {
  // 単一パスで「年(月)(日)」を抽出。日があればYMD、無ければその月の1日扱い。
  // 1正規表現で1出現＝1件なので、同一日付の二重カウントは起きない。
  // 重複（出現回数）は保持する（1日複数投稿の頻度を正しく数えるため）。
  // - 前後を数字境界で区切り、電話番号/連番(例 03-2024-1234)を日付と誤検出しない
  // - 実在しない暦日(例 2024-02-31)は除外
  // - 未来日は記事更新の指標にしない
  const dates: string[] = []
  const re = /(?<!\d)(20\d{2})[.\-/年](\d{1,2})(?:[.\-/月](\d{1,2})日?)?(?!\d)/g
  const todayTs = Date.now() + 86400000 // 当日のタイムゾーン差を許容する余白
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const y = Number(m[1]); const mo = Number(m[2] || '1'); const d = Number(m[3] || '1')
    if (y < 2005 || y > 2100 || mo < 1 || mo > 12 || d < 1) continue
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate() // 当月の末日
    if (d > daysInMonth) continue // 実在しない日付を除外
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ts = new Date(iso + 'T00:00:00Z').getTime()
    if (!Number.isFinite(ts) || ts > todayTs) continue
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
  const hasOwnedMedia = mediaUrls.length > 0

  // 規模は「実際に見つかった記事リンク数」を主指標にする
  let siteScale: CompanyResearch['ownedMedia']['siteScale'] = 'unknown'
  if (articleCountEstimate >= 40) siteScale = 'large'
  else if (articleCountEstimate >= 12) siteScale = 'medium'
  else if (articleCountEstimate > 0) siteScale = 'small'
  else siteScale = hasOwnedMedia ? 'small' : 'unknown'

  // 更新頻度は記事の“実数”と整合させる（日付だけで頻度を誇張しない）。
  // recentN は「直近1年の日付出現数」を「実際に見つかった記事数」で頭打ちにする＝矛盾防止。
  const now = Date.now()
  let updateFrequency: CompanyResearch['ownedMedia']['updateFrequency'] = 'unknown'
  let frequencyNote = hasOwnedMedia ? 'メディアは確認できたが、記事数・日付を十分に取得できず頻度は判定不可' : 'オウンドメディア（ブログ/ニュース）は確認できず'
  if (articleCountEstimate > 0 && latestArticleDate) {
    const daysSince = Math.floor((now - new Date(latestArticleDate + 'T00:00:00Z').getTime()) / 86400000)
    const lastYearDates = allDates.filter((d) => now - new Date(d + 'T00:00:00Z').getTime() < 365 * 86400000).length
    const recentN = Math.min(lastYearDates, articleCountEstimate) // 記事数を超える頻度主張をしない
    if (daysSince > 365) { updateFrequency = 'inactive'; frequencyNote = `最新記事が約${Math.floor(daysSince / 30)}ヶ月前。更新はほぼ停止` }
    else if (recentN >= 12 && daysSince <= 45) { updateFrequency = 'high'; frequencyNote = `直近1年で約${recentN}本・最新${daysSince}日前。活発に更新` }
    else if (recentN >= 4 || daysSince <= 120) { updateFrequency = 'medium'; frequencyNote = `直近1年で約${recentN}本・最新${daysSince}日前。月1回程度の更新` }
    else { updateFrequency = 'low'; frequencyNote = `直近1年で約${recentN}本・最新${daysSince}日前。更新は散発的` }
  }

  return {
    hasOwnedMedia,
    mediaUrls,
    articleCountEstimate,
    latestArticleDate,
    updateFrequency,
    frequencyNote,
    siteScale,
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
  // メディア解析は並行で実行
  const [basic, mediaInfo] = await Promise.all([
    scrapeCompanyWebsite(targetUrl, homepage || undefined).catch(() => null),
    analyzeOwnedMedia(findMediaUrls(links, targetUrl), targetUrl),
  ])

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
