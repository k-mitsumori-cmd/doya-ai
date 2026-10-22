'use client'
// 見本の画面を、新しい見た目（共通シェル＋見積の ToolFrame）とログイン済みの見本セッションで包む（開発時だけ）。
// ⚠️ 本番の挙動は変えない。セッション・API はここ（dev フォルダ）の中だけで差し替える。
import type { ReactNode } from 'react'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { UiNextContext } from '@/components/shell/ui-next-context'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import QuoteOrgSwitcher from '@/components/quote/QuoteOrgSwitcher'
import { QUOTE_NAV } from '@/lib/quote/nav'
import MockFetch, { PREVIEW_SESSION } from './MockFetch'

export default function QuotePreview({ state, children }: { state: string; children: ReactNode }) {
  return (
    <MockFetch state={state}>
      <SessionProvider session={PREVIEW_SESSION as unknown as Session} refetchOnWindowFocus={false}>
        <UiNextContext.Provider value="all">
          <AppShell userName="見本 太郎">
            {/* ⚠️ QuoteShellFrame は /quote/dev では枠を描かない（ログイン中の二重枠を防ぐため）。中身は同じ ToolFrame をここで描く */}
            <ToolFrame serviceId="quote" nav={QUOTE_NAV} switcher={<QuoteOrgSwitcher />}>{children}</ToolFrame>
          </AppShell>
        </UiNextContext.Provider>
      </SessionProvider>
    </MockFetch>
  )
}
