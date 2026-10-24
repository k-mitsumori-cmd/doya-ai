'use client'

// ドヤバナーAI 共通の枠の中身（ToolFrame だけ。AppShell では包まない）
// ⚠️ ナビを出すのは作業画面（/banner/dashboard/**）と、枠の中の料金・ギャラリー・ガイド・URL から作る画面。
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { BANNER_DASHBOARD_BASE, BANNER_NAV_NEXT } from '@/lib/banner/nav'
import styles from './banner-next.module.css'
import { useInShell } from '@/components/shell/in-shell'

/** 作業画面の外で、ログインした人が使う画面（料金・ギャラリー・ガイド・URL から作る） */
const BANNER_SUB_PAGE = /^\/banner\/(pricing|gallery|guide|url)(\/|$)/

export default function BannerShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const inShell = useInShell()
  // 料金・ギャラリー・ガイド・URL から作る画面も共通の枠の中に出す（registry.ts の shouldShowShell）。
  // 見出しの帯とタブもそろえる（2026-10-23 ユーザーの指摘。ツールの中を移ると上の帯が消えていた）
  if (inShell && BANNER_SUB_PAGE.test(pathname)) {
    return <ToolFrame serviceId="banner" nav={BANNER_NAV_NEXT}>{children}</ToolFrame>
  }
  if (pathname !== BANNER_DASHBOARD_BASE && !pathname.startsWith(BANNER_DASHBOARD_BASE + '/')) return <>{children}</>
  // 「見本から作る」をナビに足し、旧来の画面の左の空き（サイドバーのぶん）を消す
  return (
    <ToolFrame serviceId="banner" nav={BANNER_NAV_NEXT}>
      <div className={styles.next}>{children}</div>
    </ToolFrame>
  )
}
