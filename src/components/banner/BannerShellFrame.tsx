'use client'

// ドヤバナーAI 共通の枠の中身（ToolFrame だけ。AppShell では包まない）
// ⚠️ バナーには今までの外枠が無い。ナビを出すのは作業画面（/banner/dashboard/**）だけ。
//    LP・ガイド・料金は、今までどおりナビ無しで出す（registry.ts の inShell と同じ条件）
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { useUiNext } from '@/components/shell/ui-next-context'
import { BANNER_DASHBOARD_BASE, BANNER_NAV, BANNER_NAV_NEXT } from '@/lib/banner/nav'
import styles from './banner-next.module.css'

export default function BannerShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const uiNext = useUiNext()
  if (pathname !== BANNER_DASHBOARD_BASE && !pathname.startsWith(BANNER_DASHBOARD_BASE + '/')) return <>{children}</>
  // 新しい見た目のときだけ、「見本から作る」をナビに足し、旧来の画面の左の空き（サイドバーのぶん）を消す
  if (uiNext) {
    return (
      <ToolFrame serviceId="banner" nav={BANNER_NAV_NEXT}>
        <div className={styles.next}>{children}</div>
      </ToolFrame>
    )
  }
  return (
    <ToolFrame serviceId="banner" nav={BANNER_NAV}>
      {children}
    </ToolFrame>
  )
}
