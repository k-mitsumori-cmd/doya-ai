import type { Metadata } from 'next'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
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
  return <>{children}</>
}
