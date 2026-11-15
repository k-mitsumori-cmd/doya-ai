// ============================================
// ドヤAIO：サイトの読み取り
// 入れた URL のサイトから、AI に渡す「サービスの内容」を作る。
// - 本文だけでなく title / meta description / OG / JSON-LD / 見出し / 画像の alt / ナビの文字を必ず抜き出す
// - 本文が少ないときは sitemap と内部リンクから、サービス・料金・会社のページを数ページ読む
// - 読めた量が足りないかどうかを判定する（足りないときは質問を作らずに止める）
// 取得は注入できる（テストでは保存した HTML を渡す）。JavaScript の描画は行わない。
// ============================================
import * as cheerio from 'cheerio'
import { safeFetchResource, decodeBody } from '@/lib/net/safe-fetch'

export type SiteSource = 'body' | 'meta' | 'subpages' | 'embedded'

export interface PageSignals {
  url: string
  title: string
  siteName: string
  description: string // meta description / og:description の長い方
  jsonLd: string[]
  headings: string[]
  imageAlts: string[]
  navTexts: string[]
  bodyText: string
  embeddedText: string[] // __NEXT_DATA__ / __NUXT_DATA__ などの文字列
  links: Array<{ href: string; text: string }>
}

export interface Readability {
  sufficient: boolean
  /** ok: 足りた。fetch_failed: 取得できない。too_little: 取得できたが内容が足りない */
  reason: 'ok' | 'fetch_failed' | 'too_little'
  bodyChars: number
  descriptionChars: number
  totalChars: number
  sources: SiteSource[]
}

export interface SiteRead {
  url: string
  pages: PageSignals[]
  readability: Readability
  /** AI に渡す文章（長さを制限済み） */
  context: string
  fetchFailure?: { reason: string; status?: number }
}

export interface PageFetch {
  html: string | null
  finalUrl: string
  failure?: { reason: string; status?: number }
}
export type PageFetcher = (url: string, kind: 'html' | 'xml') => Promise<PageFetch>

export const BODY_ENOUGH_CHARS = 400 // 本文がこれ以上あれば本文を主にする
export const DESCRIPTION_MIN_CHARS = 40 // meta の説明がこれ以上あれば、サービスの説明として使える
export const TOTAL_MIN_CHARS = 150 // 題名を除いた読み取れた文字の合計の下限
export const MAX_CONTEXT_CHARS = 7000
const MAX_SUBPAGES = 3

const clean = (s: string | undefined | null) => (s || '').replace(/\s+/g, ' ').trim()
const uniq = (xs: string[]) => Array.from(new Set(xs.map(clean).filter(Boolean)))

function metaContent($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const s of selectors) {
    const v = clean($(s).first().attr('content'))
    if (v) return v
  }
  return ''
}

function collectJsonLdText(raw: string): string[] {
  const out: string[] = []
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return
    if (Array.isArray(v)) { v.slice(0, 30).forEach(x => walk(x, depth + 1)); return }
    if (typeof v !== 'object') return
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (['name', 'description', 'headline', 'slogan', 'alternateName', 'serviceType', 'category'].includes(k) && typeof val === 'string') out.push(`${k}: ${val}`)
      else if (typeof val === 'object') walk(val, depth + 1)
    }
  }
  try { walk(JSON.parse(raw), 0) } catch { /* 壊れた JSON-LD は捨てる */ }
  return out
}

