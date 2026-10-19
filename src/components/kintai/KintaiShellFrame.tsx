'use client'

import ToolFrame from '@/components/shell/ToolFrame'
import { buildKintaiNav } from '@/lib/kintai/nav'
import KintaiLayout from './KintaiLayout'

/** 共通の枠の中で出す勤怠のナビ。枠そのもの（AppShell）は共通の layout が出す */
export default function KintaiShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <KintaiLayout
      renderFrame={({ role, employeeActive, children: body }) => (
        <ToolFrame serviceId="kintai" nav={buildKintaiNav(role, employeeActive)}>
          {body}
        </ToolFrame>
      )}
    >
      {children}
    </KintaiLayout>
  )
}
