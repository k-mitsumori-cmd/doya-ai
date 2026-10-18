// ============================================
// ドヤ営業管理（SFA）のツール内ナビ
// ============================================
// SfaSidebar（今のサイドバー）と SfaShellFrame（共通の枠の ToolFrame）が、同じこの配列を描く。
// ⚠️ icon は名前の文字列。lucide の部品（関数）を入れない（サーバーから渡すと全画面が 500 になる）。
// ⚠️ 担当者（contacts）・活動（activities）・リード（leads）は 2026-06-12 にメニューから廃止。ページは URL 直アクセスで残っている。
import type { ShellNavItem } from '@/components/shell/nav'

/** 日本語の slug は useParams() から URL エンコードされたまま届くので、二重エンコードを避けて 1 回だけデコードする（2026-10-18） */
export function normalizeOrgSlug(slug: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(slug)) return slug
  try { return decodeURIComponent(slug) } catch { return slug }
}

export function sfaPricingHref(orgSlug: string): string {
  return `/sfa/pricing?org=${encodeURIComponent(normalizeOrgSlug(orgSlug))}`
}

/** サイドバーの上段（主な機能） */
export function sfaMainNav(orgSlug: string): ShellNavItem[] {
  const base = `/sfa/${orgSlug}`
  return [
    { label: 'ダッシュボード', href: base, icon: 'LayoutDashboard', exact: true },
    { label: '商談（パイプライン）', href: `${base}/deals`, icon: 'Kanban' },
    { label: '取引先', href: `${base}/accounts`, icon: 'Building2' },
    { label: 'タスク・活動', href: `${base}/tasks`, icon: 'CheckSquare' },
  ]
}

/** サイドバーの下段（その他） */
export function sfaSubNav(orgSlug: string): ShellNavItem[] {
  return [
    { label: 'メンバー', href: `/sfa/${orgSlug}/members`, icon: 'UserPlus' },
    { label: '料金プラン', href: sfaPricingHref(orgSlug), icon: 'Tag' },
  ]
}

export function sfaNav(orgSlug: string): ShellNavItem[] {
  return [...sfaMainNav(orgSlug), ...sfaSubNav(orgSlug)]
}
