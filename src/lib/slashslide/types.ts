import { z } from 'zod'

export const SlashSlideThemeSchema = z.object({
  name: z.string().min(1),
  background: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .transform((v) => (v.startsWith('#') ? v : `#${v}`)),
  primary: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .transform((v) => (v.startsWith('#') ? v : `#${v}`)),
  accent: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .transform((v) => (v.startsWith('#') ? v : `#${v}`)),
  fontFamily: z.string().min(1).default('Noto Sans JP'),
})

export const SlashSlideSlideSchema = z.object({
  type: z.enum(['title', 'section', 'content']),
  title: z.string().min(1),
  subtitle: z.string().optional().default(''),
  bullets: z.array(z.string()).optional().default([]),
  speakerNotes: z.string().optional().default(''),
  visualSuggestion: z.string().optional().default(''),
})

export const SlashSlideDeckSchema = z.object({
  deckTitle: z.string().min(1),
  deckSubtitle: z.string().optional().default(''),
  language: z.string().optional().default('ja'),
  theme: SlashSlideThemeSchema,
  slides: z.array(SlashSlideSlideSchema).min(3).max(30),
})

export type SlashSlideTheme = z.infer<typeof SlashSlideThemeSchema>
export type SlashSlideSlide = z.infer<typeof SlashSlideSlideSchema>
export type SlashSlideDeck = z.infer<typeof SlashSlideDeckSchema>

export const SlashSlideGenerateRequestSchema = z.object({
  docType: z
    .enum(['提案資料', '営業資料', '採用資料', '社内ミーティング', 'ピッチ資料', '研修資料'])
    .default('提案資料'),
  audience: z.string().min(1),
  goal: z.string().min(1),
  slideCount: z.number().int().min(5).max(20).default(10),
  tone: z.enum(['堅め', '標準', 'カジュアル']).default('標準'),
  themePreset: z.enum(['コンサルブルー', 'モダングリーン', 'プレミアムブラック', 'ヘルスケア', 'リクルート']).default('コンサルブルー'),
  customTheme: SlashSlideThemeSchema.optional(),
  referenceText: z.string().optional().default(''),
  constraints: z.string().optional().default(''),
})

export type SlashSlideGenerateRequest = z.infer<typeof SlashSlideGenerateRequestSchema>

export const SlashSlidePublishGoogleSlidesRequestSchema = z.object({
  deck: SlashSlideDeckSchema,
  shareEmail: z.string().email(),
  title: z.string().min(1),
})

export type SlashSlidePublishGoogleSlidesRequest = z.infer<typeof SlashSlidePublishGoogleSlidesRequestSchema>

// ============================
// 簡易スライド形式（UI/API用）
// ============================
export interface SlideElementSpec {
  type: 'text' | 'bullets' | 'image'
  content?: string       // type=text のとき
  items?: string[]       // type=bullets のとき
  placeholder?: string   // type=image のとき
}

export interface SlideSpec {
  title: string
  elements: SlideElementSpec[]
}

export interface SlideGenerateRequest {
  topic: string
  slidePurpose: 'proposal' | 'meeting' | 'sales' | 'recruit' | 'seminar' | 'other'
  slideCount: number
  themeColor: string
  referenceText?: string
}
