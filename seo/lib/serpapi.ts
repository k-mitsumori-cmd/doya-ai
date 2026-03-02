type SerperOrganicResult = {
  position?: number
  title?: string
  link?: string
  snippet?: string
}

type SerperResponse = {
  organic?: SerperOrganicResult[]
  searchParameters?: { q?: string }
}

function getSearchApiKey(): string {
  const key = process.env.SERPER_API_KEY || process.env.SEO_SERPAPI_KEY || process.env.SERPAPI_API_KEY || ''
  return String(key || '').trim()
}

export function hasSerpApiKey(): boolean {
  return !!getSearchApiKey()
}

function normalizeHttpUrl(u: string): string {
  const s = String(u || '').trim()
  if (!/^https?:\/\//i.test(s)) return ''
  try {
    const url = new URL(s)
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
  const apiKey = getSearchApiKey()
  if (!apiKey) throw new Error('Search API key not configured (set SERPER_API_KEY)')

  const q = String(args.query || '').trim()
  if (!q) return { organic: [] }

  const num = Math.max(1, Math.min(10, Number(args.num || 10)))
  const start = Math.max(0, Number.isFinite(Number(args.start)) ? Math.floor(Number(args.start)) : 0)
  const gl = args.gl || 'jp'
  const hl = args.hl || 'ja'

  // Serper.dev API (POST + JSON body + X-API-KEY header)
  const endpoint = 'https://google.serper.dev/search'
  const body: Record<string, string | number> = { q, gl, hl, num }
  if (start) body.start = start

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(timer)
    if (e?.name === 'AbortError') throw new Error('Serper request timed out (30s)')
    throw e
  }
  clearTimeout(timer)
  const json = (await res.json().catch(() => ({}))) as SerperResponse
  if (!res.ok) {
    throw new Error(`Serper error: ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }

  const organic = (json.organic || [])
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
