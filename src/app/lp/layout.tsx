import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import LpAppLayout from '@/components/LpAppLayout'

export const metadata: Metadata = buildServiceMetadata('lp', {
  keywords: ['ワイヤーフレーム', 'LP構成案', 'LP制作', 'ランディングページ', 'AIコピー', 'デザイン方針', 'HTMLエクスポート', '構成案'],
})

const SVC = getServiceById('lp')!

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <LpAppLayout>{children}</LpAppLayout>
    </>
  )
}
