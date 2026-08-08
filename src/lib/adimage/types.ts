// ============================================
// ドヤ広告画像AI 型定義
// 仕様: reference/services/adimage.md
// ============================================

export interface BrandProfile {
  name: string
  description?: string
  valueProps: string[]
  colors: string[]
  industry?: string
  tone?: string
  logoUrl?: string
}

/** 焼き込む文字列。OCR照合の正解データでもある */
export interface AdCopy {
  headline: string
  sub: string
  cta: string
}

export type AppealAxis = 'benefit' | 'urgency' | 'authority' | 'empathy' | 'price' | 'trial'

export const APPEAL_LABELS: Record<AppealAxis, string> = {
  benefit: 'ベネフィット',
  urgency: '限定・緊急',
  authority: '権威・実績',
  empathy: '共感・課題提起',
  price: '価格',
  trial: '無料お試し',
}

/**
 * 文字数上限。
 * ⚠️ 焼き込みは文字数が増えるほど字形が崩れやすく、9:16では横幅も限られる。
 *    短いほど再現性が上がるため、生成時に上限を渡し、超過はコード側で短縮する。
 */
export const COPY_LIMITS = { headline: 13, sub: 16, cta: 8 } as const

export interface ConceptDraft {
  label: string
  appealAxis: AppealAxis
  tone: string
  copy: AdCopy
}

/** 自動検査の結果 */
export interface VerifyResult {
  /** 指定した文字列がすべて正しく描かれたか */
  ocrMatch: boolean
  /** 指定外の文字が混入していないか */
  extraText: string[]
  /** セーフエリアを侵していないか */
  safeAreaOk: boolean
  retries: number
  /** 2回リトライしても不合格だったもの。黙って捨てず「要確認」で出す */
  needsReview: boolean
  detectedText?: string
}

/**
 * 構造化された改善指示。
 * ⚠️ 文字列として prompt に連結する方式（前身 adbanner）だと、
 *    何を指示したか・効いたかを後から追えず、世代を重ねるほど意図が薄まる。
 */
export interface RefineDirective {
  /** 変える対象 */
  target: 'copy' | 'color' | 'layout' | 'contrast' | 'visual'
  /** 何をどうするか（プロンプトに差分として足す文） */
  instruction: string
  /** なぜそうするのか（後から効果を検証するため） */
  reason: string
}

export interface FeedbackScores {
  visibility: number
  appeal: number
  cta: number
  fit: number
  brand: number
  total: number
}
