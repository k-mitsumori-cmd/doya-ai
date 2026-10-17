// ============================================
// ドヤ支出管理: ナビ項目（データで持つ。ADDON-SERVICES §3 R-1）
// ============================================
// ⚠️ サイドバーはこの配列を描くだけ。項目を足すときはここだけを直す。
//    AppShell（段 0）が main に入ったら、manifest.ui.nav[] にこのまま移す。
import type { LucideIcon } from 'lucide-react'
import { CalendarClock, FileText, LayoutDashboard, LineChart, Settings, UserRound, CreditCard } from 'lucide-react'
import type { ExpenseRole } from './constants'

export type ExpenseNavItem = {
  label: string
  /** 組織の中の相対パス（'' はダッシュボード）。組織の外は absolute: true */
  href: string
  icon: LucideIcon
  minServiceRole?: ExpenseRole
  absolute?: boolean
}

export const EXPENSE_NAV: ExpenseNavItem[] = [
  { label: 'ダッシュボード', href: '', icon: LayoutDashboard },
  { label: '支払予定', href: '/payables', icon: CalendarClock },
  { label: '業務委託', href: '/contractors', icon: UserRound },
  { label: '支出契約', href: '/contracts', icon: FileText },
  { label: '予測', href: '/forecast', icon: LineChart },
  { label: '設定', href: '/settings', icon: Settings, minServiceRole: 'admin' },
  { label: '料金プラン', href: '/expense/pricing', icon: CreditCard, absolute: true },
]

/** 実際のリンク先 */
export function expenseNavHref(item: ExpenseNavItem, orgSlug: string): string {
  return item.absolute ? item.href : `/expense/${encodeURIComponent(orgSlug)}${item.href}`
}
