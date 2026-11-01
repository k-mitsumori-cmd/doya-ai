'use client'

// ドヤスライドの共通の枠用の外枠。枠（AppShell）は src/app/(shell)/layout.tsx が出すので、ここでは ToolFrame だけ返す
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import ToolFrame from '@/components/shell/ToolFrame'
import { DOYASLIDE_NAV } from '@/lib/doyaslide/nav'

export default function DoyaSlideShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // 公開の紹介ページは、今までどおりナビの外で表示する（旧レイアウトと同じ判定。registry.ts の inShell も同じ）
  if (pathname === '/doyaslide') return <>{children}</>
  return (
    <ToolFrame serviceId="doyaslide" nav={DOYASLIDE_NAV}>
      <Toaster position="top-center" />
      {children}
    </ToolFrame>
  )
}
