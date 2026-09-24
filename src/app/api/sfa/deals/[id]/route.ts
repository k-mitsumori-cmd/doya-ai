export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { parseSfaAmount } from '@/lib/sfa/amount'

type Ctx = { params: Promise<{ id: string }> }

async function owned(orgId: string, id: string) {
  const d = await prisma.sfaDeal.findUnique({ where: { id } })
  return d && d.organizationId === orgId ? d : null
}

// GET /api/sfa/deals/[id] — 詳細（明細・活動つき）
export async function GET(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const deal = await owned(c.organizationId, p.id)
  if (!deal) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const [lineItems, activities, account, stages] = await Promise.all([
    prisma.sfaLineItem.findMany({ where: { dealId: deal.id } }),
    prisma.sfaActivity.findMany({ where: { organizationId: c.organizationId, dealId: deal.id }, orderBy: { occurredAt: 'desc' }, take: 50 }),
    deal.accountId ? prisma.sfaAccount.findFirst({ where: { id: deal.accountId, organizationId: c.organizationId }, select: { id: true, name: true } }) : null,
    prisma.sfaStage.findMany({ where: { pipeline: { organizationId: c.organizationId } }, orderBy: { order: 'asc' } }),
  ])
  return NextResponse.json(
    { deal: bigIntToNumber({ ...deal, account, lineItems, activities }), stages: bigIntToNumber(stages) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// PATCH /api/sfa/deals/[id] — 更新（ステージ移動・金額・受注/失注 等）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const deal = await owned(c.organizationId, p.id)
  if (!deal) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '更新内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const data: any = {}
  if (body.name != null && (typeof body.name !== 'string' || !body.name.trim())) {
    return NextResponse.json({ error: '商談名は必須です' }, { status: 400 })
  }
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 200)
  if ('amount' in body) {
    const amount = parseSfaAmount(body.amount)
    if (amount === null) return NextResponse.json({ error: '金額は0以上の有効な数値で入力してください' }, { status: 400 })
    data.amount = amount
  }
  if (typeof body.lostReason === 'string') data.lostReason = body.lostReason.slice(0, 300)
  if (typeof body.contactName === 'string') data.contactName = body.contactName.trim().slice(0, 100) || null
  if (typeof body.note === 'string') data.note = body.note.slice(0, 5000) || null
  if (body.probability != null) {
    const probability = Number(body.probability)
    if ((typeof body.probability !== 'number' && typeof body.probability !== 'string') || !Number.isFinite(probability)) {
      return NextResponse.json({ error: '確度が正しくありません' }, { status: 400 })
    }
    data.probability = Math.max(0, Math.min(100, Math.round(probability)))
  }
  // 日付系（'' はクリア）
  for (const key of ['startDate', 'expectedCloseDate'] as const) {
    if (body[key] != null && typeof body[key] !== 'string') {
      return NextResponse.json({ error: '日付が正しくありません' }, { status: 400 })
    }
    if (typeof body[key] === 'string') {
      if (body[key] === '') {
        data[key] = null
      } else {
        const day = body[key].match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0]
        const parsedDay = day ? new Date(`${day}T00:00:00.000Z`) : null
        const parsedDate = new Date(body[key])
        if (!parsedDay || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day || Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json({ error: '日付が正しくありません' }, { status: 400 })
        }
        data[key] = parsedDate
      }
    }
  }
  // 取引先変更（IDOR対策: 自組織のみ。'' で解除）
  if (body.accountId != null && typeof body.accountId !== 'string') {
    return NextResponse.json({ error: '取引先の指定が正しくありません' }, { status: 400 })
  }
  if (typeof body.accountId === 'string') {
    if (body.accountId === '') {
      data.accountId = null
    } else {
      const acc = await prisma.sfaAccount.findFirst({
        where: { id: body.accountId, organizationId: c.organizationId, isActive: true },
        select: { id: true },
      })
      if (!acc) return NextResponse.json({ error: '選択した取引先が見つかりません。再読み込みして選び直してください。' }, { status: 400 })
      data.accountId = acc.id
    }
  }

  // ステージ移動（所有確認＋確度同期＋受注/失注ステータス）
  if (body.stageId != null && typeof body.stageId !== 'string') {
    return NextResponse.json({ error: 'ステージの指定が正しくありません' }, { status: 400 })
  }
  if (typeof body.stageId === 'string') {
    const stage = await prisma.sfaStage.findUnique({ where: { id: body.stageId }, include: { pipeline: true } })
    if (!stage || stage.pipeline.organizationId !== c.organizationId) {
      return NextResponse.json({ error: '不正なステージです' }, { status: 400 })
    }
    data.stageId = stage.id
    data.probability = stage.probability
    data.lastActivityAt = new Date()
    if (stage.isWon) {
      data.status = 'won'
      data.wonAt = new Date()
    } else if (stage.isLost) {
      data.status = 'lost'
      data.lostAt = new Date()
    } else {
      data.status = 'open'
      data.wonAt = null
      data.lostAt = null
    }
  }

  const updated = await prisma.sfaDeal.update({ where: { id: deal.id }, data })
  return NextResponse.json({ deal: bigIntToNumber(updated) })
}

// DELETE /api/sfa/deals/[id] — 論理削除
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const deal = await owned(c.organizationId, p.id)
  if (!deal) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.sfaDeal.update({ where: { id: deal.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
