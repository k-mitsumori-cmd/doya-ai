// ============================================
// ドヤAI商談 ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通シェル（UI_SHELL_SERVICES に aishodan）では ToolFrame の nav に、
//    それ以外は AishodanSidebar に、同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide を import しない）。部品（関数）はサーバーからクライアントへ渡せず、
//    渡すと画面を開いたときに 500 になる。名前は src/components/shell/icons.tsx の対応表にあるものを使う
import { isNavActive as isShellNavActive, type ShellNavItem } from '@/components/shell/nav'

export interface AishodanNavItem extends ShellNavItem {
  /** サイドバーで目立たせる */
  hot?: boolean
}

export const AISHODAN_BASE = '/aishodan'

export const AISHODAN_NAV: AishodanNavItem[] = [
  { label: 'ホーム', href: AISHODAN_BASE, icon: 'MessagesSquare', exact: true, hot: true },
  { label: '商談ログ', href: AISHODAN_BASE + '/sessions', icon: 'ClipboardList' },
  { label: '練習モード', href: AISHODAN_BASE + '/preview', icon: 'DoorOpen' },
  { label: '設定', href: AISHODAN_BASE + '/settings', icon: 'Settings' },
]

export function isNavActive(item: AishodanNavItem, pathname: string): boolean {
  return isShellNavActive(pathname, item)
}
