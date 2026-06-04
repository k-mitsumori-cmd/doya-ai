export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

// GET /api/sfa/tasks — タスク一覧（未完了を上に、期日昇順）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const tasks = await prisma.sfaTask.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: { id: true, title: true, status: true, dueDate: true, createdAt: true },
  })
  return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/tasks — タスク追加
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

  const task = await prisma.sfaTask.create({
    data: { organizationId: ctx.organizationId, title: title.slice(0, 200), dueDate, assigneeMemberId: ctx.memberId },
    select: { id: true, title: true, status: true, dueDate: true, createdAt: true },
  })
  return NextResponse.json({ task })
}
