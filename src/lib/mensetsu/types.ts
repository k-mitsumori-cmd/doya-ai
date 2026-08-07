// ============================================
// ドヤ面接官（mensetsu）型定義
// 仕様: reference/services/mensetsu.md
// ============================================

export type MensetsuRole = 'owner' | 'admin' | 'manager' | 'member'

/** owner > admin > manager > member。数値が大きいほど強い。 */
export const ROLE_HIERARCHY: Record<MensetsuRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
}

export function hasMinRole(role: string | undefined, min: MensetsuRole): boolean {
  const r = ROLE_HIERARCHY[(role || '') as MensetsuRole] ?? 0
  return r >= ROLE_HIERARCHY[min]
}

export interface MensetsuContext {
  userId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: MensetsuRole
}

/** 面接レベル */
export type MensetsuLevel = 'newgrad' | 'mid' | 'manager'

export const LEVEL_LABELS: Record<MensetsuLevel, string> = {
  newgrad: '新卒',
  mid: '中途',
  manager: 'マネージャー',
}

/** セッションの状態遷移 */
export type SessionStatus =
  | 'pending' // URL発行済み・未開始
  | 'consented' // 同意済み・機器チェック通過
  | 'live' // 面接中
  | 'completed' // 面接終了・評価待ち
  | 'evaluated' // 評価済み
  | 'expired' // 期限切れ
  | 'aborted' // 中断（通信断など）

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  pending: '未実施',
  consented: '準備完了',
  live: '実施中',
  completed: '評価待ち',
  evaluated: '評価済み',
  expired: '期限切れ',
  aborted: '中断',
}

/**
 * 総合判定。
 * ⚠️ 二値の「合否」ではなく推薦度（C2）。最終決定は必ず人間が行う。
 */
export type Verdict = 'recommend' | 'conditional' | 'hold' | 'reject'

export const VERDICT_LABELS: Record<Verdict, string> = {
  recommend: '推奨',
  conditional: '条件付き推奨',
  hold: '保留',
  reject: '見送り',
}

/** 企業プロフィール（URL調査の結果） */
export interface CompanyProfileData {
  companyName?: string
  business?: string
  valueProp?: string
  culture?: string
  idealProfile?: string
}

/** 評価軸のルーブリック（1〜5点の各段階の定義） */
export type Rubric = Record<'1' | '2' | '3' | '4' | '5', string>

/** 主質問にぶら下がる分岐（回答に応じた深掘り・スキップ） */
export interface GeneratedBranch {
  label: string
  matchHint: string
  text?: string
  /** 指定があればこの主質問(1始まり)まで飛ばす */
  skipTo?: number | null
}

/** テンプレート生成の出力 */
export interface GeneratedTemplate {
  criteria: Array<{
    key: string
    name: string
    description: string
    rubric: Rubric
    weight: number
  }>
  questions: Array<{
    text: string
    followUpHint: string
    targetMin: number
    criterionKeys: string[]
    branches?: GeneratedBranch[]
  }>
  intro: string
  closing: string
}

/** 1軸ぶんの採点結果 */
export interface CriterionScore {
  criterionKey: string
  score: number | null
  insufficient: boolean
  rationale: string
  quotes: string[]
}

/** 評価バッチの出力 */
export interface EvaluationResult {
  scores: CriterionScore[]
  verdict: Verdict
  overallComment: string
  candidateFeedback: string
  recruiterReport: string
}

/** 面接中の進行判断（Realtime の function calling で使う） */
export type AdvanceAction = 'follow_up' | 'next_question' | 'close'

export interface AdvanceResult {
  action: AdvanceAction
  questionOrd: number | null
  questionText: string | null
  followUpCount: number
  remainingCount: number
  /** 面接を終了すべきか（残り時間切れ・全問消化） */
  shouldClose: boolean
}
