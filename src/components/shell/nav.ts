// ============================================
// ツール内ナビの型（各ツールの src/lib/<svc>/nav.ts が使う）
// ============================================
// ⚠️ ナビはデータで持つ（ADDON-SERVICES R-1）。独自サイドバーはこれを描くだけにし、
//    AppShell に載せ替えるときは ToolFrame の nav にそのまま渡す。
//    将来の manifest.ui.nav[]（README §18.6 手順 2）と同じ形。
// ⚠️ 「料金プラン」のタブは、どのツールのナビにも入れない（2026-10-24 ユーザーの決定 FRM-04）。
//    料金は、枠の左下のアカウント欄（/pricing）と、ToolFrame の「このツールの残りとプラン」から開く。
//    各ツールの料金のページ（/<ツール>/pricing）は消さない。直リンクで開けるまま残す。
//    registry.test.ts が、どのツールのタブにも料金のページが無いことを確かめている。
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
  // href のクエリ（料金の ?org= など）は、選択中かの判定には使わない（パスだけで比べる）
  const href = item.href.split(/[?#]/)[0]
  if (item.exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
