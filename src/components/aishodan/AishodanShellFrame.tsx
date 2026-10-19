'use client'

// ドヤAI商談 共通の枠の中身（ToolFrame だけ）
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここで AppShell を使わない（二重になる）
// ⚠️ 組織の切り替えは ToolFrame の switcher に出す。ページの中の OrgSwitcher は CSS で隠す（AishodanShellFrame.module.css）
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { AISHODAN_NAV } from '@/lib/aishodan/nav'
import AishodanShellSwitcher from './AishodanShellSwitcher'
import styles from './AishodanShellFrame.module.css'

export default function AishodanShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (isGuestPath(pathname)) return <>{children}</>
  return (
    <ToolFrame serviceId="aishodan" nav={AISHODAN_NAV} switcher={<AishodanShellSwitcher />}>
      <div className={styles.content}>{children}</div>
    </ToolFrame>
  )
}
