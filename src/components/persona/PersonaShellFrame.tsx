'use client'

// ============================================
// ドヤペルソナAI 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
import ToolFrame from '@/components/shell/ToolFrame'
import { PERSONA_NAV } from '@/lib/persona/nav'
import brand from './brand-next.module.css'

export default function PersonaShellFrame({ children }: { children: React.ReactNode }) {
  // 紫と桃色をブランドの青にそろえる（brand-next.module.css）
  return (
    <ToolFrame
      serviceId="persona"
      nav={PERSONA_NAV}
    >
      <div className={brand.brand}>{children}</div>
    </ToolFrame>
  )
}
