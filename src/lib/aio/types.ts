// ============================================
// ドヤAIO（AI可視性・AEO）型定義
// ============================================
export type AioRole = 'owner' | 'admin' | 'manager' | 'member'

export interface AioContext {
  userId: string
  organizationId: string
  organizationSlug: string
  role: AioRole
  memberId: string
}

export const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  manager: 1,
  admin: 2,
  owner: 3,
}

export const ROLE_LABEL: Record<AioRole, string> = {
  member: 'メンバー',
  manager: 'マネージャー',
  admin: '管理者',
  owner: 'オーナー',
}

// ---- エンジン ----
export type EngineId = 'chatgpt' | 'gemini' | 'claude' | 'perplexity'

export const ENGINE_LABEL: Record<EngineId, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
}

// 既存の環境変数キーで使えるエンジン。perplexity は PERPLEXITY_API_KEY があれば有効。
export function availableEngines(): EngineId[] {
  const list: EngineId[] = []
  if (process.env.OPENAI_API_KEY) list.push('chatgpt')
  if (process.env.GOOGLE_GENAI_API_KEY) list.push('gemini')
  if (process.env.ANTHROPIC_API_KEY) list.push('claude')
  if (process.env.PERPLEXITY_API_KEY) list.push('perplexity')
  return list
}

// ---- スキャン状態 ----
// Vercel maxDuration(300s) で強制終了されると 'processing' のまま残るので stale を失敗扱い。
export const SCAN_STALE_MS = 10 * 60 * 1000
export function effectiveScanStatus(status: string, updatedAt: Date | string): string {
  if (status === 'processing' && Date.now() - new Date(updatedAt).getTime() > SCAN_STALE_MS) return 'failed'
  return status
}

export type Sentiment = 'positive' | 'neutral' | 'negative'

// ---- 1ラン（プロンプト×エンジン×反復回）の抽出結果 ----
export interface RunExtract {
  brandMentioned: boolean
  brandRank: number | null
  sentiment: Sentiment | null
  competitors: string[] // この回答に登場した競合・他ブランド名
  citations: string[] // 引用URL（検索系エンジンのみ）
}

// ---- スキャン集計サマリ（AioScan.summary に保存） ----
export interface ScanSummary {
  totalRuns: number
  brandRuns: number // 自社が言及されたラン数
  awarenessPct: number
  shareOfVoice: number
  sentiment: { positive: number; neutral: number; negative: number }
  ownCitationPct: number
  // エンジン別の認知度（推移チャート用の当日値）
  perEngine: { engine: EngineId; awarenessPct: number }[]
  // Share of Voice（自社＋競合）
  sov: { brand: string; mentions: number; pct: number; isOwn: boolean }[]
  // 上位の引用ドメイン
  citations: { domain: string; count: number; channel: CitationChannel; isOwn: boolean }[]
  // プロンプト別 × エンジン別の言及頻度（◯回中△回）
  promptBreakdown: {
    promptId: string
    text: string
    perEngine: { engine: EngineId; mentioned: number; total: number }[]
  }[]
}

export type CitationChannel = 'own' | 'competitor' | 'media' | 'affiliate' | 'other'

// ---- 改善アクション（推奨タブ） ----
export interface Recommendation {
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
}
