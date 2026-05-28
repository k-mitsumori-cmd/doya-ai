/**
 * 企業名から公式URLを自動探索
 * - gBizINFO に URL がない企業向け
 * - SerpAPI (Google検索) → 最上位の信頼できる結果を採用
 * - 並列バッチで実行
 */

const SERPAPI_BASE = 'https://serpapi.com/search'

// 公式サイトとして採用しないドメイン（求人/ニュース/SNS/口コミ等）
const BLOCKED_DOMAINS = [
  'wikipedia.org', 'wikiwand.com',
  'baseconnect.in', 'musubu.in', 'salesnow.jp',
  'green-japan.com', 'rikunabi.com', 'mynavi.jp', 'doda.jp', 'en-japan.com',
  'wantedly.com', 'duda.jp', 'indeed.com', 'careerjet.jp',
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'youtube.com',
  'note.com', 'qiita.com', 'medium.com', 'hatena.ne.jp',
  'amazon.co.jp', 'amazon.com', 'rakuten.co.jp', 'mercari.com',
  'tabelog.com', 'gnavi.co.jp', 'hotpepper.jp', 'r.gnavi.co.jp',
  'mapion.co.jp', 'goo.ne.jp', 'navitime.co.jp',
  'gbiz.go.jp', 'go.jp',
  'pref.jp', 'lg.jp',
]

function isBlockedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return BLOCKED_DOMAINS.some((b) => host === b || host.endsWith('.' + b))
  } catch {
    return true
  }
}

/**
 * SerpAPI で企業名を Google 検索し、最も公式サイトらしい URL を返す
 */
export async function discoverCompanyUrl(companyName: string): Promise<string | null> {
  const apiKey = process.env.SEO_SERPAPI_KEY
  if (!apiKey || !companyName) return null

  const cleanName = companyName.trim()
  if (!cleanName) return null

  const url = new URL(SERPAPI_BASE)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', `${cleanName} 公式サイト`)
  url.searchParams.set('hl', 'ja')
  url.searchParams.set('gl', 'jp')
  url.searchParams.set('num', '5')
  url.searchParams.set('api_key', apiKey)

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null
    const data = await response.json()
    const results: any[] = data?.organic_results || []

    // 上位5件から公式サイトっぽいものを選択
    for (const r of results) {
      const link = String(r?.link || '')
      if (!link || !link.startsWith('http')) continue
      if (isBlockedDomain(link)) continue
      // ドメインがある程度短ければ公式サイトの可能性が高い
      try {
        const host = new URL(link).hostname.replace(/^www\./, '')
        // パスが深すぎる場合（記事ページ等）はスキップ
        const pathDepth = new URL(link).pathname.split('/').filter(Boolean).length
        if (pathDepth > 3) continue
        return `https://${host}`
      } catch {
        continue
      }
    }
    return null
  } catch (e) {
    console.warn(`[url-discovery] SerpAPI failed for "${cleanName}"`, e)
    return null
  }
}

/**
 * 複数企業のURL探索を並列実行
 * - concurrency: 並列数（SerpAPI rate limit対策で4並列推奨）
 * - budgetMs: 全体の wall-clock 予算
 */
export async function discoverCompanyUrlsBatch(
  companies: { id: string; name: string }[],
  options: { concurrency?: number; budgetMs?: number; signal?: AbortSignal } = {}
): Promise<Map<string, string>> {
  const concurrency = Math.max(1, Math.min(8, options.concurrency || 4))
  const budgetMs = options.budgetMs || 60000 // デフォルト 60秒
  const startTime = Date.now()
  const result = new Map<string, string>()
  const queue = [...companies]
  let processed = 0

  async function worker() {
    while (queue.length > 0) {
      if (options.signal?.aborted) return
      if (Date.now() - startTime > budgetMs) return
      const c = queue.shift()
      if (!c) continue
      const url = await discoverCompanyUrl(c.name)
      if (url) result.set(c.id, url)
      processed++
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  console.log(`[url-discovery] processed=${processed}/${companies.length}, found=${result.size}`)
  return result
}
