import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

export const metadata: Metadata = buildServiceSubMetadata('asklink', 'pricing', { path: '/asklink/pricing' })

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
