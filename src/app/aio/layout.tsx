import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ドヤAIO | AIにどう見られているかを可視化（AI可視性・AEO）',
  description:
    'ChatGPT・Gemini・Claude・Perplexityにブランドがどれだけ言及・引用されるかを定点観測。Share of Voice・引用元・感情を分析し、AI検索最適化（AEO）の打ち手まで提案します。',
}

export default function AioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
