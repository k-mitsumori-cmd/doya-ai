// ドヤAI質問リンク 型定義（仕様: reference/services/asklink.md）
import type { QuestionCheck } from './link'

export type Audience = 'b2b' | 'b2c'

/** サイトから抽出した情報（4-1）。URLは必ずサイト上で見つかったものだけ */
export interface SiteProfile {
  name: string
  /** サービス内容 */
  summary: string
  strengths: string[]
  /** 対象顧客 */
  target: string
  contactUrl: string | null
  downloadUrl: string | null
  pricingUrl: string | null
  /** その他の主要ページ */
  pages: { label: string; url: string }[]
  colors: string[]
}

export type LinkKey = 'understand' | 'prepare' | 'choose' | 'reassure' | 'pages'

export interface AskLink {
  key: LinkKey
  /** 何の質問か（画面表示用） */
  title: string
  buttonLabel: string
  question: string
  url: string
  check: QuestionCheck
  /** 機械チェックに通らず要確認のまま残った */
  needsReview: boolean
}

/** バナーに焼き込む文言（4-3） */
export interface BannerCopy {
  headline: string
  sub: string
  bubbles: [string, string, string]
}

export const BANNER_BUTTON_TEXT = 'AIに聞く'
export const BANNER_NOTE_TEXT = 'ChatGPTが開きます'

export type BannerKind = 'landscape' | 'square' | 'portrait'

export interface BannerSpec {
  kind: BannerKind
  label: string
  use: string
  w: number
  h: number
}

/** 3種類の定義。16の倍数・3:1以内（gpt-image-2 の受理条件） */
export const BANNER_SPECS: BannerSpec[] = [
  { kind: 'landscape', label: '横長', use: 'PCの中央ポップアップ', w: 1200, h: 672 },
  { kind: 'square', label: '正方形', use: 'スライドイン・SNS兼用', w: 1088, h: 1088 },
  { kind: 'portrait', label: '縦長', use: 'スマホのポップアップ', w: 1152, h: 1536 },
]

export function findBannerSpec(kind: string): BannerSpec | undefined {
  return BANNER_SPECS.find((s) => s.kind === kind)
}

export interface BannerVerify {
  ok: boolean
  needsReview: boolean
  missing: string[]
  detectedText?: string
}
