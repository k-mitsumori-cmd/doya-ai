// ============================================
// ドヤカンニング 型定義
// ============================================

// ビジネス: sales(商談) / interview(面接) / oneonone(1on1面談) / grilling(激詰め対応)
// エンタメ: idol(アイドル神対応) / roast(アンチコメント返し) / stream(配信トーク)
export type CunningMode = 'sales' | 'interview' | 'oneonone' | 'grilling' | 'idol' | 'roast' | 'stream'

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
