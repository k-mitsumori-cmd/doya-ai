import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('shodan', {
  keywords: ['商談準備', '営業AI', '提案資料作成', '企業調査', '商談', 'BtoB営業', '提案スライド', 'PR TIMES'],
})

const SVC = getServiceById('shodan')!

export default function ShodanLayout({ children }: { children: React.ReactNode }) {
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
