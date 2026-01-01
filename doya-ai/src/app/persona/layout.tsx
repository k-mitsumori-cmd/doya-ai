import type { Metadata } from 'next'
import { PersonaAppLayout } from '@/components/PersonaAppLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'ドヤペルソナ - URLからペルソナ＆クリエイティブを自動生成',
  description: 'サイトURLを入力するだけで、ペルソナ設計・キャッチコピー・LP構成・広告文・メール文まで一括生成。売れるマーケティング素材を瞬時に作成。',
}

export default async function PersonaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const isLoggedIn = !!user?.id
  const planRaw = String(user?.bannerPlan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST')).toUpperCase()
  const currentPlan =
    planRaw === 'PRO' || planRaw === 'BASIC' || planRaw === 'STARTER' || planRaw === 'BUSINESS'
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
    <PersonaAppLayout currentPlan={currentPlan as any} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
      {children}
    </PersonaAppLayout>
  )
}

