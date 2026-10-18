import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

export const metadata: Metadata = { ...buildServiceSubMetadata('income', 'pricing', { path: '/income/pricing' }), robots: { index: false, follow: true } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
