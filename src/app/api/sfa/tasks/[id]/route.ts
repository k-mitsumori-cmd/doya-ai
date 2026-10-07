export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'

const json = (body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) =>
  NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/sfa/tasks/[id] — 完了/未完了トグル + 期日/タイトル編集
// 旧画面との互換: 空のJSONオブジェクトのみ完了トグル。status指定は明示値へ更新。
// dueDate / title を渡したときはそのフィールドだけ更新し、status は明示時のみ変更する。
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const p = await ctx.params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: '更新内容が不正です' }, { status: 400 })
  }
  if (Object.keys(body).some((key) => !['title', 'dueDate', 'status'].includes(key))) {
    return json({ error: '更新できない項目が含まれています' }, { status: 400 })
  }
  const data: any = {}
  if ('title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
      return json({ error: 'タイトルは1〜200文字で入力してください' }, { status: 400 })
    }
    data.title = body.title.trim()
  }
  if ('dueDate' in body) {
    if (body.dueDate === '' || body.dueDate === null) {
      data.dueDate = null
    } else {
      const value = body.dueDate
      const prefix = typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0] : undefined
      const day = prefix ? new Date(`${prefix}T00:00:00.000Z`) : null
      const d = typeof value === 'string' ? new Date(value) : null
      if (!day || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== prefix || !d || !Number.isFinite(d.getTime())) {
        return json({ error: '期日には有効な日付を入力してください' }, { status: 400 })
      }
      data.dueDate = d
    }
  }
  if ('status' in body && !['open', 'done'].includes(body.status)) {
    return json({ error: '完了状態が不正です' }, { status: 400 })
  }

  try {
    const updated = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_tasks WHERE id = ${p.id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
      if (!locked.some(row => row.id === p.id)) throw new SfaMutationError(404, 'タスクが見つかりません')
      const task = await tx.sfaTask.findUnique({ where: { id: p.id } })
      if (!task || task.organizationId !== c.organizationId) throw new SfaMutationError(404, 'タスクが見つかりません')
      // 旧画面の空JSONだけはトグル互換を維持。不正入力をトグルへ読み替えない。
      if ('status' in body || Object.keys(body).length === 0) {
        const nextStatus = body.status ?? (task.status === 'done' ? 'open' : 'done')
        if (nextStatus !== task.status) {
          data.status = nextStatus
          data.completedAt = nextStatus === 'done' ? new Date() : null
        }
      }

      const updated = await tx.sfaTask.update({
        where: { id: task.id },
        data,
        select: { id: true, title: true, status: true, dueDate: true, dealId: true, createdAt: true },
      })
      return updated
    })
    return json({ task: updated })
  } catch (error) {
    return json({ error: error instanceof SfaMutationError ? error.message : '更新結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
  }
}

// DELETE /api/sfa/tasks/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const p = await ctx.params

  try {
    await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_tasks WHERE id = ${p.id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
      if (!locked.some(row => row.id === p.id)) throw new SfaMutationError(404, 'タスクが見つかりません')
      const task = await tx.sfaTask.findUnique({ where: { id: p.id } })
      if (!task || task.organizationId !== c.organizationId) throw new SfaMutationError(404, 'タスクが見つかりません')
      await tx.sfaTask.delete({ where: { id: task.id } })
    })
    return json({ ok: true })
  } catch (error) {
    return json({ error: error instanceof SfaMutationError ? error.message : '削除結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
  }
}
