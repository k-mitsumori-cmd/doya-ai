'use client'
// ============================================
// ShellGate — 共通の枠を出すかどうかを、今のパスで決める
// ============================================
// src/app/(shell)/layout.tsx から1回だけ使う。この layout はツールを移っても作り直されないので、
// 枠（AppShell）も作り直されず、左のメニューや開いていた引き出しの状態が残る。
// ⚠️ 枠を出す・出さないが切り替わるとき（LP⇔アプリ、公開の画面）だけ、中身が作り直される。
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import AppShell from './AppShell'
import { shouldShowShell } from './registry'

export default function ShellGate({ signedIn, userName, enabledIds, children }: {
  signedIn: boolean
  userName?: string | null
  /** UI_SHELL_SERVICES に書かれた id（サーバーで読んで渡す） */
  enabledIds: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  if (!shouldShowShell(pathname, { signedIn, enabledIds })) return <>{children}</>
  return <AppShell userName={userName}>{children}</AppShell>
}
