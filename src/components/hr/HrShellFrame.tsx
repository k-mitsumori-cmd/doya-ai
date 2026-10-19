'use client'

// ============================================
// ドヤHR 共通の枠に載せたときの外側（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは包まない（二重になるため）
// ⚠️ 組織の読み込み・選択・HrOrganizationScope・HrOnboarding は HrLayout がそのまま持つ。
//    HrLayout が組織の切り替え（<select>）を switcher として渡し、ここで ToolFrame に入れる
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { hrShellNav } from '@/lib/hr/nav'
import HrLayout from './HrLayout'

export default function HrShellFrame({ children }: { children: ReactNode }) {
  return (
    <HrLayout
      renderFrame={({ switcher, canManageEmployees, children: content }) => (
        <ToolFrame serviceId="hr" title="ドヤHR" nav={hrShellNav(canManageEmployees)} switcher={switcher}>
          {content}
        </ToolFrame>
      )}
    >
      {children}
    </HrLayout>
  )
}
