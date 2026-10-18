// ============================================
// ドヤポップアップ: ツール内ナビの項目（統合仕様 R-1）
// ============================================
// 項目はデータで持つ。共通シェル（ui.shell.popup が ON）では、サーバの layout.tsx から ToolFrame の nav にそのまま渡し、
// OFF の間の暫定サイドバー（PopupSidebar）もこれを描くだけにする。
// 形は段0の ShellNavItem（src/components/shell/nav.ts）。将来の manifest.ui.nav[] と同じ。
// ⚠️ icon は名前の文字列で書く（src/components/shell/icons.tsx の対応表の名前）。関数を持たせると、
//    サーバの layout.tsx からクライアント部品へ渡せず全画面が 500 になる
import type { ShellNavItem } from '@/components/shell/nav'

export interface PopupNavItem extends ShellNavItem {
  /** 暫定サイドバーで、この href の下の画面でも選択中にする（サイト詳細・編集画面など） */
  activePrefixes?: string[]
}

export const POPUP_NAV: PopupNavItem[] = [
  // ⚠️ exact: '/popup/pricing' でトップまで選択中にならないように
  { label: 'サイトとポップアップ', href: '/popup', icon: 'PanelTopOpen', exact: true, activePrefixes: ['/popup/sites', '/popup/edit'] },
  { label: '料金プラン', href: '/popup/pricing', icon: 'CreditCard' },
]

/** 暫定サイドバーでの選択中の判定（共通シェルでは ToolFrame の isNavActive を使う） */
export function isPopupNavActive(item: PopupNavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  if (!item.exact && pathname.startsWith(item.href + '/')) return true
  return (item.activePrefixes || []).some((p) => pathname === p || pathname.startsWith(p + '/'))
}
