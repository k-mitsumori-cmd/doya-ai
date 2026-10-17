// ============================================
// 経営ホーム（ログイン後の起点）
// ============================================
// 売上・収入・予定・人の状態を全ツールから読み集めて1画面にまとめ、
// 依頼を受けるエージェントから各ツールへつなぐ。
// ⚠️ サーバで集計してから描く（初回表示で数字が空にならないように）。
// ⚠️ ここは読むだけ。組織の自動作成や契約の変更はしない。
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHomeSummary } from '@/lib/home/summary'
import AppShell from '@/components/shell/AppShell'
import HomeDashboard from './HomeDashboard'

export const metadata: Metadata = {
  title: '経営ホーム | ドヤAI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home')

  const summary = await getHomeSummary(userId)
  return (
    <AppShell userName={summary.user.name ?? session?.user?.name}>
      <HomeDashboard initial={summary} />
    </AppShell>
  )
}
