export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// GET /api/agent/runs/summary — 左のメニューの「動いているタスク」の件数
// ============================================
// 型: AgentTaskCounts（running / waiting / done / failed）。中身（作戦・答え・結果）は返さない。
// - 旗と記録の設定（AGENT_RUNS_STORE=db）の両方が有効なときだけ。本人の実行だけを数える（7日まで、新しい20件）。
// - どちらかが外れていれば 404（記録が無いときは { store: 'off' }）。メニューは件数を出さず、経営ホームへのリンクだけにする。
// - ?product=<製品の id> があり、製品の旗が on の人なら、その製品のツールの分だけを数える（段3）。旗が off なら絞らない（今のまま）
import { NextResponse, type NextRequest } from 'next/server'
import { parseProductId } from '@/lib/products'
import { isProductHubsEnabled } from '@/lib/products/flag'
import { agentGate, NO_STORE } from '@/lib/agent-orchestration/api.server'
import { agentTaskCounts } from '@/lib/agent-orchestration/task-counts'
import { prismaRunRepo } from '@/lib/agent-orchestration/runs.prisma'

export async function GET(req: NextRequest) {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  const asked = parseProductId(req.nextUrl.searchParams.get('product'))
  const product = asked && (await isProductHubsEnabled()) ? asked : null
  try {
    return NextResponse.json(await agentTaskCounts(prismaRunRepo, gate.userId, new Date(), product), { headers: NO_STORE })
  } catch {
    console.error('[agent/runs/summary] read failed')
    return NextResponse.json({ error: '件数を読めませんでした。' }, { status: 503, headers: NO_STORE })
  }
}
