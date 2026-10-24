'use client'

// ============================================
// ドヤポップアップ: 共通シェル（AppShell＋ToolFrame）に載せる枠
// ============================================
// フラグ ui.shell.popup が ON のときだけ layout.tsx から使う（OFF の間は PopupAppLayout）。
// ⚠️ ナビ（nav.ts）はサーバの layout.tsx から受け取る。アイコンは名前の文字列なので、そのまま渡せる。
// ⚠️ ページ本体と API は変えない。ページの見出しは ToolFrame が出すので、ページ側は小見出しにする（PopupShellContext）。
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import type { ShellNavItem } from '@/components/shell/nav'
import { PopupShellContext } from './shell-context'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function PopupShellFrame({ nav, children }: { nav: ShellNavItem[]; children: ReactNode }) {
  return (
    <ToolFrame serviceId="popup" nav={nav}>
      <PopupShellContext.Provider value={true}>{children}</PopupShellContext.Provider>
    </ToolFrame>
  )
}
