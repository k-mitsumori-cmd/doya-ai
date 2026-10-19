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
import { cookies } from 'next/headers'
import { isUiNext } from '@/lib/ui-next'
import { SETUP_HIDE_COOKIE } from './cookies'
import HomeDashboard from './HomeDashboard'
import HomeDashboardLegacy from './HomeDashboardLegacy'

export const metadata: Metadata = {
  title: '経営ホーム',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home')

  const [summary, uiNext] = await Promise.all([getHomeSummary(userId), isUiNext()])
  // 枠（AppShell）は src/app/(shell)/layout.tsx が出す。
  // 入力が主役の新しいホーム（UI 品質 H-2）は、新しい見た目（チェックリスト §5.1）のときだけ
  if (!uiNext) return <HomeDashboardLegacy initial={summary} />
  const setupHidden = (await cookies()).get(SETUP_HIDE_COOKIE)?.value === '1'
  return <HomeDashboard initial={summary} setupHidden={setupHidden} />
}
