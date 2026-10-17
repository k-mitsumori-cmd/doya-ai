// ============================================
// ツール内ナビの型（各ツールの src/lib/<svc>/nav.ts が使う）
// ============================================
// ⚠️ ナビはデータで持つ（ADDON-SERVICES R-1）。独自サイドバーはこれを描くだけにし、
//    AppShell に載せ替えるときは ToolFrame の nav にそのまま渡す。
//    将来の manifest.ui.nav[]（README §18.6 手順 2）と同じ形。
import type { ShellIconName } from './icons'

export interface ShellNavItem {
  label: string
  href: string
  /** アイコンの名前（例: 'FileText'）。部品（関数）は渡さない。サーバーの layout.tsx から渡せるようにするため */
  icon?: ShellIconName
  /** 表示に必要な最低ロール（ツール側の役割名。判定はツール側で行い、ここでは表示を絞るだけ） */
  minServiceRole?: string
  /** href と完全一致のときだけ選択中にする（ツールのトップなど） */
  exact?: boolean
}

export function isNavActive(pathname: string, item: Pick<ShellNavItem, 'href' | 'exact'>): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
