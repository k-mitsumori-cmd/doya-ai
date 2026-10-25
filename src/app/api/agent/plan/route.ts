export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// POST /api/agent/plan — 依頼から、質問か作戦を返す（エージェントの作戦づくり）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §4・型は src/lib/agent-orchestration/types.ts
// - 依頼の文（text）か組み合わせの id（recipeId）から、組み合わせを選ぶ。合わなければ { kind: 'none' }。
// - 答え（answers）が無い・足りないときは、質問を返す。そろっていれば、作戦（タスク・減るドヤパワー）を返す。
// - 段階1は、決まった組み合わせから作る。AI を呼ばず、ドヤパワーも減らさない。
// - 旗（AGENT_ORCHESTRATION_ROLLOUT）が出すと決めた人でなければ 404。off ならセッションも読まない。
import { NextRequest, NextResponse } from 'next/server'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import { findRecipe, matchRecipe, parseSalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { planFromRecipe } from '@/lib/agent-orchestration/plan'
import type { AgentPlanResponse } from '@/lib/agent-orchestration/types'
import { readOperationalJson } from '@/lib/operational-json'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function answersOf(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out: Record<string, string> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 10)) if (typeof x === 'string' && k.length <= 40) out[k] = x.slice(0, 2048)
  return out
}

export async function POST(req: NextRequest) {
  if (!(await isAgentOrchestrationEnabled())) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
  let body: Record<string, unknown>
  try {
    body = await readOperationalJson(req, 16 * 1024)
  } catch {
    return NextResponse.json({ error: '送った内容を読めませんでした。' }, { status: 400, headers: NO_STORE })
  }
  const recipe = findRecipe(body.recipeId) ?? (typeof body.text === 'string' ? matchRecipe(body.text.slice(0, 500)) : null)
  if (!recipe) return NextResponse.json({ kind: 'none' } satisfies AgentPlanResponse, { headers: NO_STORE })
  const base = { recipeId: recipe.id, title: recipe.title, lead: recipe.lead }
  const answers = answersOf(body.answers)
  if (!answers) return NextResponse.json({ kind: 'questions', ...base, questions: recipe.questions } satisfies AgentPlanResponse, { headers: NO_STORE })
  const parsed = parseSalesPrepAnswers(answers)
  if (!parsed.ok) {
    return NextResponse.json({ kind: 'questions', ...base, questions: recipe.questions, error: { questionId: parsed.questionId, text: parsed.error } } satisfies AgentPlanResponse, { headers: NO_STORE })
  }
  return NextResponse.json({ kind: 'plan', ...base, plan: planFromRecipe(recipe, parsed.value), answers } satisfies AgentPlanResponse, { headers: NO_STORE })
}
