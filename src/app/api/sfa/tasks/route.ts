export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

// GET /api/sfa/tasks — タスク一覧（未完了を上に、期日昇順）。商談名も添えて返す
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const page = Number(req.nextUrl?.searchParams.get('page') || '1')
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) {
    return NextResponse.json({ error: 'ページ番号が不正です' }, { status: 400 })
  }
  const pageSize = 200
  const rows = await prisma.sfaTask.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ status: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true },
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

  return NextResponse.json(
    { tasks: tasks.map((t) => ({ ...t, dealName: t.dealId ? dealName.get(t.dealId) || null : null })), page, hasMore: rows.length > pageSize },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/sfa/tasks — タスク追加（dealId で商談に紐付け可能）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const title = (body.title as string)?.trim()
  if (!title) return NextResponse.json({ error: 'タスク名は必須です' }, { status: 400 })

  let dueDate: Date | null = null
  if (typeof body.dueDate === 'string' && body.dueDate) {
    const d = new Date(body.dueDate)
    if (!isNaN(d.getTime())) dueDate = d
  }

  // 商談への紐付け（IDOR対策: 自組織の商談のみ許可）
  let dealId: string | null = null
  if (typeof body.dealId === 'string' && body.dealId) {
    const deal = await prisma.sfaDeal.findFirst({
      where: { id: body.dealId, organizationId: ctx.organizationId },
      select: { id: true },
    })
    if (!deal) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })
    dealId = deal.id
  }

  const task = await prisma.sfaTask.create({
    data: { organizationId: ctx.organizationId, title: title.slice(0, 200), dueDate, dealId, assigneeMemberId: ctx.memberId },
    select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true },
  })
  return NextResponse.json({ task })
}
