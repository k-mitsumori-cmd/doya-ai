import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/promane',
  },
  title: 'ドヤプロマネ | AIプロジェクト管理ツール',
  description: 'タスク・進捗・工数をワークスペースで一元管理。AIが整理と進行を支援するプロジェクト管理ツールです。',
}

export default function PromaneLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/promane', name: 'ドヤプロマネ', description: 'タスク・進捗・工数をワークスペースで一元管理し、AIが進行を支援するプロジェクト管理ツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      {children}
    </>
  )
}
