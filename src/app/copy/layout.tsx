import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import CopyAppLayout from '@/components/CopyAppLayout'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('copy', {
  keywords: ['広告コピー', 'キャッチコピー', 'コピー生成AI', '広告文', 'RSA', 'レスポンシブ検索広告', 'SNS広告コピー', 'A/Bテスト'],
})

const SVC = getServiceById('copy')!

export default function CopyLayout({ children }: { children: React.ReactNode }) {
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
      <CopyAppLayout>{children}</CopyAppLayout>
    </>
  )
}
