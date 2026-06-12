export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// PATCH /api/sfa/tasks/[id] — 完了/未完了トグル + 期日/タイトル編集
// 互換挙動: body が空（または status のみ）のときは従来どおり完了トグルとして動く。
// dueDate / title を渡したときはそのフィールドだけ更新し、status は明示時のみ変更する。
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params

  const task = await prisma.sfaTask.findUnique({ where: { id: p.id } })
  if (!task || task.organizationId !== c.organizationId) {
    return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
  if (typeof body.dueDate === 'string') {
    if (body.dueDate === '') {
      data.dueDate = null
    } else {
      const d = new Date(body.dueDate)
      if (!isNaN(d.getTime())) data.dueDate = d
    }
  }

  const editingFields = Object.keys(data).length > 0
  if (body.status != null || !editingFields) {
    const done = body.status === 'done' || (body.status == null && task.status !== 'done')
    data.status = done ? 'done' : 'open'
    data.completedAt = done ? new Date() : null
  }

  const updated = await prisma.sfaTask.update({
    where: { id: task.id },
    data,
    select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true },
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