const looksLikeProse = (s: string) => s.length >= 20 && s.length <= 400 && /[ぁ-んァ-ヶ一-龠]/.test(s) && !/^https?:|^[\w./:#%-]+$/.test(s)

/** JSON を載せた script（Next / Nuxt の初期データ）から、文章らしい文字列だけを取り出す */
function collectEmbeddedText(raw: string): string[] {
  const out: string[] = []
  try {
    const walk = (v: unknown, depth: number) => {
      if (depth > 12 || out.length >= 40) return
      if (typeof v === 'string') { if (looksLikeProse(v)) out.push(v); return }
      if (Array.isArray(v)) { v.forEach(x => walk(x, depth + 1)); return }
      if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(x => walk(x, depth + 1))
    }
    walk(JSON.parse(raw), 0)
  } catch { /* 読めなければ無視 */ }
  return out
}

/** HTML 1ページから、AI に渡す手がかりをすべて抜き出す（純粋関数） */
export function extractPageSignals(html: string, pageUrl: string): PageSignals {
  const $ = cheerio.load(html)
  const title = clean($('title').first().text())
  const siteName = metaContent($, ['meta[property="og:site_name"]'])
  const descs = [
    metaContent($, ['meta[name="description"]']),
    metaContent($, ['meta[property="og:description"]']),
    metaContent($, ['meta[name="twitter:description"]']),
  ].filter(Boolean)
  const description = descs.sort((a, b) => b.length - a.length)[0] || ''

  const jsonLd: string[] = []
  $('script[type="application/ld+json"]').each((_, el) => { jsonLd.push(...collectJsonLdText($(el).contents().text())) })

  const embeddedText: string[] = []
  $('script[type="application/json"], script#__NEXT_DATA__').each((_, el) => { embeddedText.push(...collectEmbeddedText($(el).contents().text())) })

  const navTexts: string[] = []
  $('nav a, header a').each((_, el) => { const t = clean($(el).text()); if (t && t.length <= 40) navTexts.push(t) })

  const links: PageSignals['links'] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return
    try { links.push({ href: new URL(href, pageUrl).toString(), text: clean($(el).text()).slice(0, 80) }) } catch { /* 不正な href */ }
  })

  const headings: string[] = []
  $('h1, h2, h3').each((_, el) => { const t = clean($(el).text()); if (t) headings.push(t.slice(0, 160)) })
  const imageAlts: string[] = []
  $('img[alt]').each((_, el) => { const t = clean($(el).attr('alt')); if (t && t.length >= 4) imageAlts.push(t.slice(0, 120)) })

  $('script, style, noscript, template, svg').remove()
  const bodyText = clean($('body').text())

  return {
    url: pageUrl, title, siteName, description,
    jsonLd: uniq(jsonLd).slice(0, 20), headings: uniq(headings).slice(0, 40), imageAlts: uniq(imageAlts).slice(0, 30),
    navTexts: uniq(navTexts).slice(0, 30), bodyText, embeddedText: uniq(embeddedText).slice(0, 30), links,
  }
}

/** 題名と同じ文は「読み取れた中身」に数えない */
function distinctFrom(title: string, text: string): string {
  const t = clean(title), s = clean(text)
  return !s || s === t || t.includes(s) ? '' : s
}

export function judgeReadability(pages: PageSignals[], fetchFailed = false): Readability {
  if (!pages.length) return { sufficient: false, reason: fetchFailed ? 'fetch_failed' : 'too_little', bodyChars: 0, descriptionChars: 0, totalChars: 0, sources: [] }
  const top = pages[0]
  const sub = pages.slice(1)
  const bodyChars = pages.reduce((n, p) => n + distinctFrom(p.title, p.bodyText).length, 0)
  const descriptionChars = distinctFrom(top.title, top.description).length
  const extra = pages.reduce((n, p) => n + [...p.headings, ...p.jsonLd, ...p.embeddedText].filter(x => distinctFrom(p.title, x)).join('').length, 0)
  const totalChars = bodyChars + descriptionChars + extra
  const sources: SiteSource[] = []
  const bodyEnough = bodyChars >= BODY_ENOUGH_CHARS
  const subBody = sub.reduce((n, p) => n + distinctFrom(p.title, p.bodyText).length + distinctFrom(p.title, p.description).length, 0)
  if (bodyEnough) sources.push('body')
  if (descriptionChars >= DESCRIPTION_MIN_CHARS) sources.push('meta')
  if (subBody >= DESCRIPTION_MIN_CHARS) sources.push('subpages')
  if (pages.some(p => p.embeddedText.length)) sources.push('embedded')
  const sufficient = bodyEnough || descriptionChars >= DESCRIPTION_MIN_CHARS || (subBody >= BODY_ENOUGH_CHARS) || totalChars >= TOTAL_MIN_CHARS
  return { sufficient, reason: sufficient ? 'ok' : 'too_little', bodyChars, descriptionChars, totalChars, sources }
}

/** AI に渡す文章。meta 類を先頭に置き、本文は後ろに付ける（本文が長くても meta が切れない） */
export function buildServiceContext(pages: PageSignals[], maxChars = MAX_CONTEXT_CHARS): string {
  const parts: string[] = []
  pages.forEach((p, i) => {
    const lines: string[] = [`## ページ${i + 1}: ${p.url}`]
    if (p.title) lines.push(`題名: ${p.title}`)
    if (p.siteName && p.siteName !== p.title) lines.push(`サイト名: ${p.siteName}`)
    if (p.description) lines.push(`説明: ${p.description}`)
    if (p.jsonLd.length) lines.push(`構造化データ: ${p.jsonLd.join(' / ')}`)
    if (p.headings.length) lines.push(`見出し: ${p.headings.join(' / ')}`)
    if (p.navTexts.length) lines.push(`ナビ: ${p.navTexts.join(' / ')}`)
    if (p.imageAlts.length) lines.push(`画像の説明: ${p.imageAlts.join(' / ')}`)
    if (p.embeddedText.length) lines.push(`ページ内データの文: ${p.embeddedText.join(' / ')}`)
    const body = distinctFrom(p.title, p.bodyText)
    if (body) lines.push(`本文: ${body.slice(0, i === 0 ? 3500 : 1500)}`)
    parts.push(lines.join('\n'))
  })
  return parts.join('\n\n').slice(0, maxChars)
}

