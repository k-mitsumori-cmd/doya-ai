import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import DoyalistLayout from '@/components/doyalist/DoyalistLayout'

export const metadata: Metadata = buildServiceMetadata('doyalist', {
  keywords: ['営業リスト', '営業リスト自動生成', '営業AI', 'フォーム営業文', '営業メール文面', '荷電スクリプト', '新規開拓', 'リスト作成'],
})

const SVC = getServiceById('doyalist')!

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <DoyalistLayout>{children}</DoyalistLayout>
    </>
  )
}
