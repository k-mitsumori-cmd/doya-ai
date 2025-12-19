function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  return decodeHtmlEntities(stripTags(m[1])).slice(0, 200)
}

function extractHeadings(html: string): { h2: string[]; h3: string[] } {
  const h2: string[] = []
  const h3: string[] = []
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const t = decodeHtmlEntities(stripTags(m[1]))
    if (t) h2.push(t.slice(0, 200))
  }
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const t = decodeHtmlEntities(stripTags(m[1]))
    if (t) h3.push(t.slice(0, 200))
  }
  return { h2: Array.from(new Set(h2)).slice(0, 50), h3: Array.from(new Set(h3)).slice(0, 80) }
}

export async function fetchAndExtract(url: string): Promise<{
  url: string
  title: string | null
  text: string
  headings: { h2: string[]; h3: string[] }
}> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; DoyaSeoBot/1.0; +https://example.invalid) AppleWebKit/537.36 (KHTML, like Gecko)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  const html = await res.text()
  const title = extractTitle(html)
  const headings = extractHeadings(html)

  // ざっくり本文抽出（軽量版）
  const text = decodeHtmlEntities(stripTags(html)).slice(0, 250_000)
  return { url, title, text, headings }
}


