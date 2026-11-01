'use client'

// ============================================
// ドヤ営業管理: 画面の状態の見本（クライアント側）
// ============================================
// 本物のページ部品（[orgSlug]/page.tsx など）を、見本のログイン・見本の組織・偽の API で動かす。
// ⚠️ 組織の layout（[orgSlug]/layout.tsx）は通さない。ログインの確認と所属組織の取得は、ここで見本を渡して代わりにする。
// ⚠️ useParams() の組織（orgSlug）は、Next の PathParamsContext を見本の値で上書きして渡す。
//    サーバーの描画では上書きが効かないので、画面に出すのはマウントのあと（クライアントだけ）にする。
import { useEffect, useState, type ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { Toaster } from 'react-hot-toast'
import { PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import AppShell from '@/components/shell/AppShell'
import SfaShellFrame from '@/components/sfa/SfaShellFrame'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import CrmRecordsPage from '@/components/sfa/CrmRecordsPage'
import { useSfaShell } from '@/lib/sfa/shell-context'
import SfaDashboard from '../../[orgSlug]/page'
import SfaDealsPage from '../../[orgSlug]/deals/page'
import SfaLeadsPage from '../../[orgSlug]/leads/page'
import SfaTasksPage from '../../[orgSlug]/tasks/page'
import SfaActivitiesPage from '../../[orgSlug]/activities/page'
import SfaMembersPage from '../../[orgSlug]/members/page'
import { installSfaMockFetch, SAMPLE_ORG, SAMPLE_SESSION } from './MockFetch'

// 最初の描画（子の useEffect の fetch）より前に、偽の API を入れておく
installSfaMockFetch()

const PAGES: Record<string, () => ReactNode> = {
  home: () => <SfaDashboard />,
  deals: () => <SfaDealsPage />,
  leads: () => <SfaLeadsPage />,
  tasks: () => <SfaTasksPage />,
  activities: () => <SfaActivitiesPage />,
  members: () => <SfaMembersPage />,
  accounts: () => <CrmRecordsPage kind="account" />,
  contacts: () => <CrmRecordsPage kind="contact" />,
}

/** 枠の組織の切り替えに、見本の所属組織を渡す（本物は [orgSlug]/layout.tsx が渡す） */
function PublishMemberships() {
  const shell = useSfaShell()
  useEffect(() => {
    shell?.publishMemberships([{ slug: SAMPLE_ORG, name: '見本 株式会社', role: 'owner' }])
  }, [shell])
  return null
}

/** 上限に達して保存できなかったときの表示（作る操作のあとに出るものを、最初から見せる） */
function LimitNotice() {
  const mutations = {
    requiresLogin: false, upgradeHref: '/sfa/pricing?org=' + SAMPLE_ORG, pending: [], busy: [],
    message: '商談の上限（50件）に達しました。プロプランで枠を広げられます。',
    recover: async () => {},
  } as unknown as Parameters<typeof MutationRecovery>[0]['mutations']
  return <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6"><MutationRecovery mutations={mutations} /></div>
}

export default function SfaStatesPreview({ page, state }: { page: string; state: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const render = PAGES[page] ?? PAGES.home
  return (
    <>
      <AppShell userName="見本 太郎">
        {mounted ? (
          <SessionProvider session={SAMPLE_SESSION as unknown as Session} refetchOnWindowFocus={false}>
            <PathParamsContext.Provider value={{ orgSlug: SAMPLE_ORG }}>
              <Toaster position="top-center" />
              <SfaShellFrame>
                <PublishMemberships />
                {state === 'limit' && <LimitNotice />}
                {render()}
              </SfaShellFrame>
            </PathParamsContext.Provider>
          </SessionProvider>
        ) : (
          <p role="status" className="p-6 text-sm text-slate-500">見本を準備しています…</p>
        )}
      </AppShell>
    </>
  )
}
