import type { Metadata } from 'next'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
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
  return <>{children}</>
}
