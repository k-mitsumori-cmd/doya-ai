// ============================================
// ドヤ収入管理: ツール内ナビ（データ。ADDON-SERVICES R-1）
// ============================================
// ⚠️ ToolFrame の nav にそのまま渡す（src/app/income/layout.tsx）。将来の manifest.ui.nav[] と同じ形。
// ⚠️ アイコンは名前（src/components/shell/icons.tsx の SHELL_ICONS のキー）で持つ。サーバーの layout から渡せるように部品は持たない。
// ⚠️ ここに無い項目を画面側で足さない（D-1）。
import type { ShellNavItem } from '@/components/shell/nav'

export const INCOME_NAV: ShellNavItem[] = [
  { label: 'ダッシュボード', href: '/income', icon: 'LayoutDashboard', exact: true },
  { label: '月次売上', href: '/income/revenue', icon: 'Calendar' },
  { label: '請求書', href: '/income/invoices', icon: 'Receipt' },
  { label: '入金・消込', href: '/income/payments', icon: 'Wallet' },
  { label: '契約', href: '/income/contracts', icon: 'FileText' },
  { label: '取引先', href: '/income/clients', icon: 'Building2' },
  { label: '設定', href: '/income/settings', icon: 'Settings' },
  { label: '料金プラン', href: '/income/pricing', icon: 'CreditCard' },
]
