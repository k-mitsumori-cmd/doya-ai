'use client'

// ドヤAI質問リンク 共通の枠の中身（ToolFrame だけ。AppShell では包まない）
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。第三者向けの画面（guest-path.ts）には出さない
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { ASKLINK_NAV } from '@/lib/asklink/nav'

export default function AskLinkShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (isGuestPath(pathname)) return <>{children}</>
  return (
    <ToolFrame serviceId="asklink" nav={ASKLINK_NAV}>
      {children}
    </ToolFrame>
  )
}
