export const AIO_BRAND_TEXT_LIMITS = {
  brandName: 120,
  brandUrl: 300,
  category: 200,
  market: 100,
} as const

export const AIO_BRAND_LIST_LIMIT = 30
const LIST_TEXT_LIMIT = 4_000

type BrandProfileInput = {
  brandName: string
  brandUrl?: string | null
  category?: string | null
  market?: string | null
  aliases?: string[]
  competitors?: string[]
}

/** Only explicit optional fields may replace stored settings; invalid input must never clear them. */
export function parseAioBrandProfileInput(value: unknown): BrandProfileInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ブランド設定の入力形式を確認してください。')
  const body = value as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(body, 'brandName') || typeof body.brandName !== 'string' || !body.brandName.trim()) throw new Error('ブランド名は必須です。')
  const data: BrandProfileInput = { brandName: body.brandName.trim() }
  for (const key of Object.keys(AIO_BRAND_TEXT_LIMITS) as (keyof typeof AIO_BRAND_TEXT_LIMITS)[]) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    const raw = body[key]
    if (key !== 'brandName' && raw === null) { data[key] = null; continue }
    if (typeof raw !== 'string' || raw.trim().length > AIO_BRAND_TEXT_LIMITS[key]) throw new Error('入力の文字数・形式を確認してください。ブランド名120文字、URL300文字、カテゴリ200文字、市場100文字までです。')
    if (key === 'brandName') data.brandName = raw.trim()
    else data[key] = raw.trim() || null
  }
  for (const key of ['aliases', 'competitors'] as const) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    const raw = body[key]
    if (raw === null) { data[key] = []; continue }
    if (!Array.isArray(raw) || raw.length > AIO_BRAND_LIST_LIMIT || raw.some(item => typeof item !== 'string' || !item.trim() || item.trim().length > LIST_TEXT_LIMIT)) throw new Error('別名・競合はそれぞれ30件まで、1件1〜4000文字の文字列で入力してください。')
    data[key] = raw.map(item => item.trim())
  }
  return data
}
