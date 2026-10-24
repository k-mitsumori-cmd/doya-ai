// ============================================
// ドヤ社内インタビュー ツール内ナビ（データ）
// ============================================
// ⚠️ 統合仕様 R-1: 項目はここにだけ書く。
//    共通シェル（ui.shell.shanai=ON）では ToolFrame の nav に、OFF のあいだは暫定の ShanaiSidebar に同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide を import しない）。部品（関数）はサーバーからクライアントへ渡せず、
//    渡すと画面を開いたときに 500 になる。名前は src/components/shell/icons.tsx の対応表にあるものを使う
import { isNavActive as isShellNavActive, type ShellNavItem } from '@/components/shell/nav'

export interface ShanaiNavItem extends ShellNavItem {
  /** 暫定サイドバーで目立たせる（新規作成など） */
  hot?: boolean
}

export const SHANAI_BASE = '/shanai'

export const SHANAI_NAV: ShanaiNavItem[] = [
  // 一覧はツールのトップなので exact にする（/shanai/company などで一覧が選択中にならないように）。
  // 詳細（/shanai/interviews/…）を一覧の中として扱う判定は、下の isNavActive で足す
  { label: 'インタビュー一覧', href: SHANAI_BASE, icon: 'List', exact: true },
  { label: '新しく作る', href: SHANAI_BASE + '/new', icon: 'Plus', hot: true },
  { label: '会社情報', href: SHANAI_BASE + '/company', icon: 'Building2' },
]

/** pathname がその項目の選択中にあたるか（インタビュー詳細は「インタビュー一覧」の中） */
export function isNavActive(item: ShanaiNavItem, pathname: string): boolean {
  if (item.href === SHANAI_BASE && pathname.startsWith(SHANAI_BASE + '/interviews')) return true
  return isShellNavActive(pathname, item)
}
