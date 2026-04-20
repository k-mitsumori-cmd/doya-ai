import type { BrandPalette, DoyaLogoInput, LogoPatternId, PaletteColor } from './types'
import { hexToRgb, mix, normalizeHex, readableTextColor, shiftHue } from './utils'

function color(hex: string, usage: string[]): PaletteColor {
  const normalized = normalizeHex(hex) || '#111827'
  return { hex: normalized, rgb: hexToRgb(normalized), usage }
}

function grayscale(baseText: string): PaletteColor[] {
  // Japanese corporate logos often rely on stable neutrals
  const g = [
    '#0B0F1A',
    '#111827',
    '#374151',
    '#6B7280',
    '#9CA3AF',
    '#D1D5DB',
    '#E5E7EB',
    '#F3F4F6',
    '#FFFFFF',
  ]
  return g.map((h, i) => color(h, i <= 2 ? ['テキスト', '見出し'] : i >= 7 ? ['背景'] : ['補助テキスト', 'ボーダー']))
}

function defaultPrimaryByIndustry(industry: DoyaLogoInput['industry']): string {
  switch (industry) {
    case 'fintech':
      return '#0F766E' // teal
    case 'hr':
      return '#2563EB' // blue
    case 'ai':
      return '#7C3AED' // violet
    case 'marketing':
      return '#DB2777' // pink
    case 'saas':
      return '#1D4ED8' // royal blue
    default:
      return '#111827'
  }
}

function tweakForPattern(primary: string, pattern: LogoPatternId, mood: DoyaLogoInput['mood']): { primary: string; secondary: string; accent: string } {
  const baseSecondary = shiftHue(primary, 22)
  const baseAccent = shiftHue(primary, mood === 'wa_tech' ? 165 : 140)

  if (pattern === 'A') {
    // stable, slightly conservative
    return {
      primary,
      secondary: mix(primary, baseSecondary, 0.55),
      accent: mix(primary, baseAccent, 0.45),
    }
  }
  if (pattern === 'B') {
    // bolder contrast, but avoid gaudy gradients
    return {
      primary,
      secondary: shiftHue(primary, mood === 'startup' ? 50 : 35),
      accent: shiftHue(primary, mood === 'wa_tech' ? 190 : 170),
    }
  }
  // C: minimal + long-term (lower chroma via mixing)
  return {
    primary: mix(primary, '#111827', 0.25),
    secondary: mix(baseSecondary, '#111827', 0.32),
    accent: mix(baseAccent, '#111827', 0.22),
  }
}

export function generatePaletteForPattern(input: DoyaLogoInput, pattern: LogoPatternId): BrandPalette {
  const userPrimary = normalizeHex(input.mainColor)
  const userSecondary = normalizeHex(input.subColor)
  const primary = userPrimary || defaultPrimaryByIndustry(input.industry)

  const tuned = tweakForPattern(primary, pattern, input.mood)
  const secondary = userSecondary || tuned.secondary
  const accent = tuned.accent

  // background should be quiet, brand-safe
  const background = pattern === 'B' && input.mood === 'startup' ? mix(primary, '#FFFFFF', 0.92) : '#FFFFFF'
  const text = readableTextColor(background)

  return {
    primary: color(tuned.primary, ['ロゴマーク', '見出し', 'リンク']),
    secondary: color(secondary, ['補助要素', 'サブ見出し']),
    accent: color(accent, ['CTA', '強調', '通知']),
    background: color(background, ['背景']),
    text: color(text, ['本文', 'ロゴ文字']),
    cta: color(accent, ['CTAボタン', '強調ラベル']),
    grayscale: grayscale(text),
  }
}

export function generatePaletteSet(input: DoyaLogoInput): Record<LogoPatternId, BrandPalette> {
  return {
    A: generatePaletteForPattern(input, 'A'),
    B: generatePaletteForPattern(input, 'B'),
    C: generatePaletteForPattern(input, 'C'),
  }
}

export function paletteMarkdown(palettes: Record<LogoPatternId, BrandPalette>): string {
  const lines: string[] = []
  lines.push('# カラーパレット（ドヤロゴ）')
  lines.push('')
  for (const id of ['A', 'B', 'C'] as const) {
    const p = palettes[id]
    lines.push(`## Pattern ${id}`)
    lines.push('')
    lines.push(`- primary: ${p.primary.hex} / rgb(${p.primary.rgb.r}, ${p.primary.rgb.g}, ${p.primary.rgb.b})  用途: ${p.primary.usage.join(' / ')}`)
    lines.push(`- secondary: ${p.secondary.hex} / rgb(${p.secondary.rgb.r}, ${p.secondary.rgb.g}, ${p.secondary.rgb.b})  用途: ${p.secondary.usage.join(' / ')}`)
    lines.push(`- accent: ${p.accent.hex} / rgb(${p.accent.rgb.r}, ${p.accent.rgb.g}, ${p.accent.rgb.b})  用途: ${p.accent.usage.join(' / ')}`)
    lines.push(`- background: ${p.background.hex} / rgb(${p.background.rgb.r}, ${p.background.rgb.g}, ${p.background.rgb.b})  用途: ${p.background.usage.join(' / ')}`)
    lines.push(`- text: ${p.text.hex} / rgb(${p.text.rgb.r}, ${p.text.rgb.g}, ${p.text.rgb.b})  用途: ${p.text.usage.join(' / ')}`)
    lines.push('')
    lines.push('- grayscale:')
    for (const g of p.grayscale) {
      lines.push(`  - ${g.hex} / rgb(${g.rgb.r}, ${g.rgb.g}, ${g.rgb.b})  用途: ${g.usage.join(' / ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}








