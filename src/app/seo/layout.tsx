import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import { SeoAppLayout } from '@/components/SeoAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  alternates: {
    canonical: '/seo',
  },
  title: 'ドヤ記事作成 | SEO・LLMOに強いAI記事作成ツール',
  description: 'SEOとLLMO（AI検索最適化）に強い長文記事を、構成から執筆まで分割生成で安定作成するAIライティングツール。無料で今すぐ使えます。',
}

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const isLoggedIn = !!user?.id
  const planRaw = String(user?.seoPlan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST')).toUpperCase()
  const currentPlan =
    planRaw === 'PRO'
      ? 'PRO'
      : planRaw === 'ENTERPRISE'
        ? 'ENTERPRISE'
        : planRaw === 'FREE'
          ? 'FREE'
          : planRaw === 'GUEST'
            ? 'GUEST'
            : 'UNKNOWN'
  const firstLoginAt = (user?.firstLoginAt as any) || null

  const toolSchema = generateToolSchema({ path: '/seo', name: 'ドヤ記事作成', description: 'SEOとLLMO（AI検索最適化）に強い長文記事を分割生成で安定作成するAIライティングツール。', category: 'BusinessApplication' })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <SeoAppLayout currentPlan={currentPlan as any} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
        {children}
      </SeoAppLayout>
    </>
  )
}