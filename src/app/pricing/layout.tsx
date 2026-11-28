import type { Metadata } from 'next'
import { SITE_CONFIG, SITE_ALTERNATE_NAMES } from '@/lib/seo'
import { PUBLIC_PRICE_SENTENCE, PRICING_META_SENTENCE } from '@/lib/pricing-v2/public-copy'

// 料金ページ（フリー / チーム）。説明文の金額と人数は public-copy.ts（plans.ts）から出す。
// ルートlayoutの title をそのまま継承するとトップページと同一 title になるため、固有titleを持たせる。
export const metadata: Metadata = {
  // absolute でルートlayoutの template（` | ドヤAI`）の二重付与を防ぐ
  title: { absolute: `料金プラン｜${SITE_CONFIG.name}` },
  description: `${SITE_CONFIG.name}の料金プラン。${PRICING_META_SENTENCE}`,
  keywords: [SITE_CONFIG.name, ...SITE_ALTERNATE_NAMES, `${SITE_CONFIG.name} 料金`, '料金プラン', '統一プラン', 'AI SaaS 料金'],
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/pricing`,
    siteName: SITE_CONFIG.name,
    title: `料金プラン｜${SITE_CONFIG.name}`,
    description: PUBLIC_PRICE_SENTENCE,
    images: [{ url: `${SITE_CONFIG.url}/ogp/portal.jpg`, width: 1200, height: 630, alt: `料金プラン - ${SITE_CONFIG.name}` }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
