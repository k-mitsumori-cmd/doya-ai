// ============================================
// ドヤAI質問リンク ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。共通の枠（ToolFrame）にも、今のサイドバー（AskLinkSidebar）にも、同じ配列を渡す。
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すと、サーバーの layout から渡したときに 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export interface AskLinkNavItem extends ShellNavItem {
  /** 今のサイドバーで目立たせる */
  hot?: boolean
}

export const ASKLINK_BASE = '/asklink'

export const ASKLINK_NAV: AskLinkNavItem[] = [
  { label: '作成', href: ASKLINK_BASE, icon: 'MessageCircleQuestion', exact: true, hot: true },
  { label: '履歴', href: ASKLINK_BASE + '/history', icon: 'History' },
  { label: '料金', href: ASKLINK_BASE + '/pricing', icon: 'CreditCard' },
]
