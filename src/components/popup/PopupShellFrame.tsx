'use client'

// ============================================
// ドヤポップアップ: 共通シェル（AppShell＋ToolFrame）に載せる枠
// ============================================
// フラグ ui.shell.popup が ON のときだけ layout.tsx から使う（OFF の間は PopupAppLayout）。
// ⚠️ ナビはここで nav.ts を読む（lucide のアイコンは関数なので、サーバの layout からは渡せない）。
// ⚠️ ページ本体と API は変えない。ページの見出しは ToolFrame が出すので、ページ側は小見出しにする（PopupShellContext）。
import type { ReactNode } from 'react'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import { POPUP_NAV } from '@/lib/popup/nav'
import { PopupShellContext } from './shell-context'

export default function PopupShellFrame({ userName, children }: { userName?: string | null; children: ReactNode }) {
  return (
    <AppShell userName={userName}>
      <ToolFrame serviceId="popup" title="ドヤポップアップ" description="URLを入れると、AIがサイトに合ったポップアップを提案します。" nav={POPUP_NAV}>
        <PopupShellContext.Provider value={true}>{children}</PopupShellContext.Provider>
      </ToolFrame>
    </AppShell>
  )
}
