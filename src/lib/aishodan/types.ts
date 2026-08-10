// ============================================
// ドヤAI商談（aishodan）型定義
// 仕様: reference/services/aishodan.md
// ============================================

export type AishodanRole = 'owner' | 'admin' | 'manager' | 'member'

export const ROLE_HIERARCHY: Record<AishodanRole, number> = {
  owner: 4, admin: 3, manager: 2, member: 1,
}

export function hasMinRole(role: string | undefined, min: AishodanRole): boolean {
  return (ROLE_HIERARCHY[(role || '') as AishodanRole] ?? 0) >= ROLE_HIERARCHY[min]
}

export interface AishodanContext {
  userId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: AishodanRole
}

/** 商材プロフィール。確定したこれが回答の最上位の根拠になる */
export interface ProductProfile {
  oneLiner?: string
  valueProp?: string
  targetCustomer?: string
  pricing?: string
  differentiators?: string[]
  faq?: Array<{ q: string; a: string }>
  /** 話してはいけないこと（ホストが明示的に足せる） */
  doNotMention?: string[]
}

/** 商談のフェーズ。進行はモデルではなくサーバのステートマシンが決める */
export interface Phase {
  key: string
  name: string
  /** このフェーズでAIが達成すべきこと */
  goal: string
  /** 次へ進む条件（人間可読。判定はサーバ側のロジックで行う） */
  exitCondition: string
  maxTurns: number
}

export type SlotType = 'text' | 'choice' | 'number' | 'date'

export interface Slot {
  key: string
  label: string
  type: SlotType
  required: boolean
  /** どう聞くかの例 */
  questionHint: string
  choices?: string[]
}

export interface IcpCondition {
  key: string
  label: string
  /** 0-100 のうちこの条件が占める重み */
  weight: number
  /** 何に当てはまれば加点か（自然文。判定はLLM＋機械チェック） */
  match: string
}

export interface Icp {
  conditions: IcpCondition[]
}

export type PricePolicy = 'disclose' | 'rough' | 'withhold'

export interface Guardrails {
  /** 価格をどこまで言ってよいか */
  pricePolicy: PricePolicy
  /** 競合他社に言及してよいか */
  competitorPolicy: 'neutral' | 'avoid'
  prohibitedTopics: string[]
  /** 資料に無い質問への挙動。既定は推測せず「確認して折り返す」 */
  noEvidenceBehavior: 'defer' | 'general'
}

export interface Persona {
  tone: string
  firstPerson: string
  maxCharsPerUtterance: number
}

export interface ScenarioConfig {
  phases: Phase[]
  slots: Slot[]
  icp: Icp
  guardrails: Guardrails
  persona: Persona
  durationMin: number
  /** 日程調整ページのURL（未設定ならボタンを出さない） */
  schedulingUrl: string | null
  schedulingLabel: string | null
}

export type Verdict = 'hot' | 'warm' | 'cold' | 'unfit'

export const VERDICT_LABELS: Record<Verdict, string> = {
  hot: '有望',
  warm: '見込みあり',
  cold: '時期尚早',
  unfit: '不適合',
}

export const SESSION_STATUS_LABELS: Record<string, string> = {
  pending: '未実施',
  live: '商談中',
  completed: '要約待ち',
  evaluated: '完了',
  aborted: '中断',
  expired: '期限切れ',
}

export const PRICE_POLICY_LABELS: Record<PricePolicy, string> = {
  disclose: '表示価格を提示してよい',
  rough: '概算のみ伝える',
  withhold: '価格には触れない',
}
