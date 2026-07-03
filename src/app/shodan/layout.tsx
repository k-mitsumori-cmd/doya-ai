import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/shodan',
  },
  title: SERVICE_SEO.shodan.title,
  description: SERVICE_SEO.shodan.description,
  keywords: SERVICE_SEO.shodan.keywords,
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/shodan`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.shodan.title,
    description: SERVICE_SEO.shodan.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: SERVICE_SEO.shodan.title,
    description: SERVICE_SEO.shodan.description,
  },
}

export default function ShodanLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/shodan', name: 'ドヤ商談準備', description: '商談先のURLだけで深掘り調査・課題仮説・提案資料をAIが一括生成するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <>{children}</>
    </>
  )
}
