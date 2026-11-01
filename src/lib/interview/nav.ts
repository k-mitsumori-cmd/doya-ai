// ============================================
// ドヤインタビューAI ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。InterviewSidebar（今のサイドバー）と InterviewShellFrame（共通の枠）が同じ配列を使う
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すとサーバーからクライアントへ渡せず 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export const INTERVIEW_NAV: ShellNavItem[] = [
  { label: '記事作成', href: '/interview', icon: 'Mic', exact: true },
  { label: '記事一覧', href: '/interview/projects', icon: 'FolderOpen' },
  { label: 'テンプレート', href: '/interview/templates', icon: 'LayoutTemplate' },
  { label: 'スキル', href: '/interview/skills', icon: 'BookOpen' },
  { label: '設定', href: '/interview/settings', icon: 'Settings' },
]
