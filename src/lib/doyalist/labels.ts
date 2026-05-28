// ドヤリスト用ラベル定義の一元管理
// 全UI/APIで同じ表示にするためここからimport

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  new: '新規',
  contacted: 'コンタクト済み',
  replied: '返信あり',
  won: '受注',
  lost: '失注',
}

export const COMPANY_STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-amber-100 text-amber-700',
  replied: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
}

export const APPROACH_TYPE_LABELS: Record<string, string> = {
  email: 'メール',
  dm: 'DM',
  phone: '電話',
  letter: '手紙',
  form: 'お問い合わせフォーム',
  phone_script: '電話スクリプト',
}

export const APPROACH_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送信済み',
  replied: '返信あり',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  archived: 'アーカイブ',
}

export function getCompanyStatusLabel(status: string | null | undefined): string {
  if (!status) return '-'
  return COMPANY_STATUS_LABELS[status] || status
}

export function getApproachTypeLabel(type: string | null | undefined): string {
  if (!type) return '-'
  return APPROACH_TYPE_LABELS[type] || type
}
