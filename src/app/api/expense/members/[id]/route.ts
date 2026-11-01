export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES, type ExpenseRole } from '@/lib/expense/constants'
import { canGrantRole, canManageMember } from '@/lib/expense/member-policy'
import { oneOf } from '@/lib/expense/validate'

type Params = { params: Promise<{ id: string }> }

async function target(organizationId: string, id: string) {
  const m = await prisma.expenseMember.findFirst({ where: { id, organizationId, status: { in: ['ACTIVE', 'PENDING'] } } })
  if (!m) throw new ExpenseHttpError(404, 'メンバーが見つかりません')
  return m
}

const asRole = (r: string): ExpenseRole => ((EXPENSE_ROLES as readonly string[]).includes(r) ? (r as ExpenseRole) : 'owner')

async function assertOwnerRemains(organizationId: string, excludingId: string) {
  const owners = await prisma.expenseMember.count({ where: { organizationId, status: 'ACTIVE', role: 'owner', id: { not: excludingId } } })
  if (owners === 0) throw new ExpenseHttpError(409, 'オーナーが1人もいなくなるため変更できません')
}

/**
 * PATCH /api/expense/members/[id]?org= — 権限の変更（admin 以上）
 * owner でない人は、自分と同じか上のロールの人を変えられず、自分と同じか上のロールを付与できない（EXP-F02）。
 * 最後のオーナーは降格できない。
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await target(ctx.organizationId, id)
    const body = await readJson(req)
    const role = oneOf(body.role, EXPENSE_ROLES, '権限')
    // 未知のロールが入っていた行は owner 扱いにして、owner 以外には触らせない
    if (!canManageMember(ctx.role, asRole(m.role))) throw new ExpenseHttpError(403, '自分と同じか上の権限の人は変更できません。オーナーに依頼してください。')
    if (!canGrantRole(ctx.role, role)) throw new ExpenseHttpError(403, '自分と同じか上の権限は付与できません。オーナーに依頼してください。')
    if (m.role === 'owner' && role !== 'owner') await assertOwnerRemains(ctx.organizationId, m.id)
    await prisma.expenseMember.update({ where: { id: m.id }, data: { role } })
    await audit(prisma, ctx, 'member.role', 'member', m.id, { from: m.role, to: role })
    return NextResponse.json({ ok: true })
  })
}

// DELETE /api/expense/members/[id]?org= — 組織から外す・招待を取り消す（admin 以上。自分と同じか上の権限の人は owner だけが外せる）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await target(ctx.organizationId, id)
    if (!canManageMember(ctx.role, asRole(m.role))) throw new ExpenseHttpError(403, '自分と同じか上の権限の人は外せません。オーナーに依頼してください。')
    if (m.role === 'owner') await assertOwnerRemains(ctx.organizationId, m.id)
    await prisma.expenseMember.update({ where: { id: m.id }, data: { status: 'INACTIVE' } })
    await audit(prisma, ctx, m.status === 'PENDING' ? 'member.invite_cancel' : 'member.remove', 'member', m.id)
    return NextResponse.json({ ok: true })
  })
}
