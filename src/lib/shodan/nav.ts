// ============================================
// ドヤ商談準備: ツール内ナビの項目（統合仕様 R-1）
// ============================================
// 項目はデータで持つ。共通シェル（UI_SHELL_SERVICES に shodan）では ToolFrame の nav に渡し、
// 今のサイドバー（ShodanSidebar）もこれを描くだけにする。形は ShellNavItem（src/components/shell/nav.ts）。
// ⚠️ icon は名前の文字列で書く。関数を持たせると、サーバの layout.tsx からクライアント部品へ渡せず全画面が 500 になる
// ⚠️ 組織は URL の slug で決まるため、項目は slug から作る
import type { ShellNavItem } from '@/components/shell/nav'

export interface ShodanNavItem extends ShellNavItem {
  /** 今のサイドバーで目立たせる項目 */
  hot?: boolean
}

export function shodanNav(orgSlug: string): ShodanNavItem[] {
  const base = `/shodan/${encodeURIComponent(orgSlug)}`
  return [
    { label: '商談準備一覧', href: base, icon: 'LayoutDashboard', exact: true },
    { label: '新規作成', href: `${base}/new`, icon: 'Sparkles', hot: true },
    { label: '自社情報', href: `${base}/settings`, icon: 'Building2' },
    { label: 'メンバー', href: `${base}/members`, icon: 'Users' },
  ]
}
