// ============================================
// ドヤカンニング ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。CunningSidebar（今のサイドバー）と CunningShellFrame（共通の枠）が同じ配列を使う
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すとサーバーからクライアントへ渡せず 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export interface CunningNavItem extends ShellNavItem {
  /** 今のサイドバーで目立たせる */
  hot?: boolean
}

export const CUNNING_MAIN_NAV: CunningNavItem[] = [
  // ライブ画面（/cunning/live/...）は、今のサイドバーでは「ライブ開始」の中として扱う（isCunningNavActive）
  { label: 'ライブ開始', href: '/cunning', icon: 'LayoutDashboard', exact: true, hot: true },
]

export const CUNNING_SUB_NAV: CunningNavItem[] = [
  { label: 'ナレッジ（商談）', href: '/cunning/knowledge', icon: 'BookOpen' },
  { label: '企業・プロフィール（面接）', href: '/cunning/company', icon: 'Building2' },
  { label: '履歴', href: '/cunning/history', icon: 'History' },
]

export const CUNNING_NAV: CunningNavItem[] = [...CUNNING_MAIN_NAV, ...CUNNING_SUB_NAV]

/** 今のサイドバーの選択中の判定（ライブ画面は「ライブ開始」の中） */
export function isCunningNavActive(href: string, pathname: string | null | undefined): boolean {
  const p = pathname ?? ''
  if (href === '/cunning') return p === '/cunning' || p.startsWith('/cunning/live')
  return p.startsWith(href)
}
