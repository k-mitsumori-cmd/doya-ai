import type { Metadata } from 'next'
import { SeoAppLayout } from '@/components/SeoAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'ドヤ記事作成',
  description: 'SEO + LLMOに強い長文記事を分割生成で安定作成するツール。',
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