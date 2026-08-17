export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET   /api/aishodan/sessions/[id] — 商談ログ全文・要約・スロット・未回答質問
// PATCH /api/aishodan/sessions/[id] — 判定の手動上書き
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { toScenarioConfig } from '@/lib/aishodan/public'
import type { Verdict } from '@/lib/aishodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const session = await prisma.aishodanSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: {
      // ⚠️ 表示は開始時刻順。終了時刻で並べると長い発話が後ろにずれる（mensetsuで踏んだ罠）
      turns: { orderBy: [{ startMs: 'asc' }, { ord: 'asc' }] },
      slotValues: true,
      questions: { orderBy: { createdAt: 'asc' } },
      outcome: true,
      room: { select: { name: true, isPreview: true, scenario: { include: { product: { select: { name: true } } } } } },
    },
  })
  if (!session) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const cfg = toScenarioConfig(session.room.scenario)
  return NextResponse.json({
    session: {
      id: session.id,
      guestName: session.guestName,
      guestCompany: session.guestCompany,
      guestEmail: session.guestEmail,
      status: session.status,
      currentPhase: session.currentPhase,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      schedulingClickedAt: session.schedulingClickedAt,
      referrer: session.referrer,
      roomName: session.room.name,
      isPreview: session.room.isPreview,
      productName: session.room.scenario.product.name,
      turns: session.turns.map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, phase: t.phase })),
      slots: cfg.slots.map((s) => ({
        key: s.key,
        label: s.label,
        required: s.required,
        value: session.slotValues.find((v) => v.key === s.key)?.value ?? null,
      })),
      questions: session.questions.map((q) => ({
        id: q.id, text: q.text, answerText: q.answerText, unanswered: q.unanswered,
      })),
      outcome: session.outcome,
      phases: cfg.phases.map((ph) => ({ key: ph.key, name: ph.name })),
    },
  })
}

const VERDICTS: Verdict[] = ['hot', 'warm', 'cold', 'unfit']

export async function PATCH(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ 適合判定は営業の意思決定に使う。同じ判定を作る /re-evaluate は manager 以上を
  //    要求しているのに、こちらだけ member でも書けた。非対称を解消する。
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '判定を変更する権限がありません' }, { status: 403 })
  }

  const session = await prisma.aishodanSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true, startedAt: true, outcome: { select: { id: true } } },
  })
  if (!session) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })
  // ⚠️ 実施していない商談に架空の判定を作らせない（/re-evaluate と同じ条件）
  if (!session.startedAt) {
    return NextResponse.json({ error: 'この商談はまだ実施されていません。' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (VERDICTS.includes(body?.verdict)) data.verdict = body.verdict
  if (Number.isFinite(Number(body?.fitScore))) {
    data.fitScore = Math.max(0, Math.min(100, Math.round(Number(body.fitScore))))
  }
  if (typeof body?.nextAction === 'string') data.nextAction = body.nextAction.slice(0, 800)
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })

  // 誰がいつ上書きしたかを残す。スコアの妥当性を後から検証するために要る
  data.overriddenBy = ctx.userId
  data.overriddenAt = new Date()

  // ------------------------------------------------------------------
  // 判定がまだ無い商談にも、人が手で判定を入れられるようにする
  // ------------------------------------------------------------------
  // ⚠️ 以前は outcome が無いと 400 で拒否していた。評価の生成に失敗した商談
  //    （モデルID廃止・JSONパース失敗など実際に起きる）は、再評価する手段も
  //    手で判定を入れる手段も無く、本物の見込み客のデータが一覧の中で
  //    永久に判定不能のまま放置される状態だった。
  if (!session.outcome) {
    if (!data.verdict || !Number.isFinite(Number(data.fitScore))) {
      return NextResponse.json(
        { error: 'この商談はまだ判定がありません。判定と適合度をご指定ください。' },
        { status: 400 }
      )
    }
    const created = await prisma.aishodanOutcome.create({
      data: {
        sessionId: session.id,
        fitScore: Number(data.fitScore),
        verdict: String(data.verdict),
        reason: '自動判定が生成できなかったため、担当者が入力しました。',
        nextAction: (data.nextAction as string) || null,
        overriddenBy: ctx.userId,
        overriddenAt: new Date(),
      },
    })
    return NextResponse.json({ outcome: created })
  }

  const outcome = await prisma.aishodanOutcome.update({ where: { id: session.outcome.id }, data })
  return NextResponse.json({ outcome })
}
