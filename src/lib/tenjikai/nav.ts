// ドヤ展示会のサイドバー項目（ADDON-SERVICES R-1）。
// TenjikaiSidebar はこの配列を描画するだけにする。リニューアルの AppShell に載せるときは
// manifest.ui.nav[] にそのまま移す（label / href / icon / minServiceRole）。
// ⚠️ 今は 1 画面の中でセクションを切り替えているので、href はセクションを指す ?section= 付きの URL。

import { Box, FolderOpen, Gift, LayoutDashboard, Palette, PlusCircle, Truck, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Section = 'new' | 'overview' | 'booth' | 'creatives' | 'novelty' | 'budget' | 'vendors' | 'docs'

export interface TenjikaiNavItem {
  section: Section
  label: string
  href: string
  icon: LucideIcon
  /** 個人単位のツールなので今は使わない。組織単位にしたときのための予約 */
  minServiceRole?: 'owner' | 'admin' | 'member' | 'guest'
  /** 出展プロジェクトができる前から開ける項目 */
  availableBeforeProject?: boolean
  hot?: boolean
}

const href = (s: Section) => (s === 'new' ? '/tenjikai' : `/tenjikai?section=${s}`)

export const TENJIKAI_NAV: TenjikaiNavItem[] = [
  { section: 'new', label: '新規出展プロジェクト', href: href('new'), icon: PlusCircle, availableBeforeProject: true, hot: true },
  { section: 'overview', label: '概要ダッシュボード', href: href('overview'), icon: LayoutDashboard },
  { section: 'booth', label: 'ブース設計', href: href('booth'), icon: Box },
  { section: 'creatives', label: '制作物スタジオ', href: href('creatives'), icon: Palette },
  { section: 'novelty', label: 'ノベルティ', href: href('novelty'), icon: Gift },
  { section: 'budget', label: '予算シミュレーター', href: href('budget'), icon: Wallet },
  { section: 'vendors', label: '業者選定・発注', href: href('vendors'), icon: Truck },
  { section: 'docs', label: '資料庫・締切', href: href('docs'), icon: FolderOpen },
]
