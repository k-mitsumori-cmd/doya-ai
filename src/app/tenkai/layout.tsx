import type { Metadata } from 'next'
import { buildServiceMetadata, generateToolSchema } from '@/lib/seo'
import TenkaiLayout from '@/components/tenkai/TenkaiLayout'

// 正本は services.ts。OGP/Twitterカード/siteName も含めて buildServiceMetadata に統一する
export const metadata: Metadata = buildServiceMetadata('tenkai', {
  tagline: '1コンテンツ→9プラットフォーム自動変換',
  keywords: ['コンテンツ転用', 'SNS 自動投稿文', 'note', 'X 投稿', 'Instagram 投稿', 'メルマガ', 'プレスリリース'],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/tenkai', name: 'ドヤ展開AI', description: '1つのコンテンツをX・Instagram・YouTubeなど9プラットフォーム向けにAIが自動変換するツール。', category: 'BusinessApplication', serviceId: 'tenkai' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <TenkaiLayout>{children}</TenkaiLayout>
    </>
  )
}
