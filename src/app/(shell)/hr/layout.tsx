import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import HrLayoutShell from '@/components/hr/HrLayout'
import HrShellFrame from '@/components/hr/HrShellFrame'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('hr', {
  keywords: ['タレントマネジメント', '人事評価', '従業員データベース', 'MBO', '組織図', 'HR', '人材管理', '中小企業 人事'],
})

const SVC = getServiceById('hr')!

export default async function Layout({ children }: { children: React.ReactNode }) {
  // ⚠️ ログインしていれば共通の枠（registry.ts と同じ条件）。
  //    未ログインは HrLayoutShell（LP・料金・招待・ログイン案内の判定は HrLayout が行う）
  const session = await getServerSession(authOptions).catch(() => null)
  const shell = Boolean(session?.user)
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {shell ? <HrShellFrame>{children}</HrShellFrame> : <HrLayoutShell>{children}</HrLayoutShell>}
    </>
  )
}
