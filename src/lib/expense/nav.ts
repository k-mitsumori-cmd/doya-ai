// ============================================
// ドヤ支出管理: ツール内ナビ（データで持つ。ADDON-SERVICES §3 R-1）
// ============================================
// ⚠️ ToolFrame の nav にそのまま渡す。項目を足すときはここだけを直す。
//    将来の manifest.ui.nav[]（README §18.6 手順 2）と同じ形（ShellNavItem）。
// ⚠️ 料金プランは AppShell 側の導線に任せ、ツール内ナビには入れない。
import type { ShellNavItem } from '@/components/shell/nav'
import { ROLE_RANK, type ExpenseRole } from './constants'

type ExpenseNavDef = Omit<ShellNavItem, 'href' | 'minServiceRole'> & { path: string; minServiceRole?: ExpenseRole }

/** 組織の中の相対パス（'' はダッシュボード） */
export const EXPENSE_NAV: ExpenseNavDef[] = [
  { label: 'ダッシュボード', path: '', icon: 'LayoutDashboard', exact: true },
  { label: '支払予定', path: '/payables', icon: 'CalendarClock' },
  { label: '業務委託', path: '/contractors', icon: 'UserRound' },
  { label: '支出契約', path: '/contracts', icon: 'FileText' },
  { label: '予測', path: '/forecast', icon: 'LineChart' },
  { label: '設定', path: '/settings', icon: 'Settings', minServiceRole: 'admin' },
]

/** その組織・権限で ToolFrame に渡すナビ。権限が足りない項目は出さない */
export function expenseNav(orgSlug: string, role: ExpenseRole | null): ShellNavItem[] {
  const base = `/expense/${encodeURIComponent(orgSlug)}`
  return EXPENSE_NAV.filter((i) => !i.minServiceRole || (role !== null && ROLE_RANK[role] >= ROLE_RANK[i.minServiceRole])).map(({ path, ...i }) => ({
    ...i,
    href: `${base}${path}`,
  }))
}
