'use client'
// ============================================
// ドヤHR 画面の見本（クライアント側）: 新しい見た目＋共通の枠＋HrShellFrame に、本物のページを載せる
// ============================================
// ⚠️ ログイン・組織は見本で用意する（next-auth の SessionProvider に見本のセッションを渡し、/api/hr/* は ./mock-fetch.ts が返す）。
//    本番の振る舞いは変えない（HrLayout は /hr/dev/ のときだけ外側の旧来の枠を素通しする。開発時のみ）。
import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import AppShell from '@/components/shell/AppShell'
import HrShellFrame from '@/components/hr/HrShellFrame'
import HrDashboardPage from '../../dashboard/page'
import EmployeesPage from '../../employees/page'
import NewEmployeePage from '../../employees/new/page'
import EvaluationsPage from '../../evaluations/page'
import OneOnOnePage from '../../one-on-one/page'
import OrgChartPage from '../../org-chart/page'
import { DEV_SESSION, installHrDevFetch, type HrDevState } from './mock-fetch'

export type HrDevPage = 'dashboard' | 'employees' | 'new' | 'evaluations' | 'one-on-one' | 'org-chart'

const PAGES: Record<HrDevPage, () => ReactNode> = {
  dashboard: () => <HrDashboardPage />,
  employees: () => <EmployeesPage />,
  new: () => <NewEmployeePage />,
  evaluations: () => <EvaluationsPage />,
  'one-on-one': () => <OneOnOnePage />,
  'org-chart': () => <OrgChartPage />,
}

export default function HrDevStates({ state, page }: { state: HrDevState; page: HrDevPage }) {
  // 子の読み込み（effect）より先に、fetch の差し替えと状態を決める
  installHrDevFetch(state)
  return (
    <>
      <SessionProvider session={DEV_SESSION as unknown as Session} refetchOnWindowFocus={false} refetchInterval={0}>
        <AppShell userName="見本 太郎">
          {/* 状態・ページを変えたら作り直して、読み込みからやり直す */}
          <HrShellFrame key={`${state}:${page}`}>{PAGES[page]()}</HrShellFrame>
        </AppShell>
      </SessionProvider>
    </>
  )
}
