// ============================================
// ドヤヒヤリングAI — 型定義
// ============================================

export type InterviewXPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

// プロジェクトステータス（簡素化）
export type InterviewXProjectStatus =
  | 'DRAFT'           // 下書き（テンプレート選択・設定中）
  | 'QUESTIONS_READY'  // 質問生成完了
  | 'SHARED'           // 共有URL送信済み
  | 'RESPONDING'       // 回答中
  | 'ANSWERED'         // 回答完了
  | 'SUMMARIZED'       // 要約生成済み
  | 'COMPLETED'        // 完了

// 質問タイプ
export type QuestionType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RATING' | 'YES_NO'

// 回答ステータス
export type ResponseStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'

// ドラフト（要約）ステータス
export type DraftStatus = 'DRAFT' | 'REVIEWING' | 'REVISED' | 'APPROVED' | 'PUBLISHED'

// ヒヤリングタイプ
export type HearingType =
  | 'BUSINESS_MEETING'       // 商談ヒヤリング
  | 'SERVICE_RESEARCH'       // サービス調査
  | 'CUSTOMER_SATISFACTION'  // 顧客満足度
  | 'REQUIREMENTS'           // 要件定義
  | 'INTERNAL_HEARING'       // 社内ヒヤリング
  | 'COMPETITOR_ANALYSIS'    // 競合調査
  | 'NEW_BUSINESS'           // 新規事業調査
  | 'CUSTOM'                 // カスタム

// 旧: 記事タイプ（後方互換用）
export type ArticleType = 'CASE_STUDY' | 'EMPLOYEE' | 'TESTIMONIAL' | 'RECRUIT' | 'PRESS' | 'EVENT'

// トーン
export type ToneType = 'friendly' | 'professional' | 'casual' | 'formal'

// ヒヤリングカテゴリ
export const HEARING_CATEGORIES: Record<HearingType, { label: string; icon: string; description: string }> = {
  BUSINESS_MEETING:      { label: '商談ヒヤリング', icon: '🤝', description: '営業商談の事前・事後情報収集' },
  SERVICE_RESEARCH:      { label: 'サービス調査', icon: '🔍', description: '他社サービス・ツールの調査' },
  CUSTOMER_SATISFACTION: { label: '顧客満足度', icon: '⭐', description: '顧客満足度調査・NPS' },
  REQUIREMENTS:          { label: '要件定義', icon: '📋', description: 'システム要件・業務要件整理' },
  INTERNAL_HEARING:      { label: '社内ヒヤリング', icon: '🏢', description: '社内調査・1on1' },
  COMPETITOR_ANALYSIS:   { label: '競合調査', icon: '📊', description: '競合企業・サービス分析' },
  NEW_BUSINESS:          { label: '新規事業調査', icon: '🚀', description: '市場調査・事業検証' },
  CUSTOM:                { label: 'カスタム', icon: '✏️', description: '自由にヒヤリング項目を設定' },
}

// 旧: テンプレートカテゴリ（後方互換用）
export const TEMPLATE_CATEGORIES: Record<ArticleType, { label: string; icon: string; description: string }> = {
  CASE_STUDY:  { label: '導入事例', icon: '📊', description: 'お客様の導入事例・成功事例を記事化' },
  EMPLOYEE:    { label: '社員インタビュー', icon: '👤', description: '社員の声・働き方を発信' },
  TESTIMONIAL: { label: 'お客様の声', icon: '💬', description: 'お客様の生の声を記事に' },
  RECRUIT:     { label: '採用インタビュー', icon: '🎯', description: '採用向けの社員紹介記事' },
  PRESS:       { label: 'プレスリリース', icon: '📰', description: '新サービス・イベント告知記事' },
  EVENT:       { label: 'イベントレポート', icon: '🎪', description: 'イベント・セミナーの振り返り記事' },
}

// SSEイベント型
export interface SSEEvent {
  type: 'progress' | 'chunk' | 'question' | 'done' | 'error'
  message?: string
  text?: string
  data?: any
}

// チャットメッセージロール
export type ChatMessageRole = 'interviewer' | 'respondent' | 'system'

// チャットメッセージタイプ
export type ChatMessageType = 'greeting' | 'question' | 'follow_up' | 'transition' | 'closing' | 'answer'

// Gemini AIインタビュアーのJSON応答型
export interface ChatAIResponse {
  reply: string
  topicIndex: number
  messageType: ChatMessageType
  shouldEndInterview: boolean
}

// URL調査結果の型
export interface CompanyAnalysis {
  companyName?: string
  businessDescription?: string
  services?: string[]
  industry?: string
  scale?: string
  keyFeatures?: string[]
  targetCustomers?: string
  rawContent?: string
}
