// ============================================
// ドヤAIO ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通シェル（ui.shell.aio=ON）では ToolFrame の nav に、
//    OFF のあいだは AioSidebar に、同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide を import しない）。部品（関数）はサーバーからクライアントへ渡せず、
//    渡すと画面を開いたときに 500 になる。名前は src/components/shell/icons.tsx の対応表にあるものを使う
// ⚠️ ブランド設定/監視プロンプトは URL 一本フローに合わせてナビから外している（自動セットアップ。ページ自体は残置）
import type { ShellNavItem } from '@/components/shell/nav'

export interface AioNavItem extends ShellNavItem {
  /** サイドバーで目立たせる（URL AI調査） */
  hot?: boolean
}

/** 組織の slug から、ナビの項目を作る（slug は URL のデコード済みの値） */
export function buildAioNav(orgSlug: string): AioNavItem[] {
  const base = `/aio/${encodeURIComponent(orgSlug)}`
  return [
    { label: 'URL AI調査', href: `${base}/scan`, icon: 'ScanSearch', hot: true },
    { label: 'ダッシュボード', href: base, icon: 'LayoutDashboard', exact: true },
    { label: 'スキャン履歴', href: `${base}/history`, icon: 'History' },
    // 料金ページは組織の下ではなく /aio/pricing。組織は ?org= で渡す
    { label: '料金プラン', href: `/aio/pricing?org=${encodeURIComponent(orgSlug)}`, icon: 'CreditCard' },
  ]
}
