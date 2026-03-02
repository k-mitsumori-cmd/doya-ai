// ============================================
// ドヤ展開AI — URLスクレイピング
// ============================================
// cheerio + @mozilla/readability でURL本文を抽出

import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const SCRAPE_TIMEOUT = 10_000 // 10秒

export interface ScrapeResult {
  title: string
  content: string
  wordCount: number
  language: string
  images?: string[]
  robotsWarning?: string
}

/**
 * 内部ネットワーク・プライベートIPへのアクセスを防止 (SSRF対策)
 */
function validateUrlSafety(url: string): void {
  const parsed = new URL(url)
  const hostname = parsed.hostname.toLowerCase()
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']
  const blockedPrefixes = [
    '169.254.', '10.', '192.168.',
    '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
    '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
    '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  ]
  if (blockedHosts.includes(hostname)) {
    throw new Error('内部ネットワークのURLにはアクセスできません')
  }
  for (const prefix of blockedPrefixes) {
    if (hostname.startsWith(prefix)) {
      throw new Error('内部ネットワークのURLにはアクセスできません')
    }
  }
  // Additional SSRF protections
  if (/^0x/i.test(hostname) || /^0\d/.test(hostname) || /^\d+$/.test(hostname)) {
    throw new Error('内部ネットワークのURLにはアクセスできません')
  }
  if (hostname.includes('::') || hostname.includes('ffff:')) {
    throw new Error('内部ネットワークのURLにはアクセスできません')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('HTTP/HTTPS以外のプロトコルは使用できません')
  }
}

/**
 * URLからコンテンツを抽出
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // SSRF対策
  validateUrlSafety(url)

  // robots.txt チェック（警告のみ、ブロックしない）
  const robotsWarning = await checkRobotsTxt(url)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DoyaAI-Bot/1.0 (+https://doyaai.com)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`)
    }

    const html = await response.text()

    // Readabilityで本文抽出
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    // cheerioで画像とメタ情報を抽出
    const $ = cheerio.load(html)
    const metaLang =
      $('html').attr('lang') ||
      $('meta[http-equiv="Content-Language"]').attr('content') ||
      'ja'
    const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text()

    const images: string[] = []
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src')
      if (src && !src.startsWith('data:')) {
        try {
          const absUrl = new URL(src, url).href
          images.push(absUrl)
        } catch {
          // skip invalid URLs
        }
      }
    })

    const title = article?.title || metaTitle || ''
    const content = article?.textContent || ''
    const wordCount = content.length // 日本語は文字数ベース

    if (!content || content.trim().length < 50) {
      throw new Error('ページからテキストを抽出できませんでした。URLを確認してください。')
    }

    return {
      title: title.trim(),
      content: content.trim(),
      wordCount,
      language: metaLang.split('-')[0].toLowerCase(),
      images: images.slice(0, 10),
      ...(robotsWarning ? { robotsWarning } : {}),
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * robots.txt を確認してクロール許可を検証
 * ブロックせず警告メッセージを返す
 */
async function checkRobotsTxt(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url)
    const robotsUrl = `${parsed.origin}/robots.txt`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    try {
      const res = await fetch(robotsUrl, { signal: controller.signal })
      if (!res.ok) return null // robots.txt がなければ許可

      const text = await res.text()
      const lines = text.split('\n')

      let isRelevantAgent = false
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase()
        if (trimmed.startsWith('user-agent:')) {
          const agent = trimmed.replace('user-agent:', '').trim()
          isRelevantAgent = agent === '*' || agent === 'doyaai-bot'
        }
        if (isRelevantAgent && trimmed.startsWith('disallow:')) {
          const path = trimmed.replace('disallow:', '').trim()
          if (path === '/' || (path && parsed.pathname.startsWith(path))) {
            return 'このサイトはrobots.txtでクロールを制限しています。コンテンツの利用にはご注意ください。'
          }
        }
      }
      return null
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    // robots.txt の取得失敗は無視（許可とみなす）
    return null
  }
}
