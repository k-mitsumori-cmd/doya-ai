import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import CunningLayoutShell from '@/components/cunning/CunningLayoutShell'

export const metadata: Metadata = {
  alternates: {
    canonical: '/cunning',
  },
  title: 'ドヤカンニング | Web会議のAIカンペツール',
  description: 'Web会議の相手の質問をAIがリアルタイムに検出し、回答カンペを自動表示。商談・面接・カスタマーサポートの受け答えをAIが支援します。',
}

export default function CunningLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/cunning', name: 'ドヤカンニング', description: 'Web会議の相手の質問をAIがリアルタイム検出し、回答カンペを自動表示するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <CunningLayoutShell>{children}</CunningLayoutShell>
    </>
  )
}
