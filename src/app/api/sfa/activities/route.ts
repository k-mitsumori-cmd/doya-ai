export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import type { ActivityType } from '@/lib/sfa/types'
import { lockSfaMutationActor, lockSfaRelation, SfaMutationError } from '@/lib/sfa/mutation-authority'

const json = (body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) =>
  NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })

const ACTIVITY_TYPES: ActivityType[] = ['call', 'meeting', 'email', 'note']
const PAGE_SIZE = 200

// GET /api/sfa/activities — 活動タイムライン（accountId/dealId で絞り込み可）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')?.trim()
  const dealId = url.searchParams.get('dealId')?.trim()
  const rawCursor = url.searchParams.get('cursor') || ''
  if (rawCursor.length > 512) return json({ error: 'ページ指定が正しくありません' }, { status: 400 })

  let cursor: { occurredAt: Date; id: string } | null = null
  if (rawCursor) {
    try {
      const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { occurredAt?: unknown; id?: unknown }
      if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 128) throw new Error('Invalid cursor')
      const occurredAt = new Date(parsed.occurredAt)
      if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== parsed.occurredAt) throw new Error('Invalid date')
      cursor = { occurredAt, id: parsed.id }
    } catch {
      return json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const where: Prisma.SfaActivityWhereInput = {
    organizationId: ctx.organizationId,
    ...(accountId ? { accountId } : {}),
    ...(dealId ? { dealId } : {}),
  }
  const pageWhere: Prisma.SfaActivityWhereInput = cursor ? {
    AND: [where, { OR: [
      { occurredAt: { lt: cursor.occurredAt } },
      { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
    ] }],
  } : where
  const [rows, totalCount] = await Promise.all([
    prisma.sfaActivity.findMany({
      where: pageWhere,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    }),
    prisma.sfaActivity.count({ where }),
  ])
  const activities = rows.slice(0, PAGE_SIZE)
  const last = activities[activities.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last
    ? Buffer.from(JSON.stringify({ occurredAt: last.occurredAt.toISOString(), id: last.id })).toString('base64url')
    : null
  return json({ activities, totalCount, nextCursor }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/activities — 活動を記録（クイック入力）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  if ('type' in body && (typeof body.type !== 'string' || !(ACTIVITY_TYPES as string[]).includes(body.type))) {
    return json({ error: '活動の種類を選び直してください' }, { status: 400 })
  }
  const type: ActivityType = 'type' in body ? body.type as ActivityType : 'note'
  if ((body.subject != null && typeof body.subject !== 'string') || (body.body != null && typeof body.body !== 'string')) {
    return json({ error: '内容の形式が正しくありません' }, { status: 400 })
  }
  const subject = (body.subject as string | undefined)?.trim()
  const bodyText = (body.body as string | undefined)?.trim()
  if (!subject && !bodyText) {
    return json({ error: '内容を入力してください' }, { status: 400 })
  }

  if ((subject?.length || 0) > 200 || (bodyText?.length || 0) > 4000) {
    return json({ error: '件名は200文字以内、本文は4000文字以内で入力してください' }, { status: 400 })
  }

  // Reject an explicitly invalid time instead of recording it as the current time.
  let occurredAt = new Date()
  if ('occurredAt' in body) {
    const value = body.occurredAt
    const format = /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/
    const day = typeof value === 'string' ? value.slice(0, 10) : ''
    const calendarDay = new Date(`${day}T00:00:00.000Z`)
    const parsed = typeof value === 'string' ? new Date(value) : null
    if (typeof value !== 'string' || !format.test(value) || !Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day || !parsed || !Number.isFinite(parsed.getTime())) {
      return json({ error: '活動日時には有効な日付を入力してください' }, { status: 400 })
    }
    occurredAt = parsed
  }

  const relatedFields = [body.accountId, body.dealId, body.contactId]
  if (relatedFields.some((id) => id != null && typeof id !== 'string')) {
    return json({ error: '関連先の指定が正しくありません' }, { status: 400 })
  }
  const requestedAccountId = (body.accountId as string | undefined)?.trim() || null
  const requestedDealId = (body.dealId as string | undefined)?.trim() || null
  const requestedContactId = (body.contactId as string | undefined)?.trim() || null

  try {
    const activity = await prisma.$transaction(async (tx) => {
      await lockSfaMutationActor(tx, ctx)
      // Keep a fixed related-row lock order across activity writes.
      const accountId = requestedAccountId ? await lockSfaRelation(tx, ctx, 'sfaAccount', requestedAccountId) : null
      const dealId = requestedDealId ? await lockSfaRelation(tx, ctx, 'sfaDeal', requestedDealId) : null
      const contactId = requestedContactId ? await lockSfaRelation(tx, ctx, 'sfaContact', requestedContactId) : null
      const created = await tx.sfaActivity.create({
        data: {
          organizationId: ctx.organizationId,
          type,
          subject: subject || null,
          body: bodyText || null,
          accountId,
          dealId,
          contactId,
          occurredAt,
          memberId: ctx.memberId,
        },
      })

      // 条件付き更新により、古い活動や更新順の逆転で最終活動日を戻さない。
      if (dealId) {
        await tx.sfaDeal.updateMany({
          where: {
            id: dealId,
            organizationId: ctx.organizationId,
            OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: occurredAt } }],
          },
          data: { lastActivityAt: occurredAt },
        })
      }
      return created
    })

    return json({ activity })
  } catch (error) {
    return json({ error: error instanceof SfaMutationError ? error.message : '保存結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
  }
}
