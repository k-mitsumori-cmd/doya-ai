export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// POST /api/agent/runs/[id]/tasks/[taskId] — 保存した作戦の ToDo を1つ動かす
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §8
// - 本文は読まない。ツールへの入力は、保存した作戦と答えだけから作る（画面の値を使わない）。
// - 同じ ToDo を同時に2回動かさない（表の条件付きの更新）。本人ごとに同時に3つまで（limit）。
// - 結果・失敗・ドヤパワーの量・途中まで作れたもの（スライドのプロジェクト・見積の品目の案）を表に残す。
// - 旗と記録の設定（AGENT_RUNS_STORE=db）の両方が有効なときだけ。
import { NextRequest, NextResponse } from 'next/server'
import { agentGate, NO_STORE, taskFailure } from '@/lib/agent-orchestration/api.server'
import { parseSalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { runStoredTask, runViewOf } from '@/lib/agent-orchestration/runs'
import { prismaRunRepo } from '@/lib/agent-orchestration/runs.prisma'
import { BUSY_MESSAGE, executeSalesPrepTask } from '@/lib/agent-orchestration/execute'
import { toolDepsFor } from '@/lib/agent-orchestration/routes.server'
import { AgentTaskError } from '@/lib/agent-orchestration/runner'
import type { SalesPrepTaskId } from '@/lib/agent-orchestration/tools'

type Ctx = { params: Promise<{ id: string; taskId: string }> | { id: string; taskId: string } }
const ID = /^[A-Za-z0-9_-]{1,64}$/
const TASK_IDS: SalesPrepTaskId[] = ['research', 'quote', 'slides']

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const taskId = TASK_IDS.find((t) => t === p.taskId)
  if (!ID.test(p.id ?? '') || !taskId) return NextResponse.json({ error: '頼める作業ではありません。' }, { status: 400, headers: NO_STORE })

  const view = async () => {
    const got = await prismaRunRepo.getRun(gate.userId, p.id).catch(() => null)
    return got ? runViewOf(got.run, got.tasks) : undefined
  }
  try {
    const result = await runStoredTask(prismaRunRepo, { userId: gate.userId, runId: p.id, taskId }, async ({ answers, resume }) => {
      const parsed = parseSalesPrepAnswers(answers)
      if (!parsed.ok) throw new AgentTaskError(parsed.error, 'input')
      return executeSalesPrepTask(taskId, parsed.value, { tools: await toolDepsFor(req) }, resume)
    })
    return NextResponse.json({ result, run: await view() }, { headers: NO_STORE })
  } catch (e) {
    // 同時の上限（BUSY）だけを 429 にする。ツールの利用枠の上限は、ToDo の失敗（422）として返す
    if (e instanceof AgentTaskError && e.userMessage === BUSY_MESSAGE) return NextResponse.json({ error: e.userMessage, kind: 'limit', run: await view() }, { status: 429, headers: NO_STORE })
    return taskFailure(e, { run: await view() })
  }
}
