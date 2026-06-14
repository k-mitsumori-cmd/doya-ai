// ============================================
// ドヤ広告バナーAI（AdBanner）型定義
// ============================================
export type AdMedia = 'meta' | 'google' | 'line' | 'x' | 'yda' | 'other'
export type AdPlanTier = 'GUEST' | 'FREE' | 'PRO'

export interface BannerSize {
  key: string // '1080x1080'
  w: number
  h: number
  label: string
  media: AdMedia[]
}

// 媒体別サイズプリセット
export const BANNER_SIZES: BannerSize[] = [
  { key: '1080x1080', w: 1080, h: 1080, label: 'スクエア 1:1（Meta/Instagram）', media: ['meta', 'line', 'x'] },
  { key: '1200x628', w: 1200, h: 628, label: '横長 1.91:1（Meta/Google/X）', media: ['meta', 'google', 'x'] },
  { key: '1080x1920', w: 1080, h: 1920, label: '縦長 9:16（ストーリーズ/リール）', media: ['meta', 'line'] },
  { key: '300x250', w: 300, h: 250, label: 'レクタングル（GDN）', media: ['google', 'yda'] },
  { key: '728x90', w: 728, h: 90, label: 'リーダーボード（GDN）', media: ['google', 'yda'] },
]
export function findSize(key: string): BannerSize | undefined {
  return BANNER_SIZES.find((s) => s.key === key)
}

export const MEDIA_LABEL: Record<AdMedia, string> = {
  meta: 'Meta（Facebook/Instagram）', google: 'Google（GDN/P-MAX）', line: 'LINE広告', x: 'X（Twitter）', yda: 'Yahoo!広告', other: 'その他',
}

// 訴求軸テンプレ
export const APPEAL_AXES = [
  { key: 'benefit', label: 'ベネフィット訴求' },
  { key: 'limited', label: '限定・緊急性' },
  { key: 'authority', label: '権威・実績' },
  { key: 'empathy', label: '共感・課題提起' },
  { key: 'price', label: '価格・お得感' },
  { key: 'free', label: '無料・お試し' },
] as const

export interface BrandInfo {
  serviceName?: string
  description?: string
  colors?: string[]
  ogImage?: string | null
}

export interface BannerFeedback {
  visibility: number // 視認性
  appeal: number // 訴求の強さ
  cta: number // CTA
  fit: number // 媒体適合
  brand: number // ブランド整合
  total: number // 総合
  advice: string // 改善提案
}

export interface GenerateOptions {
  appeal?: string // 訴求軸メモ
  sizes: string[] // 選択サイズ key[]
  variants: number // 量産数
  tone?: string
}

// ロゴ配置（9分割グリッド）
export type LogoPos = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
export interface LogoConfig {
  pos: LogoPos
  maxWidthPct: number // 画像幅に対する最大%
  paddingPct: number
}
