export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// GET /api/agent/runs/active — 「続きを進める」: 最後の実行のうち、済んでいない ToDo が残っているもの
// ============================================
// 型: AgentRunResponse（無ければ { run: null }）。画面は run.states を runAgentTasks の prev に渡し、run.remaining だけを動かす。
// - 旗と記録の設定（AGENT_RUNS_STORE=db）の両方が有効なときだけ。本人の実行だけを読む（7日まで）。
import { NextResponse } from 'next/server'
import { agentGate, NO_STORE } from '@/lib/agent-orchestration/api.server'
import { latestOpenRun } from '@/lib/agent-orchestration/runs'
import { prismaRunRepo } from '@/lib/agent-orchestration/runs.prisma'

export async function GET() {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  try {
    return NextResponse.json({ run: await latestOpenRun(prismaRunRepo, gate.userId) }, { headers: NO_STORE })
  } catch {
    console.error('[agent/runs/active] read failed')
    return NextResponse.json({ error: '続きを読めませんでした。時間をおいて、もう一度お試しください。' }, { status: 503, headers: NO_STORE })
  }
}
