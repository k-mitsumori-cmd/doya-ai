import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import MovieLayout from '@/components/movie/MovieLayout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildServiceMetadata('movie', {
  keywords: ['動画広告', '動画生成', 'AI動画', '動画広告作成', 'ショート動画', '広告動画'],
})

const SVC = getServiceById('movie')!

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="MultimediaApplication"
        features={SVC.features}
      />
      <MovieLayout>{children}</MovieLayout>
    </>
  )
}
