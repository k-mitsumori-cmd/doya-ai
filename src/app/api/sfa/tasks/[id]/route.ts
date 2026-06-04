export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// PATCH /api/sfa/tasks/[id] — 完了/未完了トグル
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params

  const task = await prisma.sfaTask.findUnique({ where: { id: p.id } })
  if (!task || task.organizationId !== c.organizationId) {
    return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const done = body.status === 'done' || (body.status == null && task.status !== 'done')
  const updated = await prisma.sfaTask.update({
    where: { id: task.id },
    data: { status: done ? 'done' : 'open', completedAt: done ? new Date() : null },
    select: { id: true, title: true, status: true, dueDate: true, createdAt: true },
  })
  return NextResponse.json({ task: updated })
}

// DELETE /api/sfa/tasks/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params

  const task = await prisma.sfaTask.findUnique({ where: { id: p.id } })
  if (!task || task.organizationId !== c.organizationId) {
    return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
  }
  await prisma.sfaTask.delete({ where: { id: task.id } })
  return NextResponse.json({ ok: true })
}
