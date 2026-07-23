import type { Metadata } from 'next'
import { SITE_CONFIG, SERVICE_SEO } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

const SVC = getServiceById('banner')!
// 親 banner/layout の title.template（`%s | ドヤバナーAI`）を避けるため absolute で確定。
// canonical は親の '/banner' 継承を上書きし、LP自身（/banner/landing）を指す。
const pageTitle = `${SVC.name}｜プロ品質のバナーをAIで自動生成 | ${SITE_CONFIG.name}`
const ogImage = `${SITE_CONFIG.url}/og/banner`

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: SVC.longDescription || SVC.description,
  keywords: SERVICE_SEO.banner.keywords,
  alternates: { canonical: '/banner/landing' },
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/banner/landing`,
    siteName: SITE_CONFIG.name,
    title: pageTitle,
    description: SVC.description,
    images: [{ url: ogImage, width: 1200, height: 630, alt: `${SVC.name} - ドヤマーケAI` }],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: pageTitle,
    description: SVC.description,
    images: [ogImage],
  },
}

export default function BannerLandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* SoftwareApplication は親 banner/layout が注入済みのため includeSoftwareApp=false（重複回避）。ここでは Breadcrumb + FAQ を追加 */}
      <LpJsonLd
        name={SVC.name}
        path="/banner/landing"
        description={SVC.longDescription || SVC.description}
        category="DesignApplication"
        features={SVC.features}
        faq={FAQ}
        includeSoftwareApp={false}
      />
      {children}
    </>
  )
}
