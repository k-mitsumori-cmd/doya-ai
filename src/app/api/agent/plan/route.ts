export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// POST /api/agent/plan — 依頼から、質問か作戦を返す（エージェントの作戦づくり）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §4・型は src/lib/agent-orchestration/types.ts
// - 依頼の文（text）か組み合わせの id（recipeId）から、組み合わせを選ぶ。合わなければ { kind: 'none' }。
// - 答え（answers）が無い・足りないときは、質問を返す。
// - そろっていれば、分析の材料（登録会社・使うツールの準備・ドヤパワーの残り）を同時に読み、作戦を返す。
// - Accept: application/x-ndjson なら、材料の読み始め・読み終わり・考えたことの行・最後の答えを1行ずつ流す（AgentPlanEvent）。
// - 段階1は、決まった組み合わせから作る。AI を呼ばず、ドヤパワーも減らさない。
// - 旗（AGENT_ORCHESTRATION_ROLLOUT）が出すと決めた人でなければ 404。off ならセッションも読まない。
import { NextRequest, NextResponse } from 'next/server'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import { findRecipe, matchRecipe, parseSalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { planFromRecipe } from '@/lib/agent-orchestration/plan'
import { readSources } from '@/lib/agent-orchestration/sources'
import { realSourceReaders } from '@/lib/agent-orchestration/sources.server'
import type { AgentPlanEvent, AgentPlanResponse, AgentSourceView } from '@/lib/agent-orchestration/types'
import { readOperationalJson } from '@/lib/operational-json'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function answersOf(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out: Record<string, string> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 10)) if (typeof x === 'string' && k.length <= 40) out[k] = x.slice(0, 2048)
  return out
}

/** 作戦づくりの本体。emit には材料と考えたことの行を流す */
async function respond(body: Record<string, unknown>, emit: (e: AgentPlanEvent) => void): Promise<AgentPlanResponse> {
  const recipe = findRecipe(body.recipeId) ?? (typeof body.text === 'string' ? matchRecipe(body.text.slice(0, 500)) : null)
  if (!recipe) return { kind: 'none' }
  const base = { recipeId: recipe.id, title: recipe.title, lead: recipe.lead }
  const answers = answersOf(body.answers)
  if (!answers) return { kind: 'questions', ...base, questions: recipe.questions }
  const parsed = parseSalesPrepAnswers(answers)
  if (!parsed.ok) return { kind: 'questions', ...base, questions: recipe.questions, error: { questionId: parsed.questionId, text: parsed.error } }
  const read = await readSources(parsed.value, realSourceReaders(), (source: AgentSourceView) => emit({ type: 'source', source }))
  const plan = planFromRecipe(recipe, parsed.value, { readiness: read.readiness, companyName: read.companyName })
  for (const text of plan.reasons) emit({ type: 'reason', text })
  return { kind: 'plan', ...base, plan, sources: read.sources, power: read.power, answers }
}

export async function POST(req: NextRequest) {
  if (!(await isAgentOrchestrationEnabled())) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
  let body: Record<string, unknown>
  try {
    body = await readOperationalJson(req, 16 * 1024)
  } catch {
    return NextResponse.json({ error: '送った内容を読めませんでした。' }, { status: 400, headers: NO_STORE })
  }
  const stream = (req.headers.get('accept') ?? '').includes('application/x-ndjson')
  if (!stream) return NextResponse.json(await respond(body, () => {}), { headers: NO_STORE })

  const enc = new TextEncoder()
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentPlanEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + '\n'))
      try {
        send({ type: 'result', response: await respond(body, send) })
      } catch {
        console.error('[agent/plan] failed')
        send({ type: 'error', text: '作戦を作れませんでした。時間をおいて、もう一度お試しください。' })
      }
      controller.close()
    },
  })
  return new Response(out, { headers: { ...NO_STORE, 'Content-Type': 'application/x-ndjson; charset=utf-8' } })
}
