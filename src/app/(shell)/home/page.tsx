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
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import HomeAgent from '@/components/home-agent/HomeAgent'
import { isDepartmentsEnabled } from '@/lib/departments/flag'
import { DEPARTMENTS_COOKIE, parseDepartmentsCookie, parseDeptQuery } from '@/lib/departments'

export const metadata: Metadata = {
  title: '経営ホーム',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ dept?: string | string[] }> | { dept?: string | string[] } } = {}) {
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
  // 「ドヤくんに頼む」（分析 → ゴール・柱・ToDo → まとめて進める）。旗 AGENT_ORCHESTRATION_ROLLOUT の内側だけ（off ならセッションも読まない）
  const agent = await isAgentOrchestrationEnabled()
  // 部署ごとの入口（DEPARTMENTS_ROLLOUT）。off ならセッションも cookie も URL も読まず、今のホームのまま
  const departmentsOn = await isDepartmentsEnabled()
  const departments = departmentsOn
    ? {
        primary: parseDepartmentsCookie((await cookies()).get(DEPARTMENTS_COOKIE)?.value),
        dept: parseDeptQuery((await searchParams)?.dept),
      }
    : undefined
  // key: 部署を切り替えたとき、ドヤくんの欄を作り直す（依頼の欄の初期値が部署で変わるため）
  return <HomeDashboard initial={summary} setupHidden={setupHidden} powerCard={power ? <DoyaPowerHomeCard view={power} /> : null} doyaPower={doyaPower} agentStage={agent ? <HomeAgent key={departments?.dept ?? 'all'} dept={departments?.dept ?? null} /> : null} departments={departments} />
}
