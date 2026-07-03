import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/adbanner',
  },
  title: SERVICE_SEO.adbanner.title,
  description: SERVICE_SEO.adbanner.description,
  keywords: SERVICE_SEO.adbanner.keywords,
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/adbanner`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.adbanner.title,
    description: SERVICE_SEO.adbanner.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: SERVICE_SEO.adbanner.title,
    description: SERVICE_SEO.adbanner.description,
  },
}

export default function AdBannerRootLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/adbanner', name: 'ドヤ広告バナーAI', description: 'URLを入れるだけでAIが広告バナーを量産し、採点・改善・ロゴ合成まで自動化するツール。', category: 'DesignApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <>{children}</>
    </>
  )
}
