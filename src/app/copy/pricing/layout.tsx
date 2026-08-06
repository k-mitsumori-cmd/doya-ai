import type { Metadata } from 'next'
import { buildServiceSubMetadata } from '@/lib/seo'

// 親LPの title をそのまま継承すると、指名検索でLPではなくこのページが選ばれてしまう。
// サービス名を含む固有の title と自ページの canonical を持たせて受け皿をLPに寄せる。
export const metadata: Metadata = buildServiceSubMetadata('copy', 'pricing', {
  path: '/copy/pricing',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
