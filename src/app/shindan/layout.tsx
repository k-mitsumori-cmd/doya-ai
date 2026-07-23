import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import ShindanAppLayout from '@/components/ShindanAppLayout'

export const metadata: Metadata = buildServiceMetadata('shindan', {
  keywords: ['Web診断', 'サイト分析', 'SEO診断', 'コンバージョン改善', '競合比較', 'サイト改善'],
})

const SVC = getServiceById('shindan')!

export default function ShindanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <ShindanAppLayout>{children}</ShindanAppLayout>
    </>
  )
}