const PAGE_HINTS = [/service|services|サービス/i, /price|pricing|plan|料金|費用/i, /about|company|corporate|会社|概要|企業/i, /product|features?|機能|特長|強み/i, /case|事例|実績|faq/i]

export function pickSubpageCandidates(top: PageSignals, sitemapUrls: string[], limit = MAX_SUBPAGES): string[] {
  let origin: string
  try { origin = new URL(top.url).origin } catch { return [] }
  const seen = new Set<string>([top.url.replace(/\/$/, '')])
  const scored: Array<{ url: string; score: number }> = []
  const add = (raw: string, text: string) => {
    let u: URL
    try { u = new URL(raw) } catch { return }
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) return
    u.hash = ''
    const key = u.toString().replace(/\/$/, '')
    if (seen.has(key) || /\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|xml)$/i.test(u.pathname)) return
    if (/thanks|thank-you|privacy|terms|login|signin|404|tokushoho|policy|contact/i.test(u.pathname)) return
    seen.add(key)
    const hay = decodeURIComponent(u.pathname) + ' ' + text
    scored.push({ url: u.toString(), score: PAGE_HINTS.reduce((n, re, i) => n + (re.test(hay) ? 10 - i : 0), 0) })
  }
  top.links.forEach(l => add(l.href, l.text))
  sitemapUrls.forEach(u => add(u, ''))
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.url)
}

export function parseSitemapLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map(m => m[1].replace(/&amp;/g, '&')).slice(0, 200)
}

/** 既定の取得。SSRF 対策つきの共通の取得（safeFetchResource）を使う。 */
export const defaultPageFetcher: PageFetcher = async (url, kind) => {
  let failure: PageFetch['failure']
  const res = await safeFetchResource(url, {
    timeoutMs: 12_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 4,
    ...(kind === 'xml' ? { accept: 'application/xml,text/xml,text/plain,*/*' } : {}),
    onFailure: f => { failure = f },
  })
  if (!res) return { html: null, finalUrl: url, failure: failure || { reason: 'network' } }
  return { html: decodeBody(res.body, res.contentType), finalUrl: res.url }
}

export async function readSiteForAio(url: string, fetcher: PageFetcher = defaultPageFetcher): Promise<SiteRead> {
  const first = await fetcher(url, 'html')
  if (first.html === null) {
    return { url, pages: [], readability: judgeReadability([], true), context: '', fetchFailure: first.failure }
  }
  const top = extractPageSignals(first.html, first.finalUrl)
  const pages: PageSignals[] = [top]

  // 本文が少ないときだけ、sitemap と内部リンクから数ページ読む
  if (distinctFrom(top.title, top.bodyText).length < BODY_ENOUGH_CHARS) {
    const sitemapUrls: string[] = []
    try {
      const origin = new URL(first.finalUrl).origin
      const idx = await fetcher(`${origin}/sitemap.xml`, 'xml')
      if (idx.html) {
        const locs = parseSitemapLocs(idx.html)
        const children = locs.filter(l => /\.xml(\?|$)/i.test(l)).slice(0, 2)
        sitemapUrls.push(...locs.filter(l => !/\.xml(\?|$)/i.test(l)))
        for (const child of children) {
          const c = await fetcher(child, 'xml')
          if (c.html) sitemapUrls.push(...parseSitemapLocs(c.html))
        }
      }
    } catch { /* sitemap が無くても続ける */ }
    for (const next of pickSubpageCandidates(top, sitemapUrls)) {
      const r = await fetcher(next, 'html')
      if (r.html) pages.push(extractPageSignals(r.html, r.finalUrl))
    }
  }
  return { url, pages, readability: judgeReadability(pages), context: buildServiceContext(pages) }
}

export const UNREADABLE_MESSAGE = 'サービスの内容を読み取れませんでした。サイトの文字が少ないか、取得できない作りのため、サービスの説明を入力してください。'
export function unreadableDetail(read: SiteRead): string {
  const f = read.fetchFailure
  if (read.readability.reason === 'fetch_failed') {
    const why = f?.status ? `サイトから HTTP ${f.status} が返りました` : f?.reason === 'content_type' ? 'HTML ではないファイルでした' : f?.reason === 'body' ? 'ページが大きすぎて読み込めませんでした' : f?.reason === 'timeout' ? '時間内に取得できませんでした' : 'サイトを取得できませんでした'
    return `${why}。`
  }
  return `読み取れた文字は題名を除いて${read.readability.totalChars}文字でした。`
}
