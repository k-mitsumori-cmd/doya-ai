export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// GET /api/agent/runs/summary — 左のメニューの「動いているタスク」の件数
// ============================================
// 型: AgentTaskCounts（running / waiting / done / failed）。中身（作戦・答え・結果）は返さない。
// - 旗と記録の設定（AGENT_RUNS_STORE=db）の両方が有効なときだけ。本人の実行だけを数える（7日まで、新しい20件）。
// - どちらかが外れていれば 404（記録が無いときは { store: 'off' }）。メニューは件数を出さず、経営ホームへのリンクだけにする。
import { NextResponse } from 'next/server'
import { agentGate, NO_STORE } from '@/lib/agent-orchestration/api.server'
import { agentTaskCounts } from '@/lib/agent-orchestration/task-counts'
import { prismaRunRepo } from '@/lib/agent-orchestration/runs.prisma'

export async function GET() {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  try {
    return NextResponse.json(await agentTaskCounts(prismaRunRepo, gate.userId), { headers: NO_STORE })
  } catch {
    console.error('[agent/runs/summary] read failed')
    return NextResponse.json({ error: '件数を読めませんでした。' }, { status: 503, headers: NO_STORE })
  }
}
