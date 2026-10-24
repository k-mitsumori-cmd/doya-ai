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
import { SETUP_HIDE_COOKIE } from './cookies'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { loadDoyaPowerHome } from '@/lib/doya-power/home.server'
import { DoyaPowerHomeCard } from '@/components/doya-power/DoyaPowerHome'
import HomeDashboard from './HomeDashboard'

export const metadata: Metadata = {
  title: '経営ホーム',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home')

  const summary = await getHomeSummary(userId)
  // 枠（AppShell）は src/app/(shell)/layout.tsx が出す。入力が主役のホーム（UI 品質 H-2）
  const setupHidden = (await cookies()).get(SETUP_HIDE_COOKIE)?.value === '1'
  // ドヤパワーの旗が出すと決めた人か（旗 DOYA_POWER_ROLLOUT の内側だけ。off なら台帳もセッションも読まない）
  const doyaPower = await isDoyaPowerEnabled()
  // ドヤパワーの欄（読めないときは null で、欄を出さない）と、会社の登録の案内の文（登録するとゲージが出る）の両方に使う
  const power = doyaPower ? await loadDoyaPowerHome() : null
  return <HomeDashboard initial={summary} setupHidden={setupHidden} powerCard={power ? <DoyaPowerHomeCard view={power} /> : null} doyaPower={doyaPower} />
}
