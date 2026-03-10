// ============================================
// ドヤインタビューAI-X — 型定義
// ============================================

export type InterviewXPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

// プロジェクトステータス
export type InterviewXProjectStatus =
  | 'DRAFT'           // 下書き（テンプレート選択・設定中）
  | 'QUESTIONS_READY'  // 質問生成完了
  | 'SHARED'           // 共有URL送信済み
  | 'RESPONDING'       // 回答中
  | 'ANSWERED'         // 回答完了
  | 'GENERATING'       // 記事生成中
  | 'REVIEW'           // レビュー中
  | 'FEEDBACK'         // フィードバック待ち
  | 'FINALIZING'       // 最終チェック中
  | 'COMPLETED'        // 完了

// 質問タイプ
export type QuestionType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RATING' | 'YES_NO'

// 回答ステータス
export type ResponseStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'

// ドラフトステータス
export type DraftStatus = 'DRAFT' | 'REVIEWING' | 'REVISED' | 'APPROVED' | 'PUBLISHED'

// 記事タイプ
export type ArticleType = 'CASE_STUDY' | 'EMPLOYEE' | 'TESTIMONIAL' | 'RECRUIT' | 'PRESS' | 'EVENT'

// トーン
export type ToneType = 'friendly' | 'professional' | 'casual' | 'formal'

// フィードバック元
export type FeedbackAuthorType = 'COMPANY' | 'RESPONDENT' | 'AI'

// フィードバックカテゴリ
export type FeedbackCategory = 'FACT_CORRECTION' | 'TONE' | 'ADDITION' | 'DELETION' | 'GENERAL'

// チェック種別
export type CheckType = 'PROOFREAD' | 'FACT_CHECK' | 'READABILITY' | 'BRAND_CONSISTENCY' | 'SENSITIVITY'

// テンプレートカテゴリ
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

// インタビューモード
export type InterviewMode = 'survey' | 'chat'

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
