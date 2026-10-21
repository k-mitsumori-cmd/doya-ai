'use client'
// ============================================
// ShellGate — 共通の枠を出すかどうかを、今のパスで決める
// ============================================
// src/app/(shell)/layout.tsx から1回だけ使う。この layout はツールを移っても作り直されないので、
// 枠（AppShell）も作り直されず、左のメニューや開いていた引き出しの状態が残る。
// ⚠️ 枠を出す・出さないが切り替わるとき（LP⇔アプリ、公開の画面）だけ、中身が作り直される。
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { UiNextMode } from '@/lib/ui-next'
import type { AccountCompany } from '@/lib/shell/company'
import { AccountCompanyContext } from './company-context'
import AppShell from './AppShell'
import { shouldShowShell } from './registry'
import { ShellToolHrefsContext, UiNextContext } from './ui-next-context'
import UiNextBadge from './UiNextBadge'
import ShellVitals from './ShellVitals'

const EMPTY: Record<string, string> = {}

export default function ShellGate({ signedIn, serverActorId, userName, enabledIds, uiNext = null, company = undefined, always = false, toolHrefs, initialRecent, children }: {
  signedIn: boolean
  /** Principal of the server snapshot; never infer it from a name or email. */
  serverActorId: string | null
  /** 組織を選ぶツールのリンクの行き先（新しい見た目のときだけ。src/lib/shell/tool-hrefs.server.ts） */
  toolHrefs?: Record<string, string>
  /** 最近使ったツール（新しい見た目のとき、cookie から読んで渡す） */
  initialRecent?: string[]
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
  const { data: session, status } = useSession()
  const privateContainer = useRef<HTMLDivElement | null>(null)
  const retired = useRef(false)
  const [, updateLifecycle] = useState(0)
  const serverActor = typeof serverActorId === 'string' && serverActorId.trim() ? serverActorId : null
  const sdkActor = status === 'authenticated' && typeof session?.user?.id === 'string' && session.user.id.trim() ? session.user.id : null
  const invalidSnapshot = signedIn !== Boolean(serverActor)
  const confirmed = status === 'unauthenticated' || (status === 'authenticated' && sdkActor !== null)
  // A late RSC payload or A→B→A must not restore a snapshot retired in this document.
  if (invalidSnapshot || (confirmed && sdkActor !== serverActor)) retired.current = true
  const blocked = retired.current
  const waiting = signedIn && (status === 'loading' || (status === 'authenticated' && sdkActor === null))
  const privateReady = signedIn && !blocked && !waiting && sdkActor === serverActor

  useEffect(() => {
    const retire = () => {
      if (!signedIn) return
      retired.current = true
      // Hide before a possible BFCache freeze, without waiting for React to commit.
      if (privateContainer.current) {
        privateContainer.current.hidden = true
        privateContainer.current.setAttribute('inert', '')
      }
      updateLifecycle(value => value + 1)
    }
    const restore = (event: PageTransitionEvent) => { if (event.persisted) retire() }
    window.addEventListener('pagehide', retire)
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pagehide', retire)
      window.removeEventListener('pageshow', restore)
    }
  }, [signedIn])

  if (blocked) return (
    <section role="alert" className="mx-auto max-w-lg p-6 text-sm text-slate-700">
      <h1 className="font-bold text-slate-900">ログイン状態を確認し直してください</h1>
      <p className="mt-2">アカウントが変わったか、以前の画面に戻りました。最新の画面を読み込んでください。</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">最新の画面を読み込む</button>
    </section>
  )

  const inner = (always ? signedIn : shouldShowShell(pathname, { signedIn, enabledIds }))
    ? <AppShell userName={privateReady ? userName : null} initialRecent={uiNext ? initialRecent : undefined}>{children}</AppShell>
    : <>{children}</>
  return (
    <>
    {waiting && <div className="p-6 text-center text-sm">
      <p role="status">ログイン状態を確認しています…</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-2 font-bold text-blue-700 underline">ログイン状態を読み込み直す</button>
    </div>}
    <div ref={node => {
      privateContainer.current = node
      if (node) {
        // React 18 does not serialize an unknown boolean inert prop consistently.
        if (waiting) node.setAttribute('inert', '')
        else node.removeAttribute('inert')
      }
    }} hidden={waiting}>
    <UiNextContext.Provider value={signedIn ? uiNext : null}>
      <AccountCompanyContext.Provider value={privateReady && uiNext ? company : undefined}>
      <ShellToolHrefsContext.Provider value={privateReady && uiNext && toolHrefs ? toolHrefs : EMPTY}>
      {inner}
      {/* useSearchParams を使うので Suspense で包む（静的な画面の書き出しを止めない） */}
      <Suspense fallback={null}>{privateReady ? <UiNextBadge /> : null}</Suspense>
      {/* 表示の速さを測る（新しい見た目のときだけ。外には送らない。UI 品質 S-45） */}
      {privateReady && uiNext ? <ShellVitals /> : null}
      </ShellToolHrefsContext.Provider>
      </AccountCompanyContext.Provider>
    </UiNextContext.Provider>
    </div>
    </>
  )
}
