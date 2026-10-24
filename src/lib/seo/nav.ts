// ============================================
// ドヤ記事作成（SEO）ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通の枠（ToolFrame）にも、今のサイドバー（SeoSidebar）にも、同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すと、サーバーの layout から渡したときに 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export const SEO_NAV: ShellNavItem[] = [
  { label: 'スワイプ記事作成', href: '/seo/swipe', icon: 'Sparkles' },
  { label: 'テンプレ記事作成', href: '/seo/template', icon: 'LayoutTemplate' },
  { label: '生成記事一覧', href: '/seo', icon: 'FileText', exact: true },
]

/** 料金プランの行き先。ログイン後はプラン管理の画面、未ログインは料金ページ（見出しの帯の「現在のプラン」で使う） */
export function seoNavHref(href: string, isLoggedIn: boolean): string {
  return href === '/seo/pricing' && isLoggedIn ? '/seo/dashboard/plan' : href
}
