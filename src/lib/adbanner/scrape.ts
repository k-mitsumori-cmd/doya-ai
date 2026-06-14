// ============================================
// ドヤ広告バナーAI URL解析（ブランド情報抽出）
// SSRF安全な safe-fetch + Gemini でサービス名・概要・配色を抽出。
// ============================================
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { BrandInfo } from './types'

function extractOgImage(html: string, base: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (!m?.[1]) return null
  try { return new URL(m[1].trim(), base).toString() } catch { return null }
}
function extractThemeColors(html: string): string[] {
  const colors = new Set<string>()
  const tc = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i)
  if (tc?.[1]) colors.add(tc[1])
  // CSS内の頻出カラーを少しだけ拾う（簡易）
  const hexes = html.match(/#[0-9a-fA-F]{6}/g) || []
  const freq: Record<string, number> = {}
  for (const h of hexes) { const k = h.toLowerCase(); if (k === '#ffffff' || k === '#000000') continue; freq[k] = (freq[k] || 0) + 1 }
  Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([c]) => colors.add(c))
  return Array.from(colors).slice(0, 4)
}

export async function analyzeUrlForBrand(rawUrl: string): Promise<BrandInfo> {
  let url = (rawUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  const html = await safeFetchText(url, { timeoutMs: 12000 })
  if (!html) return {}
  const ogImage = extractOgImage(html, url)
  const cssColors = extractThemeColors(html)
  const text = htmlToText(html).slice(0, 4000)

  let ai: { serviceName?: string; description?: string; colors?: string[] } = {}
  try {
    const prompt = [
      '以下はある企業/サービスのWebサイトから抽出したテキストです。広告バナーを作るために、サービス情報を抽出してください。',
      '次のJSONのみ出力（日本語・コードフェンス禁止）:',
      '{ "serviceName": "サービス名/会社名", "description": "何を提供しているか30字以内", "colors": ["#RRGGBB", "..."] }',
      '',
      `URL: ${url}`,
      `テキスト: ${text}`,
    ].join('\n')
    ai = (await geminiGenerateJson<typeof ai>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AdBannerBrand')) || {}
  } catch {
    /* graceful */
  }

  const colors = Array.from(new Set([...(ai.colors || []), ...cssColors].filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c)))).slice(0, 4)
  return {
    serviceName: ai.serviceName?.trim() || undefined,
    description: ai.description?.trim() || undefined,
    colors: colors.length ? colors : undefined,
    ogImage,
  }
}
