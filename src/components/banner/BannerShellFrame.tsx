'use client'

// ドヤバナーAI 共通の枠の中身（ToolFrame だけ。AppShell では包まない）
// ⚠️ バナーには今までの外枠が無い。ナビを出すのは作業画面（/banner/dashboard/**）だけ。
//    LP・ガイド・料金は、今までどおりナビ無しで出す（registry.ts の inShell と同じ条件）
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { BANNER_DASHBOARD_BASE, BANNER_NAV } from '@/lib/banner/nav'

export default function BannerShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  if (pathname !== BANNER_DASHBOARD_BASE && !pathname.startsWith(BANNER_DASHBOARD_BASE + '/')) return <>{children}</>
  return (
    <ToolFrame serviceId="banner" nav={BANNER_NAV}>
      {children}
    </ToolFrame>
  )
}
