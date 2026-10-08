import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

// ⚠️ 開発中のあいだは noindex（LP と揃える）。公開するときに外す
export const metadata: Metadata = {
  ...buildServiceSubMetadata('asklink', 'pricing', { path: '/asklink/pricing' }),
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
