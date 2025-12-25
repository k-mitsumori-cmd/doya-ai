import { Metadata } from 'next'
import { SITE_CONFIG, SERVICE_SEO, generateSoftwareApplicationSchema } from '@/lib/seo'
import PlanUpdatedListener from '@/components/PlanUpdatedListener'

// ============================================
// ドヤバナーAI メタデータ
// ============================================
export const metadata: Metadata = {
  title: {
    default: SERVICE_SEO.banner.title,
    template: `%s | ドヤバナーAI`,
  },
  description: SERVICE_SEO.banner.description,
  keywords: SERVICE_SEO.banner.keywords,
  
  alternates: {
    canonical: '/banner',
  },
  
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/banner`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.banner.title,
    description: SERVICE_SEO.banner.description,
    images: [
      {
        url: SERVICE_SEO.banner.ogImage,
        width: 1200,
        height: 630,
        alt: 'ドヤバナーAI - プロ品質バナーを自動生成',
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    title: SERVICE_SEO.banner.title,
    description: SERVICE_SEO.banner.description,
    images: [SERVICE_SEO.banner.ogImage],
  },
}

export default function BannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 構造化データ
  const softwareSchema = generateSoftwareApplicationSchema('banner')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSchema),
        }}
      />
      {/* 決済直後など、プラン更新イベントを受けてUIを即時反映 */}
      <PlanUpdatedListener />
      {children}
    </>
  )
}
