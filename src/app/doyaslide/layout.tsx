import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import DoyaSlideLayout from '@/components/doyaslide/DoyaSlideLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/doyaslide',
  },
  title: 'ドヤスライド | AIプレゼン資料作成ツール',
  description: 'テーマを入力するだけで、AIが構成からデザインまでプレゼンテーション資料を自動生成。営業資料・提案書・登壇スライドを数分で作成できます。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/doyaslide', name: 'ドヤスライド', description: 'テーマを入力するだけでAIが構成からデザインまでプレゼン資料を自動生成するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <DoyaSlideLayout>{children}</DoyaSlideLayout>
    </>
  )
}
