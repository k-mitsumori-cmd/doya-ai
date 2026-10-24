'use client'
// ============================================
// 組織を選ぶ前の画面を、ツールの見出しの帯（ToolFrame）で包む
// ============================================
// 組織（ワークスペース）を選ぶツール（営業管理・AIO・商談準備・プロマネ・支出管理）の
// 入口（組織を作る「はじめに」）と料金のページは、組織の layout の外にあるので、ToolFrame が付かなかった。
// 新しい見た目で共通の枠の中にいるときだけ、ここで ToolFrame を付ける（今の見た目・未ログインでは何もしない）。
// - 組織の下（/<ツール>/<組織>/...）は、組織の layout が ToolFrame を出すので、ここでは包まない
// - 料金のページに ?org= があれば、その組織のタブの並びを出す（組織の画面の「料金プラン」のタブから来たとき）
// ⚠️ 2026-10-23 ユーザーの指摘（ツールを押すと上のヘッダーが消えて画面が変わる）への直し。registry.ts の shouldShowShell と組で使う
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ToolFrame from './ToolFrame'
import { useInShell } from './in-shell'
import type { ShellNavItem } from './nav'
import { sfaNav } from '@/lib/sfa/nav'
import { buildAioNav } from '@/lib/aio/nav'
import { shodanNav } from '@/lib/shodan/nav'
import { isEntryPath } from './entry-path'

export type EntryServiceId = 'sfa' | 'aio' | 'shodan' | 'promane' | 'expense'

/** 料金のページで、?org= の組織のタブの並び */
const ORG_NAV: Partial<Record<EntryServiceId, (org: string) => ShellNavItem[]>> = {
  sfa: sfaNav,
  aio: (org) => buildAioNav(org) as ShellNavItem[],
  shodan: (org) => shodanNav(org) as ShellNavItem[],
}

export default function ShellEntryFrame({ serviceId, children }: { serviceId: EntryServiceId; children: ReactNode }) {
  const inShell = useInShell()
  const pathname = usePathname() || ''
  // ?org= は描いたあとに読む。⚠️ useSearchParams() を使うと、静的に書き出す画面（/expense など）で
  //    Suspense が無いためにビルドが止まる（2026-10-23 の Vercel のプレビューで発生）
  const [org, setOrg] = useState<string | null>(null)
  useEffect(() => {
    setOrg(pathname.endsWith('/pricing') ? new URLSearchParams(window.location.search).get('org') : null)
  }, [pathname])
  if (!inShell || !isEntryPath(serviceId, pathname)) return <>{children}</>
  const nav = org ? ORG_NAV[serviceId]?.(org) : undefined
  return <ToolFrame serviceId={serviceId} nav={nav}>{children}</ToolFrame>
}
