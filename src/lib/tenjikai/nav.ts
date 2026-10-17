// ドヤ展示会のナビ項目（ADDON-SERVICES R-1）。
// 共通シェル（ui.shell.tenjikai が ON）のときは ToolFrame の nav に、OFF のときは暫定の TenjikaiSidebar に、同じ配列を渡す。
// manifest.ui.nav[] にもそのまま移す。型は共通シェルの ShellNavItem に合わせる。
// ⚠️ セクションは /tenjikai/<section> の URL で表す（シェルのタブは pathname で選択中を決めるため）。
//    画面の状態は src/app/tenjikai/layout.tsx に置いた TenjikaiApp が持つので、セクションを移っても消えない。

import type { ShellNavItem } from '@/components/shell/nav'
import type { ShellIconName } from '@/components/shell/icons'

export const SECTIONS = ['new', 'overview', 'booth', 'creatives', 'novelty', 'budget', 'vendors', 'docs'] as const
export type Section = (typeof SECTIONS)[number]

export interface TenjikaiNavItem extends ShellNavItem {
  section: Section
  icon: ShellIconName
  /** 出展プロジェクトができる前から開ける項目 */
  availableBeforeProject?: boolean
  hot?: boolean
}

export const sectionHref = (s: Section) => (s === 'new' ? '/tenjikai' : `/tenjikai/${s}`)

/** URL のパスからセクションを決める。/tenjikai と知らないパスは 'new' */
export function sectionFromPath(pathname: string | null | undefined): Section {
  const seg = (pathname ?? '').replace(/^\/tenjikai\/?/, '').split('/')[0]
  return (SECTIONS as readonly string[]).includes(seg) && seg !== 'new' ? (seg as Section) : 'new'
}

export const TENJIKAI_NAV: TenjikaiNavItem[] = [
  { section: 'new', label: '新規出展プロジェクト', href: sectionHref('new'), exact: true, icon: 'PlusCircle', availableBeforeProject: true, hot: true },
  { section: 'overview', label: '概要ダッシュボード', href: sectionHref('overview'), icon: 'LayoutDashboard' },
  { section: 'booth', label: 'ブース設計', href: sectionHref('booth'), icon: 'Box' },
  { section: 'creatives', label: '制作物スタジオ', href: sectionHref('creatives'), icon: 'Palette' },
  { section: 'novelty', label: 'ノベルティ', href: sectionHref('novelty'), icon: 'Gift' },
  { section: 'budget', label: '予算シミュレーター', href: sectionHref('budget'), icon: 'Wallet' },
  { section: 'vendors', label: '業者選定・発注', href: sectionHref('vendors'), icon: 'Truck' },
  { section: 'docs', label: '資料庫・締切', href: sectionHref('docs'), icon: 'FolderOpen' },
]
