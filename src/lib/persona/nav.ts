// ============================================
// ドヤペルソナAI ツール内ナビ（データ）
// ============================================
// ⚠️ 項目はここにだけ書く。PersonaSidebar（今のサイドバー）と PersonaShellFrame（共通の枠）が同じ配列を使う
// ⚠️ アイコンは名前の文字列で書く（lucide の部品を渡すとサーバーからクライアントへ渡せず 500 になる）
import type { ShellNavItem } from '@/components/shell/nav'

export interface PersonaNavItem extends ShellNavItem {
  /** 今のサイドバーで目立たせる */
  hot?: boolean
}

export const PERSONA_NAV: PersonaNavItem[] = [
  { label: 'ペルソナ生成', href: '/persona', icon: 'Target', exact: true, hot: true },
  { label: '生成履歴', href: '/persona/history', icon: 'Clock' },
]
