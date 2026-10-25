export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// POST /api/agent/tasks — エージェントの作業を1つ動かす（経営ホームの「まとめて進める」）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §6・§7
// - 画面は、計画の作業ごとにこの API を同時に呼ぶ（1回の呼び出しで1つのツール）。
// - 届くのは「組み合わせの id・作業の id・質問への答え・やり直しの材料」だけ。ツールへの入力はサーバーが答えから作る。
// - 旗（AGENT_ORCHESTRATION_ROLLOUT）が出すと決めた人でなければ 404。off ならセッションも読まない。
// ⚠️ ログイン・組織・ドヤパワー・利用枠は、呼ばれた各ツールのルートが確かめる（routes.server.ts）。
import { NextRequest, NextResponse } from 'next/server'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import { findRecipe, parseSalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { AgentTaskError, failureText } from '@/lib/agent-orchestration/runner'
import { runSalesPrepTask, type SalesPrepTaskId } from '@/lib/agent-orchestration/tools'
import { toolDepsFor } from '@/lib/agent-orchestration/routes.server'
import { readOperationalJson } from '@/lib/operational-json'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const TASK_IDS: SalesPrepTaskId[] = ['research', 'quote', 'slides']

/** やり直しの材料。決まった鍵と短い id だけを受け取る */
function parseResume(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const id = (v as Record<string, unknown>).projectId
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? { projectId: id } : undefined
}

export async function POST(req: NextRequest) {
  if (!(await isAgentOrchestrationEnabled())) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
  let body: Record<string, unknown>
  try {
    body = await readOperationalJson(req, 16 * 1024)
  } catch {
    return NextResponse.json({ error: '送った内容を読めませんでした。' }, { status: 400, headers: NO_STORE })
  }
  const recipe = findRecipe(body.recipeId)
  const taskId = TASK_IDS.find((t) => t === body.taskId)
  if (!recipe || !taskId) return NextResponse.json({ error: '頼める作業ではありません。' }, { status: 400, headers: NO_STORE })
  const parsed = parseSalesPrepAnswers(body.answers)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, questionId: parsed.questionId, kind: 'input' }, { status: 400, headers: NO_STORE })

  try {
    const result = await runSalesPrepTask(taskId, parsed.value, toolDepsFor(req), parseResume(body.resume))
    return NextResponse.json({ result }, { headers: NO_STORE })
  } catch (e) {
    const err = e instanceof AgentTaskError ? e : null
    if (!err) console.error('[agent/tasks] task failed', { taskId })
    return NextResponse.json(
      { error: failureText(e), kind: err?.kind ?? 'tool', resume: err?.resume, href: err?.href },
      { status: 422, headers: NO_STORE },
    )
  }
}
