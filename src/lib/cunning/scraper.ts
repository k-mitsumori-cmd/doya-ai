// ============================================
// ドヤカンニング URL取り込み（軽量スクレイパー）
// ============================================
// ナレッジ取り込み・企業URL解析で共用。HTMLを取得し本文テキストへ素朴に変換する。
import { withTimeout } from '@/lib/fetch-timeout'

export interface ScrapeResult {
  url: string
  title: string
  text: string
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

/** URLを取得して本文テキスト化（最大 maxChars 文字）。 */
export async function scrapeUrl(url: string, maxChars = 12000): Promise<ScrapeResult> {
  if (!/^https?:\/\//i.test(url)) throw new Error('http(s) のURLを指定してください')
  const timeoutMs = Number(process.env.CUNNING_SCRAPE_TIMEOUT_MS) || 20000

  return withTimeout('scrapeUrl', timeoutMs, async (signal) => {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaCunning/1.0)' },
    })
    if (!res.ok) throw new Error(`URL取得に失敗しました (${res.status})`)
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : url
    const text = stripHtml(html).slice(0, maxChars)
    return { url, title, text }
  })
}
