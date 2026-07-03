import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: '/sfa',
  },
  title: 'ドヤ営業管理 | 中小企業向けAI搭載SFA',
  description: '案件・商談・顧客をシンプルに一元管理。AIが標準搭載された中小企業向けの営業管理システム（SFA）です。無料で今すぐ使えます。',
}

export default function SfaLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/sfa', name: 'ドヤ営業管理', description: '案件・商談・顧客をシンプルに一元管理する、AI標準搭載の中小企業向けSFA。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      {children}
    </>
  )
}
