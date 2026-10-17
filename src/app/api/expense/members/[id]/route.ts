export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import { oneOf } from '@/lib/expense/validate'

type Params = { params: Promise<{ id: string }> }

async function target(organizationId: string, id: string) {
  const m = await prisma.expenseMember.findFirst({ where: { id, organizationId, status: 'ACTIVE' } })
  if (!m) throw new ExpenseHttpError(404, 'メンバーが見つかりません')
  return m
}

async function assertOwnerRemains(organizationId: string, excludingId: string) {
  const owners = await prisma.expenseMember.count({ where: { organizationId, status: 'ACTIVE', role: 'owner', id: { not: excludingId } } })
  if (owners === 0) throw new ExpenseHttpError(409, 'オーナーが1人もいなくなるため変更できません')
}

// PATCH /api/expense/members/[id]?org= — 権限の変更（admin 以上。オーナーの付け外しはオーナーだけ）
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await target(ctx.organizationId, id)
    const body = await readJson(req)
    const role = oneOf(body.role, EXPENSE_ROLES, '権限')
    if ((role === 'owner' || m.role === 'owner') && ctx.role !== 'owner') throw new ExpenseHttpError(403, 'オーナー権限の変更はオーナーだけができます')
    if (m.role === 'owner' && role !== 'owner') await assertOwnerRemains(ctx.organizationId, m.id)
    await prisma.expenseMember.update({ where: { id: m.id }, data: { role } })
    await audit(prisma, ctx, 'member.role', 'member', m.id, { from: m.role, to: role })
    return NextResponse.json({ ok: true })
  })
}

// DELETE /api/expense/members/[id]?org= — 組織から外す（admin 以上）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await target(ctx.organizationId, id)
    if (m.role === 'owner') {
      if (ctx.role !== 'owner') throw new ExpenseHttpError(403, 'オーナーを外せるのはオーナーだけです')
      await assertOwnerRemains(ctx.organizationId, m.id)
    }
    await prisma.expenseMember.update({ where: { id: m.id }, data: { status: 'INACTIVE' } })
    await audit(prisma, ctx, 'member.remove', 'member', m.id)
    return NextResponse.json({ ok: true })
  })
}
