// ============================================
// ドヤ社内インタビュー サイドバーの項目（データ）
// ============================================
// ⚠️ 統合仕様 R-1: 項目はここにだけ書く。ShanaiSidebar はこれを描くだけにする。
//    段0（AppShell）で manifest.ui.nav[] にそのまま移す。icon は lucide のアイコン名
export interface ShanaiNavItem {
  label: string
  href: string
  icon: 'BookUser' | 'Plus' | 'Building2' | 'CreditCard'
  /** 目立たせる（新規作成など） */
  hot?: boolean
  /** この項目の下にあるパスも「選択中」とみなす */
  matchPrefixes?: string[]
  minServiceRole?: 'member' | 'admin'
}

export const SHANAI_BASE = '/shanai'

export const SHANAI_NAV: ShanaiNavItem[] = [
  { label: 'インタビュー一覧', href: SHANAI_BASE, icon: 'BookUser', matchPrefixes: [SHANAI_BASE + '/interviews'] },
  { label: '新しく作る', href: SHANAI_BASE + '/new', icon: 'Plus', hot: true },
  { label: '会社情報', href: SHANAI_BASE + '/company', icon: 'Building2' },
  { label: '料金プラン', href: SHANAI_BASE + '/pricing', icon: 'CreditCard' },
]

/** pathname がその項目の選択中にあたるか */
export function isNavActive(item: ShanaiNavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  if (item.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  return item.href !== SHANAI_BASE && pathname.startsWith(item.href + '/')
}
