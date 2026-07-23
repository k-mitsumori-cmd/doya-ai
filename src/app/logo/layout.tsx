import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'

export const metadata: Metadata = buildServiceMetadata('logo', {
  keywords: ['ロゴ生成', 'AIロゴ', 'ロゴデザイン', 'ロゴ作成', 'ブランディング', 'ロゴメーカー'],
})

const SVC = getServiceById('logo')!

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
      {children}
    </>
  )
}
