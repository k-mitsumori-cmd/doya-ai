import dns from 'dns/promises'
import net from 'net'

interface ScrapedCompanyInfo {
  companyName?: string
  description?: string
  services?: string[]
  phone?: string
  email?: string
  address?: string
  employeeCount?: string
  representative?: string
  foundedYear?: number
  capital?: string
  industry?: string
}

// SSRF対策: プライベート/ループバック/メタデータIPへのアクセスを拒否
const BLOCKED_HOSTNAMES = new Set([
  'localhost', '169.254.169.254', 'metadata.google.internal',
  'metadata.azure.com', '100.100.100.200',
])

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number)
    return (
      p[0] === 127 || p[0] === 10 ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 169 && p[1] === 254) ||
      p[0] === 0
    )
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') ||
      v.startsWith('fe80:') || v.startsWith('::ffff:')
  }
  return false
}

async function validateUrlForSSRF(rawUrl: string): Promise<URL> {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { throw new Error('不正なURL形式です') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('http/httpsのみ許可されています')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new Error('このホストへのアクセスは禁止されています')
  // IP直指定の場合は即チェック
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('プライベートIPへのアクセスは禁止されています')
    return parsed
  }
  // DNS解決して全アドレスがパブリックか確認
  const addrs = await dns.lookup(hostname, { all: true })
  for (const a of addrs) {
    if (isPrivateIP(a.address)) throw new Error('解決先がプライベートIPです（SSRF防止）')
  }
  return parsed
}

export async function scrapeCompanyWebsite(url: string): Promise<ScrapedCompanyInfo | null> {
  try {
    const validatedUrl = await validateUrlForSSRF(url)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(validatedUrl.toString(), {
      signal: controller.signal,
      redirect: 'manual', // リダイレクト先の再検証が必要なため自動追跡しない
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DoyaListBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    // 3xxリダイレクトは追跡しない（SSRF防止）
    if (response.status >= 300 && response.status < 400) {
      console.warn(`Redirect not followed for SSRF safety: ${url}`)
      return null
    }

    if (!response.ok) return null

    const html = await response.text()
    const text = extractTextFromHtml(html)

    // Use AI to extract structured data
    const extracted = await extractWithAI(text, url)
    return extracted
  } catch (error) {
    console.error(`Scrape error for ${url}:`, error)
    return null
  }
}

function extractTextFromHtml(html: string): string {
  // Remove scripts, styles, and tags
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Limit to first 5000 chars for AI processing
  return text.slice(0, 5000)
}

async function extractWithAI(text: string, url: string): Promise<ScrapedCompanyInfo | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!GEMINI_API_KEY) return null

  const model = 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const prompt = `以下はWebサイト（${url}）から抽出したテキストです。この企業の情報を構造化してJSON形式で抽出してください。
情報が見つからない項目はnullにしてください。

テキスト:
${text}

JSON形式で回答（JSON以外の文字は含めないでください）:
{
  "companyName": "企業名",
  "description": "事業内容の要約（100字以内）",
  "services": ["主なサービス/製品"],
  "phone": "電話番号",
  "email": "メールアドレス",
  "address": "住所",
  "employeeCount": "従業員数",
  "representative": "代表者名",
  "foundedYear": 2000,
  "capital": "資本金",
  "industry": "業種"
}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) return null

    return JSON.parse(responseText)
  } catch {
    return null
  }
}

export async function scrapeMultipleCompanies(
  urls: { companyId: string; url: string }[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ScrapedCompanyInfo>> {
  const results = new Map<string, ScrapedCompanyInfo>()
  const concurrency = 3
  let completed = 0

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const promises = batch.map(async ({ companyId, url }) => {
      const info = await scrapeCompanyWebsite(url)
      if (info) results.set(companyId, info)
      completed++
      onProgress?.(completed, urls.length)
    })
    await Promise.allSettled(promises)
  }

  return results
}
