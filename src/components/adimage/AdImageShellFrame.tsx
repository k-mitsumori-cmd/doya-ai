'use client'

// ドヤ広告画像AIの共通の枠用の外枠。枠（AppShell）は src/app/(shell)/layout.tsx が出すので、ここでは ToolFrame だけ返す
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { ADIMAGE_NAV } from '@/lib/adimage/nav'

export default function AdImageShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // 第三者が開く画面にはナビも出さない（旧レイアウトと同じ判定）
  if (isGuestPath(pathname)) return <>{children}</>
  return <ToolFrame serviceId="adimage" nav={ADIMAGE_NAV}>{children}</ToolFrame>
}
