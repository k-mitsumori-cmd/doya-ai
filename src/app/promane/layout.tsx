import type { Metadata } from 'next'
import { buildServiceMetadata, generateToolSchema } from '@/lib/seo'

// 正本は services.ts。OGP/Twitterカード/siteName も含めて buildServiceMetadata に統一する
export const metadata: Metadata = buildServiceMetadata('promane', {
  tagline: 'AIプロジェクト管理ツール',
  keywords: ['プロジェクト管理', '案件管理', '工数管理', '進捗管理', '収支管理', '人件費', 'PM ツール'],
})

export default function PromaneLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/promane', name: 'ドヤプロマネ', description: 'タスク・進捗・工数をワークスペースで一元管理し、AIが進行を支援するプロジェクト管理ツール。', category: 'BusinessApplication', serviceId: 'promane' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      {children}
    </>
  )
}
