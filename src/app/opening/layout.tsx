import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import OpeningAppLayout from '@/components/opening/OpeningAppLayout'

export const metadata: Metadata = buildServiceMetadata('opening', {
  keywords: ['オープニングアニメーション', 'Reactアニメーション', 'アニメーション生成', 'オープニング動画', 'サイトアニメーション'],
})

const SVC = getServiceById('opening')!

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="DesignApplication"
        features={SVC.features}
      />
      <OpeningAppLayout>{children}</OpeningAppLayout>
    </>
  )
}
