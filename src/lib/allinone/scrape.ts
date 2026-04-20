/**
 * ドヤマーケAI URL scrape モジュール
 * 軽量 fetch + cheerio で HTML を解析。puppeteer は使わない（コスト優先）。
 * JS レンダリングが必要なサイトは meta / OGP / head から推定する。
 */

import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { ScrapeResult } from './types'

const FETCH_TIMEOUT_MS = 15_000
const UA =
  'Mozilla/5.0 (compatible; DoyaMarkeAIBot/1.0; +https://doya-ai.surisuta.jp/allinone)'

export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let html = ''
  let finalUrl = url
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    finalUrl = res.url || url
    html = await res.text()
  } catch (err) {
    throw new Error(
      `サイトの取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!html) {
    throw new Error('サイトの HTML が空でした。アクセス制限の可能性があります。')
  }

  const $ = cheerio.load(html)
  const origin = new URL(finalUrl).origin

  // --- 基本メタ ---
  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || '').trim()
  const description = (
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    ''
  ).trim()
  const keywords = ($('meta[name="keywords"]').attr('content') || '').trim()
  const favicon = absoluteUrl(
    $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      '/favicon.ico',
    origin
  )
  const ogImage = absoluteUrl($('meta[property="og:image"]').attr('content'), origin)

  // --- 構造 ---
  const headings = {
    h1: textList($, 'h1'),
    h2: textList($, 'h2'),
    h3: textList($, 'h3'),
  }

  // --- 画像 ---
  const images: string[] = []
  $('img').each((_, el) => {
    const src =
      $(el).attr('src') ||
      $(el).attr('data-src') ||
      $(el).attr('data-lazy-src') ||
      ''
    if (src && !src.startsWith('data:')) {
      const abs = absoluteUrl(src, origin)
      if (abs) images.push(abs)
    }
  })

  const heroImage = estimateHeroImage($, origin) || ogImage || images[0]

  const mainImages = Array.from(new Set(images)).slice(0, 10)

  // --- リンク ---
  const internalLinks: string[] = []
  const externalLinks: string[] = []
  const socialLinks: { platform: string; url: string }[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
      return
    const abs = absoluteUrl(href, origin)
    if (!abs) return
    try {
      const u = new URL(abs)
      if (u.origin === origin) {
        internalLinks.push(abs)
      } else {
        externalLinks.push(abs)
        const sp = detectSocialPlatform(u.hostname)
        if (sp) socialLinks.push({ platform: sp, url: abs })
      }
    } catch {
      /* noop */
    }
  })

  // --- テキスト ---
  const bodyText = $('body')
    .clone()
    .find('script, style, noscript, svg')
    .remove()
    .end()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
  const textSample = bodyText.slice(0, 6000)
  const wordCount = bodyText.length // 日本語は文字数ベース

  // --- カラー & フォント推定（style/link から） ---
  const mainColors = extractColors(html)
  const fonts = extractFonts(html)

  // --- メタ要素チェック ---
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0
  const hasOgp = $('meta[property^="og:"]').length > 0
  const hasFavicon = !!favicon && favicon !== `${origin}/favicon.ico`
  const hasViewport = $('meta[name="viewport"]').length > 0
  const hasCanonical = $('link[rel="canonical"]').length > 0

  // --- analytics 推定 ---
  const analyticsPatterns = [
    'googletagmanager',
    'google-analytics',
    'gtag',
    'hotjar',
    'segment',
    'clarity',
    'matomo',
    'adobe',
    'karte',
  ]
  const hasAnalytics = analyticsPatterns.some((p) => html.toLowerCase().includes(p))

  // --- CTA 推定 ---
  const ctaTexts = new Set<string>()
  $('a, button').each((_, el) => {
    const text = $(el).text().trim()
    if (!text) return
    if (
      /(資料請求|無料相談|問い合わせ|contact|資料を|会員登録|新規登録|申込|trial|始める|ダウンロード|まずは|購入|予約|入会|見積|体験|デモ|資料|登録)/i.test(
        text
      )
    ) {
      ctaTexts.add(text.slice(0, 40))
    }
  })

  return {
    url,
    finalUrl,
    title,
    description,
    keywords,
    favicon,
    ogImage,
    heroImage,
    mainImages,
    headings,
    textSample,
    wordCount,
    mainColors,
    fonts,
    hasStructuredData,
    hasOgp,
    hasFavicon,
    hasViewport,
    hasCanonical,
    hasAnalytics,
    linkCount: internalLinks.length + externalLinks.length,
    imageCount: images.length,
    internalLinks: Array.from(new Set(internalLinks)).slice(0, 30),
    externalLinks: Array.from(new Set(externalLinks)).slice(0, 30),
    socialLinks: dedupeBy(socialLinks, (s) => s.url).slice(0, 8),
    hasCta: ctaTexts.size > 0,
    ctaTexts: Array.from(ctaTexts).slice(0, 12),
  }
}

// ============================================
// ヘルパー
// ============================================

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('URL が空です')
  let url = trimmed
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    return u.toString()
  } catch {
    throw new Error('URL の形式が正しくありません')
  }
}

function absoluteUrl(src: string | undefined, origin: string): string | undefined {
  if (!src) return undefined
  try {
    return new URL(src, origin).toString()
  } catch {
    return undefined
  }
}

function textList($: CheerioAPI, selector: string): string[] {
  const items: string[] = []
  $(selector).each((_, el) => {
    const t = $(el).text().trim()
    if (t) items.push(t.slice(0, 120))
  })
  return items.slice(0, 30)
}

function estimateHeroImage($: CheerioAPI, origin: string): string | undefined {
  const candidates: { src: string; score: number }[] = []
  const fvSelectors = [
    'header img',
    '.hero img',
    '.mv img',
    '[class*="hero" i] img',
    '[class*="firstview" i] img',
    '[class*="top" i] img',
    'main img:first-of-type',
    'img:first-of-type',
  ]
  for (const sel of fvSelectors) {
    $(sel).each((i, el) => {
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy-src') ||
        ''
      if (!src) return
      const abs = absoluteUrl(src, origin)
      if (abs) candidates.push({ src: abs, score: 10 - i })
    })
    if (candidates.length) break
  }
  const top = candidates.sort((a, b) => b.score - a.score)[0]
  return top?.src
}

function detectSocialPlatform(host: string): string | null {
  if (host.includes('twitter.com') || host.includes('x.com')) return 'x'
  if (host.includes('facebook.com')) return 'facebook'
  if (host.includes('instagram.com')) return 'instagram'
  if (host.includes('youtube.com')) return 'youtube'
  if (host.includes('line.me') || host.includes('line.biz')) return 'line'
  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('tiktok.com')) return 'tiktok'
  if (host.includes('note.com')) return 'note'
  if (host.includes('github.com')) return 'github'
  return null
}

function extractColors(html: string): string[] {
  const colors = new Set<string>()
  const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g
  const rgbRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi
  let m: RegExpExecArray | null
  while ((m = hexRegex.exec(html)) !== null) {
    const c = m[0].toLowerCase()
    if (c !== '#fff' && c !== '#000' && c !== '#ffffff' && c !== '#000000') colors.add(c)
  }
  while ((m = rgbRegex.exec(html)) !== null) {
    const hex = rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]))
    if (hex !== '#ffffff' && hex !== '#000000') colors.add(hex)
  }
  return Array.from(colors).slice(0, 12)
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>()
  const regex = /font-family:\s*([^;"}]+)/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    m[1]
      .split(',')
      .map((s) => s.trim().replace(/["']/g, ''))
      .filter(Boolean)
      .forEach((f) => {
        if (!/^(sans-serif|serif|monospace|cursive|fantasy|system-ui|inherit|var\()/i.test(f)) {
          fonts.add(f.slice(0, 48))
        }
      })
    if (fonts.size >= 8) break
  }
  return Array.from(fonts).slice(0, 8)
}

function dedupeBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of arr) {
    const k = keyFn(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}
