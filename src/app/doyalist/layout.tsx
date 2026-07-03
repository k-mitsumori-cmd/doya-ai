import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import DoyalistLayout from '@/components/doyalist/DoyalistLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/doyalist',
  },
  title: 'ドヤリスト | AI営業リスト + 営業文ツール',
  description: '業界・地域を選ぶだけでAIが営業リストを自動生成。フォーム営業文・メール文面・荷電スクリプトも1クリックで作成できます。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/doyalist', name: 'ドヤリスト', description: 'gBizINFO公的データからAIが営業リストと営業文を自動作成する営業支援ツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <DoyalistLayout>{children}</DoyalistLayout>
    </>
  )
}
