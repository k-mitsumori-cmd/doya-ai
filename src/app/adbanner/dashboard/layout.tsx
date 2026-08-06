import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'
import AdBannerAppLayout from '@/components/adbanner/AdBannerAppLayout'

export const dynamic = 'force-dynamic'
// LPと同じ title を持つとLPと競合するため、アプリ画面用の固有titleにして noindex にする
export const metadata: Metadata = buildServiceSubMetadata('adbanner', 'app', {
  description: 'URL・ブランドから広告特化バナーを一括量産。AIが採点して再生成。',
})

export default function AdBannerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdBannerAppLayout>{children}</AdBannerAppLayout>
}
