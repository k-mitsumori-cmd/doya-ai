'use client'

// ============================================
// ドヤペルソナAI 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
import ToolFrame from '@/components/shell/ToolFrame'
import { useUiNext } from '@/components/shell/ui-next-context'
import { PERSONA_NAV } from '@/lib/persona/nav'
import brand from './brand-next.module.css'

export default function PersonaShellFrame({ children }: { children: React.ReactNode }) {
  // 新しい見た目のときだけ、紫と桃色をブランドの青にそろえる（brand-next.module.css）
  const uiNext = useUiNext()
  return (
    <ToolFrame
      serviceId="persona"
      nav={PERSONA_NAV}
    >
      {uiNext ? <div className={brand.brand}>{children}</div> : children}
    </ToolFrame>
  )
}
