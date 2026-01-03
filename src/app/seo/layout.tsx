import type { Metadata } from 'next'
import { SeoAppLayout } from '@/components/SeoAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: { absolute: 'ドヤライティングAI|SEOライティングまるなげ' },
  description:
    'ドヤライティングAIは、SEOに強い記事をテンプレ化。キーワードと記事タイプを選ぶだけで、最適な記事を自動生成。マーケターは「選ぶだけ」で記事が完成。',
  openGraph: {
    type: 'website',
    title: 'ドヤライティングAI|SEOライティングまるなげ',
    description:
      'ドヤライティングAIは、SEOに強い記事をテンプレ化。キーワードと記事タイプを選ぶだけで、最適な記事を自動生成。マーケターは「選ぶだけ」で記事が完成。',
    images: [
      {
        // 添付画像をそのまま配置する場合（推奨）
        url: '/seo/ogp.png',
        width: 1200,
        height: 630,
        alt: 'ドヤライティングAI|SEOライティングまるなげ',
      },
      {
        // フォールバック（静的画像が未配置でも表示が壊れないように）
        url: '/seo/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'ドヤライティングAI|SEOライティングまるなげ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ドヤライティングAI|SEOライティングまるなげ',
    description:
      'ドヤライティングAIは、SEOに強い記事をテンプレ化。キーワードと記事タイプを選ぶだけで、最適な記事を自動生成。マーケターは「選ぶだけ」で記事が完成。',
    images: ['/seo/ogp.png', '/seo/twitter-image'],
  },
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

  return (
    <SeoAppLayout currentPlan={currentPlan as any} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
      {children}
    </SeoAppLayout>
  )
}