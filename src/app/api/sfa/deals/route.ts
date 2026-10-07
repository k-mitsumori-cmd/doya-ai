export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom, ensurePipeline } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { dealBody, lockDealStage, dealStageChange } from '@/lib/sfa/deal-mutation'
import { createSfaOnce, recoverSfaCreation, cancelSfaCreation, sfaOperationId } from '@/lib/sfa/creation-receipt'
import { lockSfaMutationActor, lockSfaRelation, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { recordServiceUsage } from '@/lib/service-usage'
import { canManageSfaBilling, sfaQuotaResponse, withSfaAdmission, checkSfaQuota, type SfaQuotaExceeded } from '@/lib/sfa/limits'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
class DealQuotaError extends Error { constructor(readonly limit: SfaQuotaExceeded, readonly billing: boolean) { super('Deal quota exceeded') } }

// GET /api/sfa/deals — カンバン用に「ステージ一覧 + 商談一覧（取引先名つき）」を返す
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)

  const operations = new URL(req.url).searchParams.getAll('operationId')
  if (operations.length) {
    try {
      if (operations.length !== 1) throw new SfaMutationError(400, '操作情報が重複しています。')
      const operationId = sfaOperationId(operations[0])!
      const recovery = await prisma.$transaction(async tx => {
        await lockSfaMutationActor(tx, ctx)
        return recoverSfaCreation(tx, ctx, 'deal', operationId, id => tx.sfaDeal.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } }))
      })
      return json(bigIntToNumber({ state: recovery.state, deal: recovery.row }))
    } catch (error) { return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。' }, error instanceof SfaMutationError ? error.status : 500) }
  }

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
      return json({ error: 'ページ指定が正しくありません' }, 400)
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
    { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } }
  )
}

// POST /api/sfa/deals — actor authority, replay receipt and quota are committed together.
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
  try {
    const { body, data } = dealBody(await req.json().catch(() => null), true)
    const operationId = sfaOperationId(body.operationId)
    const admitted = await withSfaAdmission(ctx.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, ctx)
      let created = false
      const deal = await createSfaOnce(tx, ctx, 'deal', operationId,
        { name: data.name, amount: data.amount!.toString(), accountId: data.accountId || null, stageId: data.stageId || null, startDate: data.startDate?.toISOString() || null },
        id => tx.sfaDeal.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } }), async () => {
          // Replays are resolved before quota: a full organization may still recover its committed creation.
          const limit = await checkSfaQuota(tx, ctx.organizationId, { deals: 1 })
          if (limit) throw new DealQuotaError(limit, await canManageSfaBilling(tx, ctx.organizationId, ctx.userId))
          const accountId = data.accountId ? await lockSfaRelation(tx, ctx, 'sfaAccount', data.accountId) : null
          const stage = await lockDealStage(tx, ctx, data.stageId || null)
          const now = new Date()
          created = true
          return tx.sfaDeal.create({ data: {
            organizationId: ctx.organizationId, name: data.name!, amount: data.amount!, accountId,
            assigneeMemberId: ctx.memberId, startDate: data.startDate ?? now,
            ...(stage ? dealStageChange(stage) : { stageId: null, probability: 0, status: 'open', wonAt: null, lostAt: null, lastActivityAt: now }),
          } })
        }, { retrySerializableRace: true })
      return { deal, created }
    })
    if (admitted.limit) throw new DealQuotaError(admitted.limit, false)
    if (admitted.created.created) await recordServiceUsage({ userId: ctx.userId, serviceId: 'sfa', action: '商談作成', summary: data.name, metadata: { organizationId: ctx.organizationId } })
    return json({ deal: bigIntToNumber(admitted.created.deal) })
  } catch (error) {
    if (error instanceof DealQuotaError) {
      const response = sfaQuotaResponse(error.limit, error.billing)
      response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Vary', 'Cookie')
      return response
    }
    return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。一覧をご確認ください。' }, error instanceof SfaMutationError ? error.status : 500)
  }
}

// Cancels a missing creation receipt; never deletes an existing business deal.
export async function DELETE(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
  try {
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報が正しくありません。')
    const operationId = sfaOperationId(operations[0])!
    const recovery = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, ctx)
      return cancelSfaCreation(tx, ctx, 'deal', operationId, id => tx.sfaDeal.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } }))
    })
    return json(bigIntToNumber({ state: recovery.state, deal: recovery.row }))
  } catch (error) { return json({ error: error instanceof SfaMutationError ? error.message : '取り消し結果を確認できませんでした。' }, error instanceof SfaMutationError ? error.status : 500) }
}
