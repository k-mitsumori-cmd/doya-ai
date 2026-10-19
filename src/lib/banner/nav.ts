// ============================================
// ドヤバナーAI ツール内ナビ（データ）
// ============================================
// ⚠️ 共通の枠（ToolFrame）専用。バナーには今までサイドバーが無い。枠は /banner/dashboard/** だけに出る（registry.ts）。
//    gallery-test と stats は、今までどおりナビに出さない。
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すと、サーバーの layout から渡したときに 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export const BANNER_DASHBOARD_BASE = '/banner/dashboard'

export const BANNER_NAV: ShellNavItem[] = [
  { label: 'つくる', href: BANNER_DASHBOARD_BASE + '/create', icon: 'PlusCircle' },
  { label: '履歴', href: BANNER_DASHBOARD_BASE + '/history', icon: 'History' },
  { label: 'ブランド', href: BANNER_DASHBOARD_BASE + '/brand', icon: 'Palette' },
  { label: 'プラン', href: BANNER_DASHBOARD_BASE + '/plan', icon: 'CreditCard' },
  { label: '設定', href: BANNER_DASHBOARD_BASE + '/settings', icon: 'Settings' },
]
