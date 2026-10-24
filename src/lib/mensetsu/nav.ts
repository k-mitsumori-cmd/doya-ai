import type { ShellNavItem } from '@/components/shell/nav'

// ドヤ面接官のナビ。サイドバー（MensetsuSidebar）と共通の枠（ToolFrame）の両方がこの配列を描く。
export const MENSETSU_NAV: ShellNavItem[] = [
  { label: '面接を用意する', href: '/mensetsu', icon: 'UserCheck', exact: true },
  { label: '候補者を比較', href: '/mensetsu/compare', icon: 'Users' },
  { label: '設定', href: '/mensetsu/settings', icon: 'Settings' },
]
