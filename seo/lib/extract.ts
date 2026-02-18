/**
 * URL からHTMLを取得し、テキストを抽出する
 */

export type ExtractedPage = {
  url: string
  title: string
  description: string
  text: string
  headings: string[]
}

/**
 * SSRF対策: プライベートIP/localhost/非HTTPプロトコルをブロック
 */
function isUnsafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    // http/httpsのみ許可
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true
    const host = u.hostname.toLowerCase()
    // localhost
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '0.0.0.0') return true
    // プライベートIPレンジ
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return true
    // AWS/GCPメタデータ
    if (host === '169.254.169.254' || host === 'metadata.google.internal') return true
    return false
  } catch {
    return true
  }
}

/**
 * URLからHTMLを取得し、テキストとメタデータを抽出する
 */
export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  // SSRF対策
  if (isUnsafeUrl(url)) {
    return { url, title: '', description: '', text: '', headings: [] }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DoyaSEO/1.0; +https://doya-ai.surisuta.jp)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.5',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const html = await res.text()
    return parseHtml(url, html)
  } catch (e: any) {
    // フェッチ失敗時は空の結果を返す
    return {
      url,
      title: '',
      description: '',
      text: '',
      headings: [],
    }
  } finally {
    clearTimeout(timeout)
  }
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

