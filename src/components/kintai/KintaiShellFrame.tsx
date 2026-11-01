'use client'

import ToolFrame from '@/components/shell/ToolFrame'
import { buildKintaiNav } from '@/lib/kintai/nav'
import KintaiLayout from './KintaiLayout'
import nextStyles from './kintai-next.module.css'

/** 共通の枠の中で出す勤怠のナビ。枠そのもの（AppShell）は共通の layout が出す */
export default function KintaiShellFrame({ children }: { children: React.ReactNode }) {
  // 紫の主ボタン・強調をブランドの青にそろえる（S-48）
  return (
    <KintaiLayout
      renderFrame={({ role, employeeActive, children: body }) => (
        <ToolFrame serviceId="kintai" nav={buildKintaiNav(role, employeeActive)}>
          <div className={nextStyles.scope}>{body}</div>
        </ToolFrame>
      )}
    >
      {children}
    </KintaiLayout>
  )
}
