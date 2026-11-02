export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// POST /api/agent/runs — 作戦を保存して、実行を作る（「続きを進める」のため）
// GET  /api/agent/runs — 「ドヤくんが進めた仕事」の一覧（本人の実行を新しい順に。90日・100件まで）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §8。型: AgentRunCreateRequest / AgentRunResponse
// - 答えをサーバーで確かめ、材料を読み、作戦を作り直してから保存する（画面から届いた作戦は使わない）。
// - 旗（AGENT_ORCHESTRATION_ROLLOUT）と記録の設定（AGENT_RUNS_STORE=db）の両方が有効なときだけ。どちらかが外れていれば 404。
import { NextRequest, NextResponse } from 'next/server'
import { agentGate, NO_STORE } from '@/lib/agent-orchestration/api.server'
import { findRecipe, parseSalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { planFromRecipe } from '@/lib/agent-orchestration/plan'
import { readSources } from '@/lib/agent-orchestration/sources'
import { realSourceReaders } from '@/lib/agent-orchestration/sources.server'
import { createRun, recentRuns } from '@/lib/agent-orchestration/runs'
import { prismaRunRepo } from '@/lib/agent-orchestration/runs.prisma'
import { AgentTaskError } from '@/lib/agent-orchestration/runner'
import { readOperationalJson } from '@/lib/operational-json'

export async function GET() {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  try {
    return NextResponse.json({ runs: await recentRuns(prismaRunRepo, gate.userId, { days: 90, limit: 100 }) }, { headers: NO_STORE })
  } catch {
    console.error('[agent/runs] list failed')
    return NextResponse.json({ error: '進めた仕事を読めませんでした。時間をおいて、もう一度お試しください。' }, { status: 503, headers: NO_STORE })
  }
}

export async function POST(req: NextRequest) {
  const gate = await agentGate({ store: true })
  if ('response' in gate) return gate.response
  let body: Record<string, unknown>
  try {
    body = await readOperationalJson(req, 16 * 1024)
  } catch {
    return NextResponse.json({ error: '送った内容を読めませんでした。' }, { status: 400, headers: NO_STORE })
  }
  const recipe = findRecipe(body.recipeId)
  if (!recipe) return NextResponse.json({ error: '頼める作業ではありません。' }, { status: 400, headers: NO_STORE })
  const parsed = parseSalesPrepAnswers(body.answers)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, questionId: parsed.questionId, kind: 'input' }, { status: 400, headers: NO_STORE })
  const delegate = Array.isArray(body.delegate) ? body.delegate.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
  const text = typeof body.text === 'string' ? body.text.slice(0, 500) : null
  try {
    const read = await readSources(parsed.value, realSourceReaders())
    const plan = planFromRecipe(recipe, parsed.value, { readiness: read.readiness, companyName: read.companyName })
    const answers = Object.fromEntries(recipe.questions.map((q) => [q.id, String((body.answers as Record<string, unknown>)[q.id] ?? '')]))
    const run = await createRun(prismaRunRepo, { userId: gate.userId, recipeId: recipe.id, title: recipe.title, request: text, answers, plan, delegate })
    return NextResponse.json({ run }, { status: 201, headers: NO_STORE })
  } catch (e) {
    if (e instanceof AgentTaskError) return NextResponse.json({ error: e.userMessage, kind: e.kind }, { status: 400, headers: NO_STORE })
    console.error('[agent/runs] create failed')
    return NextResponse.json({ error: '作戦を保存できませんでした。時間をおいて、もう一度お試しください。' }, { status: 503, headers: NO_STORE })
  }
}
