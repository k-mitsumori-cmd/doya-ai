export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom, ensurePipeline } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { parseSfaAmount } from '@/lib/sfa/amount'
import { recordServiceUsage } from '@/lib/service-usage'
import { sfaQuotaResponse, withSfaAdmission } from '@/lib/sfa/limits'

// GET /api/sfa/deals — カンバン用に「ステージ一覧 + 商談一覧（取引先名つき）」を返す
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const pageSize = 100
  const rawCursor = new URL(req.url).searchParams.get('cursor')
  let cursor: { updatedAt: Date; id: string } | null = null
  if (rawCursor) {
    try {
      if (rawCursor.length > 512) throw new Error('Cursor is too long')
      const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { updatedAt?: unknown; id?: unknown }
      if (typeof decoded.updatedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) {
        throw new Error('Invalid cursor')
      }
      const updatedAt = new Date(decoded.updatedAt)
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== decoded.updatedAt) throw new Error('Invalid date')
      cursor = { updatedAt, id: decoded.id }
    } catch {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const where: Prisma.SfaDealWhereInput = { organizationId: ctx.organizationId, isActive: true }
  if (cursor) {
    where.OR = [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
    ]
  }

  // パイプライン未生成の組織でも必ずステージが返る（カンバンが空にならない）
  const [stages, page, stageGroups] = await Promise.all([
    ensurePipeline(ctx.organizationId),
    prisma.sfaDeal.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: pageSize + 1 }),
    prisma.sfaDeal.groupBy({
      by: ['stageId'],
      where: { organizationId: ctx.organizationId, isActive: true },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ])
  const hasMore = page.length > pageSize
  const deals = page.slice(0, pageSize)
  // 取引先名を引く
  const accIds = Array.from(new Set(deals.map((d) => d.accountId).filter(Boolean))) as string[]
  const [accs, taskGroups] = await Promise.all([
    accIds.length
      ? prisma.sfaAccount.findMany({ where: { id: { in: accIds }, organizationId: ctx.organizationId }, select: { id: true, name: true } })
      : Promise.resolve([]),
    deals.length
      ? prisma.sfaTask.groupBy({
          by: ['dealId'],
          where: { organizationId: ctx.organizationId, dealId: { in: deals.map((d) => d.id) }, status: { not: 'done' } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ])
  const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
  const taskCount = new Map(taskGroups.map((row) => [row.dealId, row._count._all]))
  const withName = deals.map((d) => ({
    ...d,
    accountName: d.accountId ? accMap[d.accountId] || null : null,
    openTaskCount: taskCount.get(d.id) || 0,
  }))

  return NextResponse.json(
    {
      stages: bigIntToNumber(stages),
      deals: bigIntToNumber(withName),
      nextCursor: hasMore && deals.length
        ? Buffer.from(JSON.stringify({ updatedAt: deals[deals.length - 1].updatedAt.toISOString(), id: deals[deals.length - 1].id })).toString('base64url')
        : null,
      totalCount: stageGroups.reduce((sum, row) => sum + row._count._all, 0),
      stageSummary: stageGroups.map((row) => ({ stageId: row.stageId, count: row._count._all, total: (row._sum.amount ?? 0n).toString() })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/sfa/deals — 商談作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: '商談名は必須です' }, { status: 400 })
  if (body.stageId != null && typeof body.stageId !== 'string') {
    return NextResponse.json({ error: 'ステージの指定が正しくありません' }, { status: 400 })
  }
  if (body.accountId != null && typeof body.accountId !== 'string') {
    return NextResponse.json({ error: '取引先の指定が正しくありません' }, { status: 400 })
  }
  const amount = body.amount === undefined || body.amount === '' ? 0n : parseSfaAmount(body.amount)
  if (amount === null) return NextResponse.json({ error: '金額は0以上の有効な数値で入力してください' }, { status: 400 })

  // ステージ所有確認（指定が無ければ先頭ステージ）
  let stageId = (body.stageId as string | undefined)?.trim() || null
  let probability = 0
  let status: 'open' | 'won' | 'lost' = 'open'
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
    status = stage.isWon ? 'won' : stage.isLost ? 'lost' : 'open'
  } else {
    if (stageId) return NextResponse.json({ error: '不正なステージです' }, { status: 400 })
    stageId = null
  }

  // 取引先所有確認
  const accountId = typeof body.accountId === 'string' ? body.accountId.trim() || null : null
  if (accountId) {
    const acc = await prisma.sfaAccount.findFirst({ where: { id: accountId, organizationId: ctx.organizationId, isActive: true }, select: { id: true } })
    if (!acc) return NextResponse.json({ error: '選択した取引先が見つかりません。再読み込みして選び直してください。' }, { status: 400 })
  }

  // 商談日（開始日）。未指定なら作成日を起点にする
  let startDate = new Date()
  if (body.startDate != null && body.startDate !== '') {
    if (typeof body.startDate !== 'string') return NextResponse.json({ error: '商談日が正しくありません' }, { status: 400 })
    const day = body.startDate.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0]
    const parsedDay = day ? new Date(`${day}T00:00:00.000Z`) : null
    const parsedDate = new Date(body.startDate)
    if (!parsedDay || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day || Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: '商談日が正しくありません' }, { status: 400 })
    }
    startDate = parsedDate
  }

  const now = new Date()
  const admitted = await withSfaAdmission(ctx.organizationId, { deals: 1 }, (tx) => tx.sfaDeal.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      amount,
      stageId,
      probability,
      accountId,
      assigneeMemberId: ctx.memberId,
      status,
      wonAt: status === 'won' ? now : null,
      lostAt: status === 'lost' ? now : null,
      startDate,
      lastActivityAt: now,
    },
  }))
  if (admitted.limit) return sfaQuotaResponse(admitted.limit, ctx.role === 'owner')
  const deal = admitted.created
  await recordServiceUsage({
    userId: ctx.userId,
    serviceId: 'sfa',
    action: '商談作成',
    summary: name,
    metadata: { organizationId: ctx.organizationId },
  })

  return NextResponse.json({ deal: bigIntToNumber(deal) })
}
