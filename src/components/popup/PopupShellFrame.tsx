'use client'

// ============================================
// ドヤポップアップ: 共通シェル（AppShell＋ToolFrame）に載せる枠
// ============================================
// フラグ ui.shell.popup が ON のときだけ layout.tsx から使う（OFF の間は PopupAppLayout）。
// ⚠️ ナビ（nav.ts）はサーバの layout.tsx から受け取る。アイコンは名前の文字列なので、そのまま渡せる。
// ⚠️ ページ本体と API は変えない。ページの見出しは ToolFrame が出すので、ページ側は小見出しにする（PopupShellContext）。
import type { ReactNode } from 'react'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import type { ShellNavItem } from '@/components/shell/nav'
import { PopupShellContext } from './shell-context'

export default function PopupShellFrame({ userName, nav, children }: { userName?: string | null; nav: ShellNavItem[]; children: ReactNode }) {
  return (
    <AppShell userName={userName}>
      <ToolFrame serviceId="popup" title="ドヤポップアップ" description="URLを入れると、AIがサイトに合ったポップアップを提案します。" nav={nav}>
        <PopupShellContext.Provider value={true}>{children}</PopupShellContext.Provider>
      </ToolFrame>
    </AppShell>
  )
}
