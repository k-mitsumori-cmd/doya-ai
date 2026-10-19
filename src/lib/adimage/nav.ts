// ============================================
// ドヤ広告画像AI ツール内ナビ（データ）
// ============================================
// ⚠️ 共通の枠（ToolFrame）の nav と、旧サイドバー（AdImageSidebar）の両方がこの配列を使う。
// ⚠️ アイコンは名前の文字列で書く（部品を渡すと 500 になる）。
import type { ShellNavItem } from '@/components/shell/nav'

export const ADIMAGE_BASE = '/adimage'

export const ADIMAGE_NAV: ShellNavItem[] = [
  { label: '広告画像をつくる', href: ADIMAGE_BASE, icon: 'Megaphone', exact: true },
  { label: 'これまでの画像', href: `${ADIMAGE_BASE}/history`, icon: 'History' },
  { label: '料金プラン', href: `${ADIMAGE_BASE}/pricing`, icon: 'CreditCard' },
]
