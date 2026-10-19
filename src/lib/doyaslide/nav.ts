// ============================================
// ドヤスライド ツール内ナビ（データ）
// ============================================
// ⚠️ 共通の枠（ToolFrame）の nav にそのまま渡す。アイコンは名前の文字列で書く（部品を渡すと 500 になる）。
// ⚠️ 旧サイドバー（DoyaSlideSidebar）は、検証スクリプトが本文を固定しているため、同じ項目を中に持っている。
//    項目を変えるときは両方を直す。
import type { ShellNavItem } from '@/components/shell/nav'

export const DOYASLIDE_NAV: ShellNavItem[] = [
  { label: '新規作成', href: '/doyaslide/new', icon: 'Plus' },
  { label: 'プロジェクト', href: '/doyaslide/projects', icon: 'LayoutDashboard' },
  { label: '料金プラン', href: '/doyaslide/pricing', icon: 'CreditCard' },
]
