import { Metadata } from 'next'
import { SITE_CONFIG, SERVICE_SEO, generateSoftwareApplicationSchema } from '@/lib/seo'

// ============================================
// カンタンマーケAI メタデータ
// ============================================
export const metadata: Metadata = {
  title: {
    default: SERVICE_SEO.kantan.title,
    template: `%s | カンタンマーケAI`,
  },
  description: SERVICE_SEO.kantan.description,
  keywords: SERVICE_SEO.kantan.keywords,
  
  alternates: {
    canonical: '/kantan',
  },
  
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/kantan`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.kantan.title,
    description: SERVICE_SEO.kantan.description,
    images: [
      {
        url: SERVICE_SEO.kantan.ogImage,
        width: 1200,
        height: 630,
        alt: 'カンタンマーケAI - マーケティング業務をAIで劇的効率化',
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    title: SERVICE_SEO.kantan.title,
    description: SERVICE_SEO.kantan.description,
    images: [SERVICE_SEO.kantan.ogImage],
  },
}

export default function KantanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 構造化データ
  const softwareSchema = generateSoftwareApplicationSchema('kantan')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSchema),
        }}
      />
      {children}
    </>
  )
}
