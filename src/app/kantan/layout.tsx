import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('kantan', {
  keywords: ['マーケティングAI', 'マーケ業務効率化', 'AIエージェント', 'LP構成案', 'バナーコピー', '広告分析', 'メルマガ作成', '競合分析', 'プロンプト不要'],
})

const SVC = getServiceById('kantan')!

export default function KantanLayout({ children }: { children: React.ReactNode }) {
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
      {children}
    </>
  )
}
