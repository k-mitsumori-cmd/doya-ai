import { z } from 'zod'

export const SeoToneSchema = z.enum(['丁寧', 'フランク', 'ビジネス', '専門的'])

export const SeoLlmoOptionsSchema = z.object({
  tldr: z.boolean().default(true),
  conclusionFirst: z.boolean().default(true),
  faq: z.boolean().default(true),
  glossary: z.boolean().default(true),
  comparison: z.boolean().default(true),
  quotes: z.boolean().default(true),
  templates: z.boolean().default(true),
  objections: z.boolean().default(true),
})

export type SeoLlmoOptions = z.infer<typeof SeoLlmoOptionsSchema>

// 参考画像の型
export const SeoReferenceImageSchema = z.object({
  name: z.string(),
  dataUrl: z.string(), // Base64 data URL
})

export const SeoCreateArticleInputSchema = z.object({
  title: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(50),
  persona: z.string().max(5000).optional().default(''),
  searchIntent: z.string().max(5000).optional().default(''),
  targetChars: z.number().int().min(1000).max(60000),
  referenceUrls: z.array(z.string().url()).max(20).optional().default([]),
  tone: SeoToneSchema.default('丁寧'),
  forbidden: z.array(z.string().min(1).max(200)).max(50).optional().default([]),
  llmoOptions: SeoLlmoOptionsSchema.optional(),
  // 新機能：依頼テキストと参考画像
  requestText: z.string().max(50000).optional().nullable(),
  referenceImages: z.array(SeoReferenceImageSchema).max(5).optional().nullable(),
  // 比較記事（調査型）
  mode: z.enum(['standard', 'comparison_research']).optional().default('standard'),
  comparisonConfig: z.any().optional().nullable(),
  comparisonCandidates: z.any().optional().nullable(),
  referenceInputs: z.any().optional().nullable(),
})

export type SeoCreateArticleInput = z.infer<typeof SeoCreateArticleInputSchema>

// Gemini出力は配列要素がオブジェクトになることがあるため、受け取り側で文字列に正規化する
const OutlineStringItemSchema = z.preprocess((v) => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const pick = (k: string) => (typeof obj[k] === 'string' ? (obj[k] as string) : '')
    // よくあるキー候補（faq/question, glossary/term 等）
    const s =
      pick('text') ||
      pick('value') ||
      pick('title') ||
      pick('name') ||
      pick('q') ||
      pick('question') ||
      pick('term')
    return s || JSON.stringify(obj)
  }
  return ''
}, z.string().min(1))

export const SeoOutlineSchema = z.object({
  sections: z.array(
    z.object({
      h2: z.string().min(1),
      intentTag: z.string().min(1).optional().default(''),
      // Gemini出力が上限超え/文字列/小数/nullになることがあるため、ここで吸収する
      plannedChars: z
        .preprocess((v) => {
          if (v == null) return undefined
          const n =
            typeof v === 'number'
              ? v
              : typeof v === 'string'
                ? Number.parseInt(v, 10)
                : Number.NaN
          if (!Number.isFinite(n)) return undefined
          // 仕様上は1500-3000推奨だが、生成を止めないため schema 上限(3500)に丸める
          const clamped = Math.max(800, Math.min(3500, Math.round(n)))
          return clamped
        }, z.number().int().min(800).max(3500))
        .optional()
        .default(2000),
      h3: z
        .preprocess((v) => (v == null ? [] : v), z.array(z.string().min(1)))
        .optional()
        .default([]),
      // Geminiがh4をnullで返すことがあるため、null/配列/非objectは空オブジェクトに落とす
      h4: z
        .preprocess((v) => {
          if (v == null) return {}
          if (Array.isArray(v)) return {}
          if (typeof v !== 'object') return {}
          return v
        }, z.record(z.array(z.string().min(1))))
        .optional()
        .default({}), // h3 -> h4[]
    })
  ).min(3),
  internalLinkIdeas: z.array(OutlineStringItemSchema).optional().default([]),
  faq: z.array(OutlineStringItemSchema).optional().default([]),
  glossary: z.array(OutlineStringItemSchema).optional().default([]),
  diagramIdeas: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        insertionHint: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
})

export type SeoOutline = z.infer<typeof SeoOutlineSchema>


