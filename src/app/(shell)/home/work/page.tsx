// ============================================
// 「ドヤくんが進めた仕事」の一覧（経営ホームの「すべて見る」から）
// ============================================
// ⚠️ 旗 AGENT_ORCHESTRATION_ROLLOUT の内側だけ（off なら 404。経営ホームにも入口が出ない）。
// ⚠️ ここは読むだけ。記録が使える設定（AGENT_RUNS_STORE=db）ならサーバーの記録、無ければこの端末に残した分を出す。
// 枠（AppShell）は src/app/(shell)/layout.tsx が出す。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import WorkHistory from '@/components/home-agent/WorkHistory'

export const metadata: Metadata = {
  title: 'ドヤくんが進めた仕事',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HomeWorkPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/work')
  if (!(await isAgentOrchestrationEnabled())) notFound()
  return <WorkHistory />
}
