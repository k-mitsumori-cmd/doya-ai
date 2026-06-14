import type { Metadata } from 'next'
import AdBannerAppLayout from '@/components/adbanner/AdBannerAppLayout'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'ドヤ広告バナーAI | 広告バナーを量産して改善',
  description: 'URL・ブランドから広告特化バナーを一括量産。AIが採点して再生成。',
}

export default function AdBannerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdBannerAppLayout>{children}</AdBannerAppLayout>
}
