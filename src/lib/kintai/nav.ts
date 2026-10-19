import type { ShellNavItem } from '@/components/shell/nav'
import { hasMinRole } from '@/lib/kintai/access-client'
import type { KintaiMemberRole } from '@/lib/kintai/types'

/** 全員に出す項目。打刻は従業員が有効なときだけ出す（requiresActiveEmployee） */
export const KINTAI_NAV_BASE: (ShellNavItem & { requiresActiveEmployee?: boolean })[] = [
  { label: 'マイページ', href: '/kintai/dashboard', icon: 'LayoutDashboard', exact: true },
  { label: '打刻', href: '/kintai/clock', icon: 'Clock', requiresActiveEmployee: true },
  { label: '勤怠一覧', href: '/kintai/attendance', icon: 'CalendarDays' },
  { label: 'マイ申請', href: '/kintai/requests', icon: 'FileText' },
]

/** 管理（マネージャー以上） */
export const KINTAI_NAV_MANAGER: ShellNavItem[] = [
  { label: '承認管理', href: '/kintai/approvals', icon: 'CheckSquare', minServiceRole: 'manager' },
  { label: '部署勤怠', href: '/kintai/admin/attendance', icon: 'BarChart3', minServiceRole: 'manager' },
]

/** 設定（人事管理者以上） */
export const KINTAI_NAV_ADMIN: ShellNavItem[] = [
  { label: '従業員管理', href: '/kintai/employees', icon: 'Users', minServiceRole: 'hr_admin' },
  { label: '部署管理', href: '/kintai/departments', icon: 'Building2', minServiceRole: 'hr_admin' },
  { label: '就業ルール', href: '/kintai/settings', icon: 'Settings', minServiceRole: 'hr_admin' },
]

export interface KintaiNavGroups {
  base: ShellNavItem[]
  manager: ShellNavItem[]
  admin: ShellNavItem[]
}

/** ロールと従業員の有効状態から、出す項目を決める。サイドバーも ToolFrame も同じ結果を使う */
export function buildKintaiNavGroups(role: string, employeeActive: boolean): KintaiNavGroups {
  const visible = (item: ShellNavItem) => !item.minServiceRole || hasMinRole(role, item.minServiceRole as KintaiMemberRole)
  return {
    base: KINTAI_NAV_BASE.filter((item) => employeeActive || !item.requiresActiveEmployee),
    manager: KINTAI_NAV_MANAGER.filter(visible),
    admin: KINTAI_NAV_ADMIN.filter(visible),
  }
}

export function buildKintaiNav(role: string, employeeActive: boolean): ShellNavItem[] {
  const g = buildKintaiNavGroups(role, employeeActive)
  return [...g.base, ...g.manager, ...g.admin]
}
