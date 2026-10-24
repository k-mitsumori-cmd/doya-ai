// ============================================
// ドヤリスト ツール内ナビ（データ）
// ============================================
// ⚠️ 共通の枠（ToolFrame）の nav にそのまま渡す。アイコンは名前の文字列で書く（部品を渡すと 500 になる）。
// ⚠️ 旧レイアウト（DoyalistLayout）は、検証スクリプトが読み込みを固定しているため、同じ項目を中に持っている。
//    項目を変えるときは両方を直す。ただし料金のタブは、新しい見た目のナビ（ここ）からだけ外している（FRM-04）。
//    旧レイアウトの「料金」は、旧レイアウトを終えるとき（FRM-07）に一緒に消える。
import type { ShellNavItem } from '@/components/shell/nav'

export const DOYALIST_NAV: ShellNavItem[] = [
  { label: 'リスト作成', href: '/doyalist', icon: 'ListChecks', exact: true },
  { label: 'フォーム営業文', href: '/doyalist/tools/form', icon: 'FileSignature' },
  { label: 'メール文面', href: '/doyalist/tools/email', icon: 'Mail' },
  { label: '荷電スクリプト', href: '/doyalist/tools/phone', icon: 'PhoneCall' },
  { label: '履歴', href: '/doyalist/history', icon: 'History' },
  { label: '設定', href: '/doyalist/settings', icon: 'Settings' },
]
