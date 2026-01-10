type SerpApiOrganicResult = {
  position?: number
  title?: string
  link?: string
  displayed_link?: string
  snippet?: string
  snippet_highlighted_words?: string[]
}

type SerpApiResponse = {
  search_metadata?: { status?: string }
  organic_results?: SerpApiOrganicResult[]
}

function getSerpApiKey(): string {
  const key = process.env.SEO_SERPAPI_KEY || process.env.SERPAPI_API_KEY || ''
  return String(key || '').trim()
}

export function hasSerpApiKey(): boolean {
  return !!getSerpApiKey()
}

function normalizeHttpUrl(u: string): string {
  const s = String(u || '').trim()
  if (!/^https?:\/\//i.test(s)) return ''
  try {
    const url = new URL(s)
    // tracking系を軽く削る
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

export async function serpapiSearchGoogle(args: {
  query: string
  gl?: 'jp' | 'us'
  hl?: 'ja' | 'en'
  num?: number
  start?: number
}): Promise<{ organic: { title: string; url: string; snippet?: string }[] }> {
  const apiKey = getSerpApiKey()
  if (!apiKey) throw new Error('SerpAPI key not configured')

  const q = String(args.query || '').trim()
  if (!q) return { organic: [] }

  // SerpAPI(Google)は1回の検索で最大10件程度が安定（必要なら start でページングする）
  const num = Math.max(1, Math.min(10, Number(args.num || 10)))
  const start = Math.max(0, Number.isFinite(Number(args.start)) ? Math.floor(Number(args.start)) : 0)
  const gl = args.gl || 'jp'
  const hl = args.hl || 'ja'

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', q)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('num', String(num))
  if (start) url.searchParams.set('start', String(start))
  url.searchParams.set('hl', hl)
  url.searchParams.set('gl', gl)
  url.searchParams.set('safe', 'active')

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' as any })
  const json = (await res.json().catch(() => ({}))) as SerpApiResponse
  if (!res.ok) {
    throw new Error(`SerpAPI error: ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }

  const organic = (json.organic_results || [])
    .map((r) => {
      const title = String(r.title || '').trim()
      const url = normalizeHttpUrl(String(r.link || ''))
      const snippet = String(r.snippet || '').trim()
      return { title, url, snippet }
    })
    .filter((x) => x.title && x.url)

  // 重複排除（URL単位）
  const seen = new Set<string>()
  const uniq: { title: string; url: string; snippet?: string }[] = []
  for (const x of organic) {
    if (seen.has(x.url)) continue
    seen.add(x.url)
    uniq.push(x)
  }

  return { organic: uniq }
}


