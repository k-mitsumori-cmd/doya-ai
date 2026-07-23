import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('adbanner', {
  keywords: ['広告バナー', 'バナー作成', 'バナー量産', '広告クリエイティブ', 'AIバナー', 'Meta広告', 'Google広告', 'LINE広告', 'バナーデザイン'],
})

const SVC = getServiceById('adbanner')!

export default function AdBannerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="DesignApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {children}
    </>
  )
}
