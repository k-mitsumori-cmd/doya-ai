'use client'
// ============================================
// ShellGate — 共通の枠を出すかどうかを、今のパスで決める
// ============================================
// src/app/(shell)/layout.tsx から1回だけ使う。この layout はツールを移っても作り直されないので、
// 枠（AppShell）も作り直されず、左のメニューや開いていた引き出しの状態が残る。
// ⚠️ 枠を出す・出さないが切り替わるとき（LP⇔アプリ、公開の画面）だけ、中身が作り直される。
import { usePathname } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import type { UiNextMode } from '@/lib/ui-next'
import type { AccountCompany } from '@/lib/shell/company'
import { AccountCompanyContext } from './company-context'
import AppShell from './AppShell'
import { shouldShowShell } from './registry'
import { ShellToolHrefsContext, UiNextContext } from './ui-next-context'
import UiNextBadge from './UiNextBadge'
import ShellVitals from './ShellVitals'

const EMPTY: Record<string, string> = {}

export default function ShellGate({ signedIn, userName, enabledIds, uiNext = null, company = undefined, always = false, toolHrefs, children }: {
  signedIn: boolean
  /** 組織を選ぶツールのリンクの行き先（新しい見た目のときだけ。src/lib/shell/tool-hrefs.server.ts） */
  toolHrefs?: Record<string, string>
  /** ツールの一覧に無いページ（/pricing など）でも、ログインしていれば枠を出す */
  always?: boolean
  /** 新しい見た目を出すか（サーバーの uiNextMode() で決めて渡す。チェックリスト §5.1） */
  uiNext?: UiNextMode
  /** アカウントの会社（新しい見た目のときだけ。null は見つからない。UI 品質 B-1） */
  company?: AccountCompany | null
  userName?: string | null
  /** UI_SHELL_SERVICES に書かれた id（サーバーで読んで渡す） */
  enabledIds: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const inner = (always ? signedIn : shouldShowShell(pathname, { signedIn, enabledIds }))
    ? <AppShell userName={userName}>{children}</AppShell>
    : <>{children}</>
  return (
    <UiNextContext.Provider value={uiNext}>
      <AccountCompanyContext.Provider value={uiNext ? company : undefined}>
      <ShellToolHrefsContext.Provider value={uiNext && toolHrefs ? toolHrefs : EMPTY}>
      {inner}
      {/* useSearchParams を使うので Suspense で包む（静的な画面の書き出しを止めない） */}
      <Suspense fallback={null}><UiNextBadge /></Suspense>
      {/* 表示の速さを測る（新しい見た目のときだけ。外には送らない。UI 品質 S-45） */}
      {uiNext ? <ShellVitals /> : null}
      </ShellToolHrefsContext.Provider>
      </AccountCompanyContext.Provider>
    </UiNextContext.Provider>
  )
}
