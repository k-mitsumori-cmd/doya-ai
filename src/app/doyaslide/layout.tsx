import type { Metadata } from 'next'
import { buildServiceMetadata, generateToolSchema } from '@/lib/seo'
import DoyaSlideLayout from '@/components/doyaslide/DoyaSlideLayout'

// 正本は services.ts。OGP/Twitterカード/siteName も含めて buildServiceMetadata に統一する
export const metadata: Metadata = buildServiceMetadata('doyaslide', {
  tagline: 'AIプレゼン資料作成ツール',
  keywords: ['プレゼン資料作成', 'AIスライド', '提案書作成', '営業資料', 'パワポ 自動生成', '登壇資料'],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/doyaslide', name: 'ドヤスライド', description: 'テーマを入力するだけでAIが構成からデザインまでプレゼン資料を自動生成するツール。', category: 'BusinessApplication', serviceId: 'doyaslide' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <DoyaSlideLayout>{children}</DoyaSlideLayout>
    </>
  )
}
