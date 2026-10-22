'use client'

import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import { buildKintaiNav } from '@/lib/kintai/nav'
import KintaiLayout from './KintaiLayout'
import { useToolUiNext } from './ui-next'
import nextStyles from './kintai-next.module.css'

/** 共通の枠の中で出す勤怠のナビ。枠そのもの（AppShell）は共通の layout が出す */
export default function KintaiShellFrame({ children }: { children: React.ReactNode }) {
  // 新しい見た目のときだけ、紫の主ボタン・強調をブランドの青にそろえる（S-48）
  const uiNext = useToolUiNext()
  const pathname = usePathname()
  // 料金のページは KintaiLayout では「公開の画面」として枠（ToolFrame）を付けない。新しい見た目のときだけ、ここで見出しの帯を付ける
  // （役割が分からないのでタブは出さない。2026-10-23 ユーザーの指摘。料金を押すと上の帯が消えていた）
  if (uiNext && pathname === '/kintai/pricing') {
    return (
      <ToolFrame serviceId="kintai">
        <div className={nextStyles.scope}><KintaiLayout>{children}</KintaiLayout></div>
      </ToolFrame>
    )
  }
  return (
    <KintaiLayout
      renderFrame={({ role, employeeActive, children: body }) => (
        <ToolFrame serviceId="kintai" nav={buildKintaiNav(role, employeeActive)}>
          {uiNext ? <div className={nextStyles.scope}>{body}</div> : body}
        </ToolFrame>
      )}
    >
      {children}
    </KintaiLayout>
  )
}
