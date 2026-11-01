import type { ShellNavItem } from '@/components/shell/nav'

// ドヤ見積もりAI のナビ。QuoteSidebar（今のレイアウト）と QuoteShellFrame（共通の枠）の両方がこの配列を描く。
// ⚠️ 見積書一覧はトップ画面内のセクション。/quote/documents というページは存在しないので、項目を作らないこと（404になる）。
export const QUOTE_BASE = '/quote'

export const QUOTE_NAV: ShellNavItem[] = [
  { label: '見積書をつくる', href: QUOTE_BASE, icon: 'Receipt', exact: true },
  { label: '設定', href: `${QUOTE_BASE}/settings`, icon: 'Settings' },
]
