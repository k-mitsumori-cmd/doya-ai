// ============================================
// ドヤプロマネ ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通シェル（ui.shell.promane=ON）では ToolFrame の nav に、
//    OFF のあいだは今のサイドバー（components/promane/sidebar.tsx）に同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide を import しない）。部品（関数）はサーバーからクライアントへ渡せない
import type { ShellNavItem } from '@/components/shell/nav'

/** suffix はワークスペースのトップ（/promane/<slug>）からの続き。空文字がダッシュボード */
export const PROMANE_NAV_ITEMS: { label: string; suffix: string; icon: string }[] = [
  { label: 'ダッシュボード', suffix: '', icon: 'LayoutDashboard' },
  { label: 'プロジェクト', suffix: '/projects', icon: 'FolderKanban' },
  { label: '顧客管理', suffix: '/clients', icon: 'Building2' },
  { label: 'メンバー', suffix: '/members', icon: 'Users' },
  { label: 'タイムシート', suffix: '/timesheet', icon: 'Timer' },
  { label: 'レポート', suffix: '/reports', icon: 'BarChart3' },
  { label: '使い方', suffix: '/help', icon: 'Lightbulb' },
  { label: '設定', suffix: '/settings', icon: 'Settings' },
]

export function promaneBasePath(workspaceSlug: string): string {
  return `/promane/${workspaceSlug}`
}

export function promaneNav(workspaceSlug: string): ShellNavItem[] {
  const base = promaneBasePath(workspaceSlug)
  return PROMANE_NAV_ITEMS.map((i) => ({ label: i.label, href: `${base}${i.suffix}`, icon: i.icon, exact: i.suffix === '' }))
}
