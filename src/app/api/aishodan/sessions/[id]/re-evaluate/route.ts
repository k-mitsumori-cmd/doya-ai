export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/sessions/[id]/re-evaluate — 適合判定をやり直す
//
// ⚠️ 判定の生成は商談終了時の1回きりで、失敗すると AishodanOutcome が作られない。
//    モデルIDの世代交代・JSONパース失敗は実際に起きており、そのたびに
//    **本物の見込み客の商談が、判定不能のまま一覧で放置**されていた。
//    終了処理そのものは冪等ではない（endedAt があると早期リターンする）ため、
//    もう一度 /end を叩いても判定は作り直せない。やり直す入口をここに置く。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { evaluateSession } from '@/lib/aishodan/evaluate'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // 判定は営業の意思決定に使う。やり直しはマネージャー以上に限る
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '再評価する権限がありません' }, { status: 403 })
  }

  // ⚠️ id だけで他組織の商談に到達させない（二重条件）
  const s = await prisma.aishodanSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: {
      outcome: { select: { id: true, overriddenAt: true } },
      room: { include: { scenario: { include: { product: { select: { name: true } } } } } },
    },
  })
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })
  if (!s.startedAt) {
    return NextResponse.json({ error: 'この商談はまだ実施されていません。' }, { status: 400 })
  }
  // ⚠️ 人が手で直した判定をAIで上書きしない。上書きするなら明示的に指示させる。
  if (s.outcome?.overriddenAt) {
    const body = await req.json().catch(() => ({}))
    if (body?.overwriteManual !== true) {
      return NextResponse.json(
        { error: 'この商談の判定は担当者が手で入力しています。上書きする場合は再度お確かめください。', needsConfirm: true },
        { status: 409 }
      )
    }
  }

  const cfg = toScenarioConfig(s.room.scenario)
  const [turns, slotValues, unanswered] = await Promise.all([
    prisma.aishodanTurn.findMany({
      where: { sessionId: s.id },
      orderBy: [{ startMs: 'asc' }, { ord: 'asc' }],
      select: { speaker: true, text: true },
    }),
    prisma.aishodanSlotValue.findMany({ where: { sessionId: s.id }, select: { key: true, value: true } }),
    prisma.aishodanQuestion.findMany({
      where: { sessionId: s.id, unanswered: true },
      select: { text: true },
    }),
  ])

  if (turns.length === 0) {
    return NextResponse.json({ error: '会話のログが無いため判定できません。' }, { status: 400 })
  }

  let result
  try {
    result = await evaluateSession({
      productName: s.room.scenario.product.name,
      icp: cfg.icp,
      slots: cfg.slots,
      slotValues,
      turns,
      unansweredQuestions: unanswered.map((q) => q.text),
    })
  } catch (err) {
    console.error('[aishodan] re-evaluate failed', err instanceof Error ? err.message : err)
    // ⚠️ 失敗しても商談ログは触らない。手で判定を入れる経路（PATCH）が残っている
    return NextResponse.json(
      { error: '判定を作成できませんでした。時間をおいてもう一度お試しいただくか、判定を手で入力してください。' },
      { status: 502 }
    )
  }

  const outcome = await prisma.aishodanOutcome.upsert({
    where: { sessionId: s.id },
    create: {
      sessionId: s.id,
      fitScore: result.fitScore,
      verdict: result.verdict,
      reason: result.reason,
      summary: { ...result.summary, conditions: result.conditions } as any,
      nextAction: result.nextAction,
    },
    update: {
      fitScore: result.fitScore,
      verdict: result.verdict,
      reason: result.reason,
      summary: { ...result.summary, conditions: result.conditions } as any,
      nextAction: result.nextAction,
      // AIで作り直したので、手入力の記録は消す（誰の判断かを偽らせない）
      overriddenBy: null,
      overriddenAt: null,
    },
  })
  await prisma.aishodanSession.update({ where: { id: s.id }, data: { status: 'evaluated' } })

  return NextResponse.json({ outcome })
}
