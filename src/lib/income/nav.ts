// ============================================
// ドヤ収入管理: ナビ項目（データ。ADDON-SERVICES R-1）
// ============================================
// ⚠️ サイドバーはこの配列を描くだけにする。AppShell に載せるときは manifest.ui.nav[] にそのまま移す。
// ⚠️ React に依存させない（エージェント・マニフェストからも読む）。アイコンは icons.tsx の名前で持つ。
import type { UiIconName } from '@/components/icons'
import type { IncomeRole } from './roles'

export type IncomeNavItem = {
  label: string
  href: string
  icon: UiIconName
  /** この役割以上にだけ出す（未指定は全員） */
  minServiceRole?: IncomeRole
  group: 'main' | 'settings'
}

export const INCOME_NAV: IncomeNavItem[] = [
  { label: 'ダッシュボード', href: '/income', icon: 'dashboard', group: 'main' },
  { label: '月次売上', href: '/income/revenue', icon: 'calendarRange', group: 'main' },
  { label: '請求書', href: '/income/invoices', icon: 'document', group: 'main' },
  { label: '入金・消込', href: '/income/payments', icon: 'wallet', group: 'main' },
  { label: '契約', href: '/income/contracts', icon: 'contract', group: 'main' },
  { label: '取引先', href: '/income/clients', icon: 'building', group: 'main' },
  { label: '設定', href: '/income/settings', icon: 'settings', group: 'settings' },
  { label: '料金プラン', href: '/income/pricing', icon: 'card', group: 'settings' },
]

/** その href がナビのどれに当たるか（一番長く一致したもの） */
export function activeNavHref(pathname: string): string | null {
  const hits = INCOME_NAV.filter((n) => (n.href === '/income' ? pathname === '/income' : pathname === n.href || pathname.startsWith(n.href + '/')))
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
}
