// ============================================
// ドヤオープニングAI - サイト解析エンジン
// ============================================

import * as cheerio from 'cheerio'

export interface SiteAnalysis {
  url: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    palette: string[]
  }
  logo: {
    url: string | null
    base64: string | null
    alt: string | null
  }
  texts: {
    title: string
    description: string
    h1: string | null
    tagline: string | null
  }
  brand: {
    name: string
    industry: string
    tone: string
    favicon: string | null
  }
  ogp: {
    image: string | null
    title: string | null
    description: string | null
  }
}

/**
 * URLからサイト情報を解析
 */
export async function analyzeSite(url: string): Promise<SiteAnalysis> {
  // HTML取得
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  // 基本情報抽出
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || ''
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || ''
  const h1 = $('h1').first().text().trim() || null

  // OGP情報
  const ogImage = $('meta[property="og:image"]').attr('content') || null
  const ogTitle = $('meta[property="og:title"]').attr('content') || null
  const ogDescription = $('meta[property="og:description"]').attr('content') || null

  // ロゴ検出
  const logo = detectLogo($, url)

  // カラー抽出
  const colors = extractColors($, html)

  // ファビコン
  const favicon = detectFavicon($, url)

  // ブランド名推定
  const brandName = ogTitle?.split(/[|–—-]/)[0]?.trim() || title.split(/[|–—-]/)[0]?.trim() || new URL(url).hostname

  return {
    url,
    colors,
    logo,
    texts: {
      title,
      description,
      h1,
      tagline: null, // AI補完で設定
    },
    brand: {
      name: brandName,
      industry: '', // AI補完で設定
      tone: 'professional', // AI補完で設定
      favicon,
    },
    ogp: {
      image: ogImage ? resolveUrl(ogImage, url) : null,
      title: ogTitle,
      description: ogDescription,
    },
  }
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DoyaBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`)
    return await res.text()
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`URL fetch timeout (10s): ${url}`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

function detectLogo($: cheerio.CheerioAPI, baseUrl: string): SiteAnalysis['logo'] {
  // 一般的なロゴセレクタを試行
  const selectors = [
    'header img[src*="logo"]',
    'img[alt*="logo" i]',
    'img[class*="logo" i]',
    'a[class*="logo" i] img',
    'header a:first-child img',
    '.logo img',
    '#logo img',
  ]

  for (const sel of selectors) {
    const el = $(sel).first()
    if (el.length) {
      const src = el.attr('src')
      if (src) {
        return {
          url: resolveUrl(src, baseUrl),
          base64: null,
          alt: el.attr('alt') || null,
        }
      }
    }
  }

  // SVGロゴ検出
  const svgLogo = $('header svg').first()
  if (svgLogo.length) {
    const svgHtml = $.html(svgLogo)
    return {
      url: null,
      base64: Buffer.from(svgHtml).toString('base64'),
      alt: 'SVG Logo',
    }
  }

  return { url: null, base64: null, alt: null }
}

function extractColors($: cheerio.CheerioAPI, html: string): SiteAnalysis['colors'] {
  const colorSet = new Set<string>()

  // CSS変数からカラーを抽出
  const cssVarRegex = /--[\w-]*color[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/gi
  let match
  while ((match = cssVarRegex.exec(html)) !== null) {
    const color = normalizeColor(match[1])
    if (color) colorSet.add(color)
  }

  // インラインスタイルからカラーを抽出
  const inlineColorRegex = /(?:background-color|color|border-color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/gi
  while ((match = inlineColorRegex.exec(html)) !== null) {
    const color = normalizeColor(match[1])
    if (color) colorSet.add(color)
  }

  // meta theme-color
  const themeColor = $('meta[name="theme-color"]').attr('content')
  if (themeColor) {
    const c = normalizeColor(themeColor)
    if (c) colorSet.add(c)
  }

  const palette = Array.from(colorSet).slice(0, 10)

  // カラーの用途分類（ヒューリスティック）
  const sorted = palette.filter(c => c !== '#ffffff' && c !== '#000000')
  return {
    primary: sorted[0] || '#2563EB',
    secondary: sorted[1] || '#1E40AF',
    accent: sorted[2] || '#F59E0B',
    background: palette.find(c => isLightColor(c)) || '#FFFFFF',
    text: palette.find(c => isDarkColor(c)) || '#111827',
    palette,
  }
}

function detectFavicon($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const link = $('link[rel="icon"], link[rel="shortcut icon"]').first()
  const href = link.attr('href')
  if (href) return resolveUrl(href, baseUrl)
  return resolveUrl('/favicon.ico', baseUrl)
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

function normalizeColor(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('#')) {
    const hex = trimmed.toLowerCase()
    if (/^#[0-9a-f]{3}$/.test(hex)) {
      return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    }
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex
    if (/^#[0-9a-f]{8}$/.test(hex)) return hex.slice(0, 7)
  }
  if (trimmed.startsWith('rgb')) {
    const nums = trimmed.match(/\d+/g)
    if (nums && nums.length >= 3) {
      const r = parseInt(nums[0]).toString(16).padStart(2, '0')
      const g = parseInt(nums[1]).toString(16).padStart(2, '0')
      const b = parseInt(nums[2]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`
    }
  }
  return null
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 186
}

function isDarkColor(hex: string): boolean {
  return !isLightColor(hex)
}
