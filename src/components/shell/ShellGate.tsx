'use client'
// ============================================
// ShellGate — 共通の枠を出すかどうかを、今のパスで決める
// ============================================
// src/app/(shell)/layout.tsx から1回だけ使う。この layout はツールを移っても作り直されないので、
// 枠（AppShell）も作り直されず、左のメニューや開いていた引き出しの状態が残る。
// ⚠️ 枠を出す・出さないが切り替わるとき（LP⇔アプリ、公開の画面）だけ、中身が作り直される。
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import type { AccountCompany } from '@/lib/shell/company'
import { AccountCompanyContext } from './company-context'
import AppShell from './AppShell'
import { shouldShowShell } from './registry'
import { ShellToolHrefsContext } from './ui-next-context'
import ShellVitals from './ShellVitals'
import { DoyaPowerContext } from '@/components/doya-power/doya-power-context'
import { ShellPowerProvider, type ShellPowerState } from './power'
import { DoyaPowerFetchWatcher, ShellLowPowerNotice } from './low-power'
import { DoyaPowerFxProvider } from '@/components/doya-power/fx-context'
import type { DoyaPowerFx } from '@/lib/doya-power/fx'
import NoticeProvider from '@/components/notice/NoticeProvider'
import ShellNotices from '@/components/notice/ShellNotices'
import SupportChat from '@/components/support-chat/SupportChat'

const EMPTY: Record<string, string> = {}

export default function ShellGate({ session, signedIn, userName, guide = false, supportChat = false, doyaPower = false, doyaPowerState = null, doyaPowerFx, company = undefined, always = false, toolHrefs, initialRecent, children }: {
  /** サーバーで読んだログイン情報。クライアントが /api/auth/session を取り直すまで「確認中」の文字を出さないための初期値。認可はサーバー側の判定のまま */
  session?: Session | null
  signedIn: boolean
  /** ドヤくんの知らせ（シート・カード・トースト・吹き出し）を出すか（サーバーの isGuidePopupsEnabled() で決めて渡す） */
  guide?: boolean
  /** 右下のサポートチャットを出すか（サーバーの isSupportChatEnabled() で決めて渡す。旗 SUPPORT_CHAT_ROLLOUT） */
  supportChat?: boolean
  /** ドヤパワーを出すか（サーバーの isDoyaPowerEnabled() で決めて渡す。ログインしている人のときだけ真になる） */
  doyaPower?: boolean
  /** ドヤパワーの残りと減る量の表（旗が出すと決めた人だけ。台帳の表が入るまでは null。src/components/shell/power.tsx） */
  doyaPowerState?: ShellPowerState | null
  /** ドヤくんの絵と演出の設定（会社・個人。旗が出すと決めた人だけ。src/lib/doya-power/fx.server.ts）。枠の中の部品が DoyaPowerFxProvider から読む */
  doyaPowerFx?: DoyaPowerFx
  /** 組織を選ぶツールのリンクの行き先（src/lib/shell/tool-hrefs.server.ts） */
  toolHrefs?: Record<string, string>
  /** 最近使ったツール（cookie から読んで渡す） */
  initialRecent?: string[]
  /** ツールの一覧に無いページ（/pricing など）でも、ログインしていれば枠を出す */
  always?: boolean
  /** アカウントの会社（null は見つからない。UI 品質 B-1） */
  company?: AccountCompany | null
  userName?: string | null
  children: ReactNode
}) {
  const pathname = usePathname()
  const shown = always ? signedIn : shouldShowShell(pathname, { signedIn })
  const framed = shown
    ? <AppShell userName={userName} initialRecent={initialRecent}>{children}</AppShell>
    : <>{children}</>
  // ドヤくんの知らせは、旗が出すと決めた人が、枠を開いているときだけ（見た記録はユーザーごと）
  const userKey = (session?.user as { id?: string } | undefined)?.id ?? session?.user?.email ?? ''
  const inner = guide && shown && userKey
    ? <NoticeProvider userKey={userKey}>{framed}<ShellNotices /></NoticeProvider>
    : framed
  const tree = (
      <AccountCompanyContext.Provider value={company}>
      <ShellToolHrefsContext.Provider value={toolHrefs ?? EMPTY}>
      <DoyaPowerContext.Provider value={doyaPower}>
      <ShellPowerProvider value={doyaPower ? doyaPowerState : null}>
      <DoyaPowerFxProvider fx={doyaPower ? doyaPowerFx : undefined}>
      {inner}
      {/* 「ドヤパワーが足りない」（402）の知らせ。旗が出すと決めた人だけ動く */}
      <DoyaPowerFetchWatcher />
      <ShellLowPowerNotice />
      {/* 右下のサポートチャット。旗が出すと決めた人が、枠を開いているときだけ */}
      {supportChat && shown ? <SupportChat /> : null}
      </DoyaPowerFxProvider>
      {/* 表示の速さを測る（外には送らない。UI 品質 S-45） */}
      {signedIn ? <ShellVitals /> : null}
      </ShellPowerProvider>
      </DoyaPowerContext.Provider>
      </ShellToolHrefsContext.Provider>
      </AccountCompanyContext.Provider>
  )
  // サーバーがログインを確認できているときだけ、初期値つきの SessionProvider で包む。
  // useSession() が最初から 'authenticated' を返すので、各ツールが「ログイン情報を確認しています」を出さない
  return session?.user ? <SessionProvider session={session}>{tree}</SessionProvider> : tree
}
