export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function owned(orgId: string, id: string) {
  const d = await prisma.sfaDeal.findUnique({ where: { id } })
  return d && d.organizationId === orgId ? d : null
}

// GET /api/sfa/deals/[id] — 詳細（明細・活動つき）
export async function GET(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext()
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
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
  const c = await getSfaContext()
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const deal = await owned(c.organizationId, p.id)
  if (!deal) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 200)
  if (body.amount != null && Number(body.amount) >= 0) data.amount = BigInt(Math.round(Number(body.amount)))
  if (typeof body.lostReason === 'string') data.lostReason = body.lostReason.slice(0, 300)

  // ステージ移動（所有確認＋確度同期＋受注/失注ステータス）
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
  const c = await getSfaContext()
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const deal = await owned(c.organizationId, p.id)
  if (!deal) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.sfaDeal.update({ where: { id: deal.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
