import type { Metadata } from 'next'
import PersonaAppLayout from '@/components/PersonaAppLayout'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
  title: SERVICE_SEO.persona.title,
  description: SERVICE_SEO.persona.description,
  keywords: SERVICE_SEO.persona.keywords,
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/persona`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.persona.title,
    description: SERVICE_SEO.persona.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: SERVICE_SEO.persona.title,
    description: SERVICE_SEO.persona.description,
  },
}

export default function PersonaLayout({ children }: { children: React.ReactNode }) {
  return <PersonaAppLayout>{children}</PersonaAppLayout>
}

