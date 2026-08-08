export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/aishodan/scenarios/[id] — シナリオ取得
// PUT /api/aishodan/scenarios/[id] — シナリオ更新（フェーズ・スロット・ICP・ガードレール）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'
import { toScenarioConfig } from '@/lib/aishodan/public'
import type { Guardrails, Icp, Persona, Phase, PricePolicy, Slot } from '@/lib/aishodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/** シナリオは商材経由でしか組織に紐づかない。所有チェックはここに集約する */
async function loadOwned(scenarioId: string, organizationId: string) {
  return prisma.aishodanScenario.findFirst({
    where: { id: scenarioId, product: { organizationId } },
    include: { product: { select: { id: true, name: true, profile: true } } },
  })
}

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const scenario = await loadOwned(p.id, ctx.organizationId)
  if (!scenario) return NextResponse.json({ error: 'シナリオが見つかりません' }, { status: 404 })

  return NextResponse.json({
    scenario: {
      id: scenario.id,
      name: scenario.name,
      product: scenario.product,
      ...toScenarioConfig(scenario),
    },
  })
}

const PRICE_POLICIES: PricePolicy[] = ['disclose', 'rough', 'withhold']

export async function PUT(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const scenario = await loadOwned(p.id, ctx.organizationId)
  if (!scenario) return NextResponse.json({ error: 'シナリオが見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 200)
  if (Number.isFinite(Number(body?.durationMin))) {
    // 45分は仕様上の上限。長すぎる商談は相手が離脱する
    data.durationMin = Math.max(5, Math.min(45, Math.round(Number(body.durationMin))))
  }

  if (Array.isArray(body?.phases)) {
    const phases: Phase[] = body.phases
      .filter((x: any) => x && x.key && x.name)
      .slice(0, 10)
      .map((x: any) => ({
        key: String(x.key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'phase',
        name: String(x.name).slice(0, 60),
        goal: String(x.goal || '').slice(0, 500),
        exitCondition: String(x.exitCondition || '').slice(0, 500),
        maxTurns: Number.isFinite(Number(x.maxTurns)) ? Math.max(1, Math.min(40, Math.round(Number(x.maxTurns)))) : 8,
      }))
    // フェーズが空だと進行が成立しない。空配列は受け付けない
    if (phases.length > 0) data.phases = phases as any
  }

  if (Array.isArray(body?.slots)) {
    const slots: Slot[] = body.slots
      .filter((x: any) => x && x.key && x.label)
      .slice(0, 20)
      .map((x: any) => ({
        key: String(x.key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'slot',
        label: String(x.label).slice(0, 80),
        type: ['text', 'choice', 'number', 'date'].includes(x.type) ? x.type : 'text',
        required: Boolean(x.required),
        questionHint: String(x.questionHint || '').slice(0, 300),
        choices: Array.isArray(x.choices) ? x.choices.map((c: any) => String(c).slice(0, 80)).slice(0, 20) : undefined,
      }))
    data.slots = slots as any
  }

  if (body?.icp && Array.isArray(body.icp.conditions)) {
    const icp: Icp = {
      conditions: body.icp.conditions
        .filter((c: any) => c && c.key && c.label)
        .slice(0, 12)
        .map((c: any) => ({
          key: String(c.key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'cond',
          label: String(c.label).slice(0, 100),
          weight: Number.isFinite(Number(c.weight)) ? Math.max(0, Math.min(100, Math.round(Number(c.weight)))) : 10,
          match: String(c.match || '').slice(0, 500),
        })),
    }
    data.icp = icp as any
  }

  if (body?.guardrails && typeof body.guardrails === 'object') {
    const g = body.guardrails
    const guardrails: Guardrails = {
      pricePolicy: PRICE_POLICIES.includes(g.pricePolicy) ? g.pricePolicy : 'rough',
      competitorPolicy: g.competitorPolicy === 'avoid' ? 'avoid' : 'neutral',
      prohibitedTopics: Array.isArray(g.prohibitedTopics)
        ? g.prohibitedTopics.map((t: any) => String(t).slice(0, 200)).slice(0, 30)
        : [],
      // 既定は defer（推測で答えさせない）。不正値もここへ倒す
      noEvidenceBehavior: g.noEvidenceBehavior === 'general' ? 'general' : 'defer',
    }
    data.guardrails = guardrails as any
  }

  if (body?.persona && typeof body.persona === 'object') {
    const persona: Persona = {
      tone: String(body.persona.tone || '丁寧な敬語').slice(0, 300),
      firstPerson: String(body.persona.firstPerson || '私').slice(0, 20),
      maxCharsPerUtterance: Number.isFinite(Number(body.persona.maxCharsPerUtterance))
        ? Math.max(40, Math.min(400, Math.round(Number(body.persona.maxCharsPerUtterance))))
        : 120,
    }
    data.persona = persona as any
  }

  // 商材プロフィール（「話してはいけないこと」もここで編集する）
  if (body?.profile && typeof body.profile === 'object') {
    await prisma.aishodanProduct.update({
      where: { id: scenario.productId },
      data: { profile: body.profile as any },
    })
  }

  if (Object.keys(data).length > 0) {
    await prisma.aishodanScenario.update({ where: { id: scenario.id }, data })
  }

  const updated = await loadOwned(scenario.id, ctx.organizationId)
  return NextResponse.json({
    scenario: updated ? { id: updated.id, name: updated.name, product: updated.product, ...toScenarioConfig(updated) } : null,
  })
}
