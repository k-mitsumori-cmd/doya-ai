import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import AdSimAppLayout from '@/components/AdSimAppLayout'

export const metadata: Metadata = buildServiceMetadata('adsim', {
  keywords: ['広告シミュレーション', '広告提案資料', '媒体配分', '広告代理店', '運用型広告', 'PPTX自動生成', '広告予算', 'KPIシミュレーション'],
})

const SVC = getServiceById('adsim')!

export default function AdSimLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <AdSimAppLayout>{children}</AdSimAppLayout>
    </>
  )
}
