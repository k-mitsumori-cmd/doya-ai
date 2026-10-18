import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import HrLayoutShell from '@/components/hr/HrLayout'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('hr', {
  keywords: ['タレントマネジメント', '人事評価', '従業員データベース', 'MBO', '組織図', 'HR', '人材管理', '中小企業 人事'],
})

const SVC = getServiceById('hr')!

export default function Layout({ children }: { children: React.ReactNode }) {
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
      <HrLayoutShell>{children}</HrLayoutShell>
    </>
  )
}
