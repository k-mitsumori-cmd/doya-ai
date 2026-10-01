/**
 * URL からHTMLを取得し、テキストを抽出する
 */
import { safeFetchText } from '@/lib/net/safe-fetch'

export type ExtractedPage = {
  url: string
  title: string
  description: string
  text: string
  headings: string[]
}

/**
 * URLからHTMLを取得し、テキストとメタデータを抽出する
 */
export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  try {
    // The shared fetcher validates and pins DNS on every redirect, then bounds
    // the decompressed HTML body. A failed or rejected reference stays empty.
    const html = await safeFetchText(url, { timeoutMs: 30_000, maxBytes: 4 * 1024 * 1024 })
    if (html !== null) return parseHtml(url, html)
  } catch {
    // Keep research jobs running when a reference cannot be fetched.
  }
  return { url, title: '', description: '', text: '', headings: [] }
}

/**
 * HTMLからテキストとメタデータを抽出
 */
function parseHtml(url: string, html: string): ExtractedPage {
  // タイトル抽出
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : ''

  // description抽出
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
  const description = descMatch ? decodeEntities(descMatch[1].trim()) : ''

  // 見出し抽出
  const headingMatches = html.matchAll(/<h([1-6])[^>]*>([^<]+)<\/h\1>/gi)
  const headings: string[] = []
  for (const m of headingMatches) {
    const text = decodeEntities(m[2].trim())
    if (text) headings.push(text)
  }

  // 本文テキスト抽出（簡易版）
  let text = html
    // script, style, headを除去
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // タグを除去
    .replace(/<[^>]+>/g, ' ')
    // エンティティをデコード
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    // 連続空白を整理
    .replace(/\s+/g, ' ')
    .trim()

  // 長すぎる場合は切り詰め
  if (text.length > 50000) {
    text = text.slice(0, 50000) + '...'
  }

  return {
    url,
    title,
    description,
    text,
    headings: headings.slice(0, 50),
  }
}

/**
 * HTMLエンティティをデコード
 */
function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
