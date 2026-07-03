import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import TenkaiLayout from '@/components/tenkai/TenkaiLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/tenkai',
  },
  title: 'ドヤ展開AI | 1コンテンツ→9プラットフォーム自動変換',
  description: '1つのコンテンツを9プラットフォームに最適化して自動変換。note, Blog, X, Instagram, LINE, Facebook, LinkedIn, メルマガ, プレスリリースに対応。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/tenkai', name: 'ドヤ展開AI', description: '1つのコンテンツをX・Instagram・YouTubeなど9プラットフォーム向けにAIが自動変換するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <TenkaiLayout>{children}</TenkaiLayout>
    </>
  )
}
