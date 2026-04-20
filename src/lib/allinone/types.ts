/**
 * ドヤマーケAI 型定義
 * URL 1本で多角分析 → ダッシュボード表示に必要な全型を集約。
 */

// ============================================
// 入出力
// ============================================

export interface AnalyzeRequest {
  url: string
  targetKeyword?: string
  verbose?: boolean
}

export type AnalysisStep =
  | 'scrape'
  | 'pagespeed'
  | 'site'
  | 'seo'
  | 'persona'
  | 'branding'
  | 'visual'
  | 'action'
  | 'summary'

export type AnalysisProgress = Partial<Record<AnalysisStep, 'pending' | 'running' | 'done' | 'error'>>

// ============================================
// scrape 結果
// ============================================

export interface ScrapeResult {
  url: string
  finalUrl: string
  title: string
  description: string
  keywords?: string
  favicon?: string
  ogImage?: string
  heroImage?: string       // ファーストビュー推定画像
  mainImages: string[]     // ページ内の主要画像（最大10）
  headings: { h1: string[]; h2: string[]; h3: string[] }
  textSample: string       // 冒頭の本文テキスト（6000字以内）
  wordCount: number
  mainColors: string[]     // 抽出した主要カラー（hex）
  fonts: string[]          // 使用フォント候補
  hasStructuredData: boolean
  hasOgp: boolean
  hasFavicon: boolean
  hasViewport: boolean
  hasCanonical: boolean
  hasAnalytics: boolean    // GA4/Tagmanager 等
  linkCount: number
  imageCount: number
  internalLinks: string[]
  externalLinks: string[]
  socialLinks: { platform: string; url: string }[]
  hasCta: boolean
  ctaTexts: string[]
}

// ============================================
// PageSpeed
// ============================================

export interface PageSpeedResult {
  strategy: 'mobile' | 'desktop'
  performanceScore: number | null // 0-100
  accessibilityScore?: number | null
  bestPracticesScore?: number | null
  seoScore?: number | null
  lcp?: number | null // ms
  fcp?: number | null
  cls?: number | null
  tbt?: number | null
  ttfb?: number | null
  opportunities: { id: string; title: string; description: string; savings?: number }[]
}

// ============================================
// SEO 分析
// ============================================

export interface SeoGap {
  type: 'content' | 'keyword' | 'structure' | 'internal_link' | 'meta' | 'schema'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  evidence?: string
  suggestion: string
  relatedService?: 'seo' | 'lp' | 'banner' | 'persona' | 'copy'
}

export interface SeoAnalysis {
  estimatedTargetKeywords: string[]
  missingKeywords: string[]
  topicClusters: { theme: string; keywords: string[]; priority: 'high' | 'medium' | 'low' }[]
  headingIssues: string[]
  contentGaps: SeoGap[]
  internalLinkScore: number // 0-100
  quickWins: { title: string; effort: '低' | '中' | '高'; impact: '大' | '中' | '小'; detail: string }[]
}

// ============================================
// サイト分析
// ============================================

export interface SiteIssue {
  category: 'performance' | 'mobile' | 'a11y' | 'meta' | 'security' | 'structure' | 'trust'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  suggestion: string
}

export interface SiteAnalysis {
  firstImpression: string
  firstImpressionScore: number // 0-100
  strengths: string[]
  weaknesses: string[]
  issues: SiteIssue[]
  mobileFriendly: boolean
  hasHttps: boolean
  pageSpeedMobile: PageSpeedResult | null
  pageSpeedDesktop: PageSpeedResult | null
  mainColors: string[]
  fonts: string[]
  ctaEvaluation: string
  trustSignals: string[]
}

// ============================================
// ペルソナ
// ============================================

export interface Persona {
  id: string
  name: string
  age: number
  gender?: string
  occupation: string
  lifestyle: string
  motivation: string
  painPoint: string
  buyingTrigger: string
  objection: string
  informationSource: string[]
  quote: string          // ペルソナの一人称セリフ（吹き出しに使う）
  portraitUrl?: string   // 生成された肖像画像
  palette?: string       // 代表色（カードの背景グラデに使う）
}

// ============================================
// ブランディング
// ============================================

export interface BrandingAnalysis {
  tone: string
  toneTags: string[]
  palette: string[]      // hex 6色まで
  fontImpression: string
  visualStyle: string
  consistency: number    // 0-100
  improvements: string[]
}

// ============================================
// キービジュアル（バナー3案）
// ============================================

export interface KeyVisual {
  id: string
  concept: string        // A / B / C 案のコンセプト
  headline: string
  subcopy: string
  imageUrl?: string      // 生成画像
  palette: string[]
  prompt?: string
}

// ============================================
// アクションプラン
// ============================================

export interface ActionItem {
  id: string
  priority: 1 | 2 | 3 | 4 | 5   // 1が最優先
  title: string
  description: string
  expectedImpact: string
  effort: '低' | '中' | '高'
  durationDays: number
  relatedService?: 'seo' | 'lp' | 'banner' | 'persona' | 'copy' | 'adsim' | 'movie' | 'voice'
  deepLink?: string
  done?: boolean
}

// ============================================
// 総合スコア
// ============================================

export interface RadarScore {
  site: number        // サイト力
  seo: number         // SEO
  content: number     // コンテンツ
  targeting: number   // ターゲティング
  appeal: number      // 訴求力
}

export interface AnalysisSummary {
  headline: string                              // 1文のサマリ
  overallScore: number                          // 0-100
  radar: RadarScore
  topThreeActions: { title: string; why: string }[]
  elevatorPitch: string                         // 30秒で伝わる説明
  competitorHint: string                        // 競合サンプリングの結果
}

// ============================================
// 全体のアウトプット（DB の JSON と一致）
// ============================================

export interface FullAnalysisResult {
  summary: AnalysisSummary | null
  siteAnalysis: SiteAnalysis | null
  seoAnalysis: SeoAnalysis | null
  personas: Persona[]
  branding: BrandingAnalysis | null
  keyVisuals: KeyVisual[]
  actionPlan: ActionItem[]
}

// ============================================
// SSE イベント
// ============================================

export type AnalyzeSseEvent =
  | { type: 'start'; analysisId: string }
  | { type: 'status'; message: string }
  | { type: 'progress'; step: AnalysisStep; status: 'pending' | 'running' | 'done' | 'error'; detail?: string }
  | { type: 'scrape_done'; scrape: Partial<ScrapeResult> }
  | { type: 'site_done'; site: SiteAnalysis }
  | { type: 'seo_done'; seo: SeoAnalysis }
  | { type: 'persona_done'; personas: Persona[] }
  | { type: 'branding_done'; branding: BrandingAnalysis }
  | { type: 'key_visual'; visual: KeyVisual; index: number }
  | { type: 'summary_done'; summary: AnalysisSummary; actionPlan: ActionItem[] }
  | { type: 'error'; message: string }
  | { type: 'complete'; analysisId: string }

export type ChatSseEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string }

// ============================================
// チャット
// ============================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  verbose?: boolean
  createdAt: string
  toolCalls?: { name: string; args: unknown; result?: unknown }[]
}

export interface ChatRequest {
  question: string
  verbose?: boolean        // 冗長モード
  focusSection?: 'site' | 'seo' | 'persona' | 'branding' | 'visual' | 'action' | 'summary'
}
