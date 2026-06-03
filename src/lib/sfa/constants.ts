// ============================================
// ドヤ営業管理（SFA）定数
// ============================================
import type { LeadStatus, ActivityType } from './types'

/** 既定パイプラインのステージ（見込み→…→受注/失注） */
export const DEFAULT_STAGES: {
  name: string
  order: number
  probability: number
  color: string
  isWon?: boolean
  isLost?: boolean
}[] = [
  { name: '見込み', order: 0, probability: 10, color: '#94a3b8' },
  { name: 'アプローチ', order: 1, probability: 20, color: '#38bdf8' },
  { name: '提案', order: 2, probability: 40, color: '#22c55e' },
  { name: '見積', order: 3, probability: 60, color: '#84cc16' },
  { name: '交渉', order: 4, probability: 80, color: '#f59e0b' },
  { name: '受注', order: 5, probability: 100, color: '#16a34a', isWon: true },
  { name: '失注', order: 6, probability: 0, color: '#ef4444', isLost: true },
]

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: '新規',
  working: '対応中',
  nurturing: '育成中',
  qualified: '有望',
  converted: '転換済',
  disqualified: '除外',
}

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  call: '電話',
  meeting: '商談・訪問',
  email: 'メール',
  note: 'メモ',
}

export const ACTIVITY_TYPE_ICON: Record<ActivityType, string> = {
  call: 'call',
  meeting: 'groups',
  email: 'mail',
  note: 'sticky_note_2',
}

/** 最終活動からこの日数を超えたら停滞アラート */
export const STALE_DEAL_DAYS = 14
