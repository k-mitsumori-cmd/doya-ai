export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'

// GET /api/sfa/deals — カンバン用に「ステージ一覧 + 商談一覧（取引先名つき）」を返す
export async function GET() {
  const ctx = await getSfaContext()
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const pipeline = await prisma.sfaPipeline.findFirst({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'asc' },
  })
  const stages = pipeline
    ? await prisma.sfaStage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } })
    : []

  const deals = await prisma.sfaDeal.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })
  // 取引先名を引く
  const accIds = Array.from(new Set(deals.map((d) => d.accountId).filter(Boolean))) as string[]
  const accs = accIds.length
    ? await prisma.sfaAccount.findMany({ where: { id: { in: accIds } }, select: { id: true, name: true } })
    : []
  const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
  const withName = deals.map((d) => ({ ...d, accountName: d.accountId ? accMap[d.accountId] || null : null }))

  return NextResponse.json(
    { stages: bigIntToNumber(stages), deals: bigIntToNumber(withName) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/sfa/deals — 商談作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext()
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: '商談名は必須です' }, { status: 400 })

  // ステージ所有確認（指定が無ければ先頭ステージ）
  let stageId = (body.stageId as string) || null
  let probability = 0
  const stage = stageId
    ? await prisma.sfaStage.findUnique({ where: { id: stageId }, include: { pipeline: true } })
    : await prisma.sfaStage.findFirst({
        where: { pipeline: { organizationId: ctx.organizationId } },
        orderBy: { order: 'asc' },
        include: { pipeline: true },
      })
  if (stage && stage.pipeline.organizationId === ctx.organizationId) {
    stageId = stage.id
    probability = stage.probability
  } else {
    stageId = null
  }

  const amount = Number(body.amount) > 0 ? BigInt(Math.round(Number(body.amount))) : BigInt(0)
  // 取引先所有確認
  let accountId = (body.accountId as string) || null
  if (accountId) {
    const acc = await prisma.sfaAccount.findFirst({ where: { id: accountId, organizationId: ctx.organizationId } })
    if (!acc) accountId = null
  }

  const deal = await prisma.sfaDeal.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      amount,
      stageId,
      probability,
      accountId,
      assigneeMemberId: ctx.memberId,
      status: 'open',
      lastActivityAt: new Date(),
    },
  })
  return NextResponse.json({ deal: bigIntToNumber(deal) })
}
