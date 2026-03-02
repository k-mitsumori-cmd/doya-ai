import { z } from 'zod'

export const LogoMoodSchema = z.enum(['japanese_modern', 'wa_tech', 'minimal', 'bold', 'startup'])
export type LogoMood = z.infer<typeof LogoMoodSchema>

export const LogoIndustrySchema = z.enum(['saas', 'hr', 'ai', 'marketing', 'fintech', 'other'])
export type LogoIndustry = z.infer<typeof LogoIndustrySchema>

export const DoyaLogoInputSchema = z.object({
  serviceName: z.string().min(1).max(60),
  serviceDescription: z.string().min(1).max(400),
  mood: LogoMoodSchema.default('japanese_modern'),
  industry: LogoIndustrySchema.default('saas'),
  mainColor: z.string().optional(),
  subColor: z.string().optional(),
})

export type DoyaLogoInput = z.infer<typeof DoyaLogoInputSchema>

export type LogoPatternId = 'A' | 'B' | 'C'
export type LogoLayout = 'horizontal' | 'square'
export type LogoMode = 'default' | 'dark' | 'mono' | 'invert'

export type ColorRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'cta' | 'gray'

export type PaletteColor = {
  hex: string
  rgb: { r: number; g: number; b: number }
  usage: string[]
}

export type BrandPalette = {
  primary: PaletteColor
  secondary: PaletteColor
  accent: PaletteColor
  background: PaletteColor
  text: PaletteColor
  cta: PaletteColor
  grayscale: PaletteColor[]
}

export type PatternPaletteSet = Record<LogoPatternId, BrandPalette>

export type GeneratedLogoFile = {
  layout: LogoLayout
  mode: LogoMode
  svg: { filename: string; content: string }
  png: { filename: string }
  jpeg: { filename: string }
  figmaSvg: { filename: string; content: string }
}

export type GeneratedPattern = {
  id: LogoPatternId
  title: string
  description: string
  palette: BrandPalette
  reasons: string
  growthStory: string
  oneLiner: string
  trademarkNote: string
  logos: GeneratedLogoFile[]
}

export type GeneratedLogoProject = {
  meta: {
    generator: 'doya-logo'
    version: string
    createdAt: string
    input: DoyaLogoInput
    serviceSlug: string
    seed: string
  }
  patterns: GeneratedPattern[]
  guidelineMarkdown: string
  paletteMarkdown: string
}








