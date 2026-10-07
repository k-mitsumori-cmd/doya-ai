export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { leadInput } from '@/lib/sfa/lead-mutation'
import { createSfaOnce, recoverSfaCreation, cancelSfaCreation, sfaOperationId } from '@/lib/sfa/creation-receipt'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { withSfaAdmission } from '@/lib/sfa/limits'
import type { LeadStatus } from '@/lib/sfa/types'

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'private, no-store'); headers.set('Vary', 'Cookie')
  return NextResponse.json(body, { ...init, headers })
}

const LEAD_STATUSES: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']

// GET /api/sfa/leads — リード一覧（status/q フィルタ）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  if (url.searchParams.has('operationId')) return recoverLead(req, ctx, false)
  const status = url.searchParams.get('status')?.trim() || ''
  const q = url.searchParams.get('q')?.trim() || ''
  const rawCursor = url.searchParams.get('cursor') || ''
  if ((status && !(LEAD_STATUSES as string[]).includes(status)) || q.length > 100 || rawCursor.length > 512) {
    return json({ error: '検索条件が正しくありません' }, { status: 400 })
  }

  let cursor: { score: number | null; updatedAt: Date; id: string } | null = null
  if (rawCursor) {
    try {
      const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { score?: unknown; updatedAt?: unknown; id?: unknown }
      if ((decoded.score !== null && (typeof decoded.score !== 'number' || !Number.isSafeInteger(decoded.score))) ||
        typeof decoded.updatedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) throw new Error('Invalid cursor')
      const updatedAt = new Date(decoded.updatedAt)
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== decoded.updatedAt) throw new Error('Invalid date')
      cursor = { score: decoded.score, updatedAt, id: decoded.id }
    } catch {
      return json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const where: Prisma.SfaLeadWhereInput = {
    organizationId: ctx.organizationId,
    isActive: true,
    ...(status ? { status } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const afterCursor: Prisma.SfaLeadWhereInput | null = cursor
    ? cursor.score === null
      ? { score: null, OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ] }
      : { OR: [
        { score: { lt: cursor.score } },
        { score: cursor.score, updatedAt: { lt: cursor.updatedAt } },
        { score: cursor.score, updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
        { score: null },
      ] }
    : null
  const pageWhere: Prisma.SfaLeadWhereInput = afterCursor ? { AND: [where, afterCursor] } : where
  const [rows, totalCount] = await Promise.all([
    prisma.sfaLead.findMany({
      where: pageWhere,
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: 201,
    }),
    prisma.sfaLead.count({ where }),
  ])
  const leads = rows.slice(0, 200)
  const last = leads[leads.length - 1]
  return json({
    leads: bigIntToNumber(leads),
    totalCount,
    nextCursor: rows.length > 200 && last
      ? Buffer.from(JSON.stringify({ score: last.score, updatedAt: last.updatedAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/leads — authority, business row and durable receipt commit together.
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  try {
    const { body, data } = leadInput(await req.json().catch(() => null), true)
    const operationId = sfaOperationId(body.operationId)
    const result = await withSfaAdmission(ctx.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, ctx)
      return createSfaOnce(tx, ctx, 'lead', operationId, data,
        id => tx.sfaLead.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } }),
        () => tx.sfaLead.create({ data: { ...data, name: data.name!, organizationId: ctx.organizationId, assigneeMemberId: ctx.memberId, status: 'new' } }),
        { retrySerializableRace: true })
    })
    if (result.limit) throw new Error('Unexpected lead admission limit')
    return json({ lead: bigIntToNumber(result.created) })
  } catch (error) { return leadError(error) }
}
function leadError(error: unknown) {
  return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
}
async function recoverLead(req: NextRequest, ctx: NonNullable<Awaited<ReturnType<typeof getSfaContext>>>, cancel: boolean) {
  try {
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報を指定してください。')
    const operationId = sfaOperationId(operations[0])!
    const result = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, ctx)
      const find = (id: string) => tx.sfaLead.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } })
      return cancel ? cancelSfaCreation(tx, ctx, 'lead', operationId, find) : recoverSfaCreation(tx, ctx, 'lead', operationId, find)
    })
    return json(bigIntToNumber({ state: result.state, lead: result.row }))
  } catch (error) { return leadError(error) }
}
// Only fences an uncommitted creation. Never deletes a business lead.
export async function DELETE(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  return recoverLead(req, ctx, true)
}
