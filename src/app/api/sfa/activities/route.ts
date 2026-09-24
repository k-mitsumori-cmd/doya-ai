export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import type { ActivityType } from '@/lib/sfa/types'

const ACTIVITY_TYPES: ActivityType[] = ['call', 'meeting', 'email', 'note']
const PAGE_SIZE = 200

// GET /api/sfa/activities — 活動タイムライン（accountId/dealId で絞り込み可）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')?.trim()
  const dealId = url.searchParams.get('dealId')?.trim()
  const rawCursor = url.searchParams.get('cursor') || ''
  if (rawCursor.length > 512) return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })

  let cursor: { occurredAt: Date; id: string } | null = null
  if (rawCursor) {
    try {
      const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { occurredAt?: unknown; id?: unknown }
      if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 128) throw new Error('Invalid cursor')
      const occurredAt = new Date(parsed.occurredAt)
      if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== parsed.occurredAt) throw new Error('Invalid date')
      cursor = { occurredAt, id: parsed.id }
    } catch {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
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
  return NextResponse.json({ activities, totalCount, nextCursor }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/activities — 活動を記録（クイック入力）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const parsedBody = await req.json().catch(() => ({}))
  const body = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody) ? parsedBody : {}
  const type = (ACTIVITY_TYPES as string[]).includes(body.type) ? (body.type as ActivityType) : 'note'
  if ((body.subject != null && typeof body.subject !== 'string') || (body.body != null && typeof body.body !== 'string')) {
    return NextResponse.json({ error: '内容の形式が正しくありません' }, { status: 400 })
  }
  const subject = (body.subject as string | undefined)?.trim()
  const bodyText = (body.body as string | undefined)?.trim()
  if (!subject && !bodyText) {
    return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })
  }

  const relatedFields = [body.accountId, body.dealId, body.contactId]
  if (relatedFields.some((id) => id != null && typeof id !== 'string')) {
    return NextResponse.json({ error: '関連先の指定が正しくありません' }, { status: 400 })
  }
  const requestedAccountId = (body.accountId as string | undefined)?.trim() || null
  const requestedDealId = (body.dealId as string | undefined)?.trim() || null
  const requestedContactId = (body.contactId as string | undefined)?.trim() || null

  // 指定された関連先を確認し、無効なIDを黙って外して保存しない。
  const verifyOwn = async (model: 'sfaAccount' | 'sfaDeal' | 'sfaContact', id?: string) => {
    if (!id) return null
    const row = await (prisma[model] as any).findUnique({ where: { id }, select: { organizationId: true, isActive: true } })
    return row && row.organizationId === ctx.organizationId && row.isActive ? id : null
  }
  const [accountId, dealId, contactId] = await Promise.all([
    verifyOwn('sfaAccount', requestedAccountId || undefined),
    verifyOwn('sfaDeal', requestedDealId || undefined),
    verifyOwn('sfaContact', requestedContactId || undefined),
  ])
  if ((requestedAccountId && !accountId) || (requestedDealId && !dealId) || (requestedContactId && !contactId)) {
    return NextResponse.json({ error: '関連先が見つかりません。画面を更新してもう一度お試しください。' }, { status: 400 })
  }

  let occurredAt = new Date()
  if (typeof body.occurredAt === 'string' && body.occurredAt) {
    const d = new Date(body.occurredAt)
    if (!isNaN(d.getTime())) occurredAt = d
  }

  try {
    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.sfaActivity.create({
        data: {
          organizationId: ctx.organizationId,
          type,
          subject: subject?.slice(0, 200) || null,
          body: bodyText?.slice(0, 4000) || null,
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

    return NextResponse.json({ activity })
  } catch {
    return NextResponse.json({ error: '活動を保存できませんでした。もう一度お試しください。' }, { status: 500 })
  }
}
