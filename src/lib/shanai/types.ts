// ============================================
// ドヤ社内インタビュー 型定義
// ============================================

export type ShanaiMode = 'voice' | 'survey'
export type ShanaiStatus = 'DRAFT' | 'COLLECTING' | 'FACTS' | 'WRITING' | 'DONE'
export type ShanaiPurpose = 'recruit' | 'internal'
export type ShanaiTone = 'friendly' | 'formal' | 'passionate'
export type SourceKind = 'corporate' | 'service' | 'recruit' | 'other'
export type ProfileCategory = 'mission' | 'business' | 'service' | 'number' | 'culture' | 'benefit' | 'other'
export type FactSourceType = 'transcript' | 'answer' | 'company'
export type FactCategory = 'career' | 'work' | 'episode' | 'value' | 'team' | 'future' | 'company' | 'other'
export type BlockType = 'heading' | 'qa' | 'paragraph' | 'quote' | 'company'

export const PURPOSE_LABELS: Record<ShanaiPurpose, string> = {
  recruit: '採用広報（社外向け）',
  internal: '社内報（社内向け）',
}

export const TONE_LABELS: Record<ShanaiTone, string> = {
  friendly: 'やわらかく親しみやすい',
  formal: '落ち着いた丁寧な文体',
  passionate: '熱量のある力強い文体',
}

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  corporate: '会社サイト',
  service: 'サービスサイト',
  recruit: '採用ページ',
  other: 'その他',
}

export const PROFILE_CATEGORY_LABELS: Record<ProfileCategory, string> = {
  mission: 'ミッション・ビジョン',
  business: '事業内容',
  service: 'サービスの特徴',
  number: '数字・実績',
  culture: 'カルチャー',
  benefit: '制度・働き方',
  other: 'その他',
}

export const FACT_CATEGORY_LABELS: Record<FactCategory, string> = {
  career: '経歴・入社のきっかけ',
  work: '仕事内容',
  episode: 'エピソード',
  value: '大切にしていること',
  team: 'チーム・職場',
  future: 'これからの目標',
  company: '会社の事実',
  other: 'その他',
}

export interface SurveyAnswer {
  answer: string
  followupQuestion?: string
  followupAnswer?: string
}
export type SurveyAnswers = Record<string, SurveyAnswer>

export interface TranscriptSegmentDto {
  start: number
  end: number
  speaker?: string
  text: string
}

export interface ArticleBlock {
  type: BlockType
  heading?: string
  question?: string
  body: string
  factIds: string[]
  /** 根拠の事実が1つも無い（編集画面で警告する） */
  unsupported?: boolean
}

export function isCuid(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{20,40}$/i.test(id)
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(String(value)) ? (value as T) : fallback
}

export function clip(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}
