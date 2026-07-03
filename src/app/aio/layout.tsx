import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/aio',
  },
  title: 'ドヤAIO | AIにどう見られているかを可視化（AI可視性・AEO）',
  description:
    'ChatGPT・Gemini・Claude・Perplexityにブランドがどれだけ言及・引用されるかを定点観測。Share of Voice・引用元・感情を分析し、AI検索最適化（AEO）の打ち手まで提案します。',
}

export default function AioLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/aio', name: 'ドヤAIO', description: 'ChatGPT・Gemini・Claude・Perplexityでの自社ブランドの言及・AI可視性（AEO/LLMO）を定点観測するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <>{children}</>
    </>
  )
}
