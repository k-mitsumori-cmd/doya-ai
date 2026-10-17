// ============================================
// ドヤポップアップ: サイドバーの項目（統合仕様 R-1）
// ============================================
// 項目はデータで持ち、暫定の PopupSidebar はこれを描くだけにする。
// 段0（AppShell）が入ったら manifest.ui.nav[] にそのまま移す。
// icon は名前で持つ（描画側で lucide のアイコンに対応させる。マニフェストに関数を持ち込まない）。

export type PopupNavIcon = 'popup' | 'pricing'

export interface PopupNavItem {
  label: string
  href: string
  icon: PopupNavIcon
  /** この項目を見せる最低限のサービス内ロール（無ければ全員） */
  minServiceRole?: 'member' | 'manager' | 'admin' | 'owner'
  /** この href の下の画面でも選択中にする（サイト詳細・編集画面など） */
  activePrefixes?: string[]
}

export const POPUP_NAV: PopupNavItem[] = [
  { label: 'サイトとポップアップ', href: '/popup', icon: 'popup', activePrefixes: ['/popup/sites', '/popup/edit'] },
  { label: '料金プラン', href: '/popup/pricing', icon: 'pricing' },
]

/** その項目が選択中か（サイドバーの表示用） */
export function isPopupNavActive(item: PopupNavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  if (item.href !== '/popup' && pathname.startsWith(item.href + '/')) return true
  return (item.activePrefixes || []).some((p) => pathname === p || pathname.startsWith(p + '/'))
}
