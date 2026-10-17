import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

export const metadata: Metadata = { ...buildServiceSubMetadata('popup', 'pricing', { path: '/popup/pricing' }), robots: { index: false, follow: true } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
