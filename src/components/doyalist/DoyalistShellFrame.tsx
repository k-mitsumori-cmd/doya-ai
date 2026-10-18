'use client'

// ドヤリストの共通の枠用の外枠。枠（AppShell）は src/app/(shell)/layout.tsx が出すので、ここでは ToolFrame だけ返す
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { DOYALIST_NAV } from '@/lib/doyalist/nav'

export default function DoyalistShellFrame({ children }: { children: ReactNode }) {
  return <ToolFrame serviceId="doyalist" nav={DOYALIST_NAV}>{children}</ToolFrame>
}
