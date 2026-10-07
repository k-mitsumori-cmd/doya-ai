export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { createSfaOnce, recoverSfaCreation, sfaOperationId } from '@/lib/sfa/creation-receipt'
import { lockSfaMutationActor, lockSfaRelation, SfaMutationError } from '@/lib/sfa/mutation-authority'

const json = (body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) =>
  NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })

// GET /api/sfa/tasks — タスク一覧（未完了を上に、期日昇順）。商談名も添えて返す
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const rawOperationId = (req.nextUrl || new URL(req.url)).searchParams.get('operationId')
  if (rawOperationId !== null) {
    try {
      const operationId = sfaOperationId(rawOperationId)!
      const recovery = await prisma.$transaction(async tx => {
        await lockSfaMutationActor(tx, ctx)
        return recoverSfaCreation(tx, ctx, 'task', operationId, id => tx.sfaTask.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true, updatedAt: true } }))
      })
      return json({ state: recovery.state, task: recovery.row })
    } catch (error) {
      return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
    }
  }

  const page = Number(req.nextUrl?.searchParams.get('page') || '1')
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) {
    return json({ error: 'ページ番号が不正です' }, { status: 400 })
  }
  const rawDealId = req.nextUrl?.searchParams.get('dealId')
  const dealId = rawDealId?.trim() || null
  if (rawDealId !== null && rawDealId !== undefined && (!dealId || dealId.length > 128)) {
    return json({ error: '商談の指定が正しくありません' }, { status: 400 })
  }
  const pageSize = 200
  const rows = await prisma.sfaTask.findMany({
    where: { organizationId: ctx.organizationId, ...(dealId ? { dealId } : {}) },
    orderBy: [{ status: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true, updatedAt: true },
  })
  const tasks = rows.slice(0, pageSize)

  // dealId → 商談名（SfaTask に Prisma リレーションは無いため1クエリで引き当て）
  const dealIds = Array.from(new Set(tasks.map((t) => t.dealId).filter((v): v is string => !!v)))
  const deals = dealIds.length
    ? await prisma.sfaDeal.findMany({
        where: { id: { in: dealIds }, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      })
    : []
  const dealName = new Map(deals.map((d) => [d.id, d.name]))

  return json(
    { tasks: tasks.map((t) => ({ ...t, dealName: t.dealId ? dealName.get(t.dealId) || null : null })), page, hasMore: rows.length > pageSize },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/sfa/tasks — タスク追加（dealId で商談に紐付け可能）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 200) return json({ error: 'タスク名は1〜200文字で入力してください' }, { status: 400 })

  let dueDate: Date | null = null
  if (body.dueDate != null && body.dueDate !== '') {
    if (typeof body.dueDate !== 'string') return json({ error: '期日が正しくありません' }, { status: 400 })
    const day = body.dueDate.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0]
    const parsedDay = day ? new Date(`${day}T00:00:00.000Z`) : null
    const parsedDate = new Date(body.dueDate)
    if (!parsedDay || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day || Number.isNaN(parsedDate.getTime())) {
      return json({ error: '期日が正しくありません' }, { status: 400 })
    }
    dueDate = parsedDate
  }

  if (body.dealId != null && typeof body.dealId !== 'string') {
    return json({ error: '商談の指定が正しくありません' }, { status: 400 })
  }
  const requestedDealId = typeof body.dealId === 'string' ? body.dealId.trim() || null : null
  try {
    const operationId = sfaOperationId(body.operationId)
    const task = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, ctx)
      return createSfaOnce(tx, ctx, 'task', operationId,
        { title, dueDate: dueDate?.toISOString() || null, dealId: requestedDealId },
        id => tx.sfaTask.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true, updatedAt: true } }), async () => {
        const dealId = requestedDealId ? await lockSfaRelation(tx, ctx, 'sfaDeal', requestedDealId) : null
        return tx.sfaTask.create({
          data: { organizationId: ctx.organizationId, title, dueDate, dealId, assigneeMemberId: ctx.memberId },
          select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true, updatedAt: true },
        })
      })
    })
    return json({ task })
  } catch (error) {
    return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
  }
}
