// ============================================
// ドヤHR ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通の枠（UI_SHELL_SERVICES に hr）では ToolFrame の nav に、
//    それ以外では HrSidebar に同じ配列を渡す（docs/architecture/management-agent/SHELL-MIGRATION.md §2.3）。
// ⚠️ アイコンは名前の文字列で書く（lucide を import しない）。名前は src/components/shell/icons.tsx の対応表にあるもの
import type { ShellNavItem } from '@/components/shell/nav'

export interface HrNavItem extends ShellNavItem {
  /** サイドバーで目立たせる（従業員を追加） */
  hot?: boolean
}

/** 「従業員を追加」の href。管理者（usage の canManageEmployees）のときだけ出す */
export const HR_ADD_EMPLOYEE_HREF = '/hr/employees/new'

export const HR_MAIN_NAV: HrNavItem[] = [
  { href: HR_ADD_EMPLOYEE_HREF, label: '従業員を追加', icon: 'UserPlus', hot: true },
  { href: '/hr/dashboard', label: 'ダッシュボード', icon: 'LayoutDashboard', exact: true },
  { href: '/hr/employees', label: '従業員', icon: 'Users' },
  { href: '/hr/org-chart', label: '組織図', icon: 'Network' },
  { href: '/hr/evaluations', label: '評価', icon: 'ClipboardList' },
]

/** サイドバーでは「管理」の見出しの下に出す */
export const HR_ADMIN_NAV: HrNavItem[] = [
  { href: '/hr/settings', label: '設定', icon: 'Settings', exact: true },
  { href: '/hr/settings/billing', label: '現在のプラン', icon: 'CreditCard' },
]

/** 表示の条件（従業員を追加は管理者だけ）を当てた一覧 */
export function visibleHrNav(items: HrNavItem[], canManageEmployees: boolean): HrNavItem[] {
  return items.filter((item) => item.href !== HR_ADD_EMPLOYEE_HREF || canManageEmployees)
}

/** 枠のタブに渡す一覧（本体のあとに管理を並べる） */
export function hrShellNav(canManageEmployees: boolean): HrNavItem[] {
  return [...visibleHrNav(HR_MAIN_NAV, canManageEmployees), ...HR_ADMIN_NAV]
}
