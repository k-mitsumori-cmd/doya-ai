'use client'

// ============================================
// ドヤペルソナAI 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
import ToolFrame from '@/components/shell/ToolFrame'
import { PERSONA_NAV } from '@/lib/persona/nav'

export default function PersonaShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <ToolFrame
      serviceId="persona"
      title="ドヤペルソナAI"
      description="ターゲットの人物像を、AIが具体的なペルソナにまとめます。"
      nav={PERSONA_NAV}
    >
      {children}
    </ToolFrame>
  )
}
