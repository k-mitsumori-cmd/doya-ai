// ============================================
// ドヤカンニング 型定義
// ============================================

// ビジネス: sales(商談) / interview(面接) / oneonone(1on1面談) / grilling(激詰め対応) / apology(謝罪対応)
// エンタメ: idol / roast / stream / ogiri(大喜利) / praise(全肯定褒め殺し) / debate(徹底論破)
export type CunningMode =
  | 'sales'
  | 'interview'
  | 'oneonone'
  | 'grilling'
  | 'apology'
  | 'idol'
  | 'roast'
  | 'stream'
  | 'ogiri'
  | 'praise'
  | 'debate'

export interface AnswerSource {
  label: string
  url?: string
}

export interface CunningAnswerResult {
  summary: string // 要点（一言回答）
  script: string // 話すスクリプト（2〜4文）
  sources: AnswerSource[]
  model: string
}

export interface KnowledgeChunkLite {
  id: string
  content: string
  sourceUrl?: string | null
  sourceLabel?: string | null
}

export interface CompanyProfileLite {
  companyName?: string | null
  businessSummary?: string | null
  requirements?: unknown
}

export interface ApplicantProfileLite {
  name?: string | null
  resume?: string | null
  motivation?: string | null
}
