export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import type { ActivityType } from '@/lib/sfa/types'

const ACTIVITY_TYPES: ActivityType[] = ['call', 'meeting', 'email', 'note']

// GET /api/sfa/activities — 活動タイムライン（accountId/dealId で絞り込み可）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')?.trim()
  const dealId = url.searchParams.get('dealId')?.trim()

  const activities = await prisma.sfaActivity.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(accountId ? { accountId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ activities }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/activities — 活動を記録（クイック入力）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const type = (ACTIVITY_TYPES as string[]).includes(body.type) ? (body.type as ActivityType) : 'note'
  const subject = (body.subject as string)?.trim()
  const bodyText = (body.body as string)?.trim()
  if (!subject && !bodyText) {
    return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })
  }

  // 関連先の所有確認（IDOR対策）。指定があり、かつ自組織のものだけ紐づける。
  const verifyOwn = async (model: 'sfaAccount' | 'sfaDeal' | 'sfaContact', id?: string) => {
    if (!id) return null
    const row = await (prisma[model] as any).findUnique({ where: { id }, select: { organizationId: true } })
    return row && row.organizationId === ctx.organizationId ? id : null
  }
  const [accountId, dealId, contactId] = await Promise.all([
    verifyOwn('sfaAccount', (body.accountId as string)?.trim()),
    verifyOwn('sfaDeal', (body.dealId as string)?.trim()),
    verifyOwn('sfaContact', (body.contactId as string)?.trim()),
  ])

  let occurredAt = new Date()
  if (typeof body.occurredAt === 'string' && body.occurredAt) {
    const d = new Date(body.occurredAt)
    if (!isNaN(d.getTime())) occurredAt = d
  }

  const activity = await prisma.sfaActivity.create({
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

  // 商談に紐づく活動なら lastActivityAt を更新（停滞判定の起点）
  if (dealId) {
    await prisma.sfaDeal.update({ where: { id: dealId }, data: { lastActivityAt: occurredAt } }).catch(() => {})
  }

  return NextResponse.json({ activity })
}
