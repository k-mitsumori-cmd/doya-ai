import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

export const metadata: Metadata = buildServiceSubMetadata('popup', 'pricing', { path: '/popup/pricing' })

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
