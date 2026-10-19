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
import type { ShellCompany } from '@/lib/shell/company'
import { ShellCompaniesContext } from './company-context'
import AppShell from './AppShell'
import { shouldShowShell } from './registry'
import { UiNextContext } from './ui-next-context'
import UiNextBadge from './UiNextBadge'

export default function ShellGate({ signedIn, userName, enabledIds, uiNext = null, companies = null, children }: {
  signedIn: boolean
  /** 新しい見た目を出すか（サーバーの uiNextMode() で決めて渡す。チェックリスト §5.1） */
  uiNext?: UiNextMode
  /** 入っている組織（新しい見た目のときだけ。サーバーで集めて渡す。UI 品質 B-1） */
  companies?: ShellCompany[] | null
  userName?: string | null
  /** UI_SHELL_SERVICES に書かれた id（サーバーで読んで渡す） */
  enabledIds: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const inner = shouldShowShell(pathname, { signedIn, enabledIds })
    ? <AppShell userName={userName}>{children}</AppShell>
    : <>{children}</>
  return (
    <UiNextContext.Provider value={uiNext}>
      <ShellCompaniesContext.Provider value={uiNext ? companies : null}>
      {inner}
      {/* useSearchParams を使うので Suspense で包む（静的な画面の書き出しを止めない） */}
      <Suspense fallback={null}><UiNextBadge /></Suspense>
      </ShellCompaniesContext.Provider>
    </UiNextContext.Provider>
  )
}
