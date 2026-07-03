import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import LpAppLayout from '@/components/LpAppLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/lp',
  },
  title: 'ドヤワイヤーフレーム AI | ワイヤーフレームを、1分で設計する。',
  description: '商品情報を入力するだけで、ワイヤーフレーム構成案・セクション別コピー・デザイン方針をAIが自動生成。HTMLエクスポートで、そのまま公開or制作会社への指示書として使用。',
}

export default function LpLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/lp', name: 'ドヤワイヤーフレームAI', description: 'LPのワイヤーフレームを1分でAI設計するツール。', category: 'DesignApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <LpAppLayout>{children}</LpAppLayout>
    </>
  )
}
