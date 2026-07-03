import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import CopyAppLayout from '@/components/CopyAppLayout'
import { SERVICE_SEO, SITE_CONFIG } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/copy',
  },
  title: SERVICE_SEO.copy.title,
  description: SERVICE_SEO.copy.description,
  keywords: SERVICE_SEO.copy.keywords,
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/copy`,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.copy.title,
    description: SERVICE_SEO.copy.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: SERVICE_SEO.copy.title,
    description: SERVICE_SEO.copy.description,
  },
}

export default function CopyLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/copy', name: 'ドヤコピーAI', description: 'ターゲットに刺さる広告コピー・キャッチコピーをAIが自動生成するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <CopyAppLayout>{children}</CopyAppLayout>
    </>
  )
}
