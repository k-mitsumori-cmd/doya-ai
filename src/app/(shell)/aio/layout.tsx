import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('aio', {
  // 検索結果でサービス名が切れないよう、タイトルは短く保つ（説明はdescriptionに）
  tagline: 'AI検索でのブランド露出を定点観測',
  keywords: [
    'AI可視性', 'AEO', '回答エンジン最適化', 'LLMO', 'AI検索最適化',
    'Share of Voice', 'ChatGPT', 'Gemini', 'Claude', 'Perplexity',
    'ブランド言及', '引用元', 'AI SEO',
  ],
})

const SVC = getServiceById('aio')!

export default function AioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {children}
    </>
  )
}
