import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import HrLayout from '@/components/hr/HrLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/hr',
  },
  title: 'ドヤHR | 人を活かすAI',
  description: '中小企業のためのAIタレントマネジメントシステム',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/hr', name: 'ドヤHR', description: '人材データベース・評価・スキル管理をAIで支援するタレントマネジメントシステム。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <HrLayout>{children}</HrLayout>
    </>
  )
}
