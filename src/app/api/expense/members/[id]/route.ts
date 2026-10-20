export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES, type ExpenseRole } from '@/lib/expense/constants'
import { canGrantRole, canManageMember } from '@/lib/expense/member-policy'
import type { Prisma } from '@prisma/client'
import { withExpenseMemberWrite } from '@/lib/expense/member-write'
import { oneOf } from '@/lib/expense/validate'

type Params = { params: Promise<{ id: string }> }

async function target(tx: Prisma.TransactionClient, organizationId: string, id: string) {
  const m = await tx.expenseMember.findFirst({ where: { id, organizationId, status: { in: ['ACTIVE', 'PENDING'] } } })
  if (!m) throw new ExpenseHttpError(404, 'メンバーが見つかりません')
  return m
}

const asRole = (r: string): ExpenseRole => ((EXPENSE_ROLES as readonly string[]).includes(r) ? (r as ExpenseRole) : 'owner')

async function assertOwnerRemains(tx: Prisma.TransactionClient, organizationId: string, excludingId: string) {
  const owners = await tx.expenseMember.count({ where: { organizationId, status: 'ACTIVE', role: 'owner', id: { not: excludingId } } })
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
    const body = await readJson(req)
    const role = oneOf(body.role, EXPENSE_ROLES, '権限')
    return withExpenseMemberWrite(ctx, { memberIds: [id], emails: [], grantsAuthority: true, pendingInvitationRoleChange: true, repairsUnknownTargetRole: ctx.role === 'owner' }, async (tx, current) => {
      const m = await target(tx, current.organizationId, id)
      // 未知のロールが入っていた行は owner 扱いにして、owner 以外には触らせない
      if (!canManageMember(current.role, asRole(m.role))) throw new ExpenseHttpError(403, '自分と同じか上の権限の人は変更できません。オーナーに依頼してください。')
      if (!canGrantRole(current.role, role)) throw new ExpenseHttpError(403, '自分と同じか上の権限は付与できません。オーナーに依頼してください。')
      if (m.role === 'owner' && role !== 'owner') await assertOwnerRemains(tx, current.organizationId, m.id)
      await tx.expenseMember.update({ where: { id: m.id }, data: { role } })
      await audit(tx, current, 'member.role', 'member', m.id, { from: m.role, to: role })
      return NextResponse.json({ ok: true })
    })
  })
}

// DELETE /api/expense/members/[id]?org= — 組織から外す・招待を取り消す（admin 以上。自分と同じか上の権限の人は owner だけが外せる）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    return withExpenseMemberWrite(ctx, { memberIds: [id], emails: [], grantsAuthority: false, repairsUnknownTargetRole: ctx.role === 'owner' }, async (tx, current) => {
      const m = await target(tx, current.organizationId, id)
      if (!canManageMember(current.role, asRole(m.role))) throw new ExpenseHttpError(403, '自分と同じか上の権限の人は外せません。オーナーに依頼してください。')
      if (m.role === 'owner') await assertOwnerRemains(tx, current.organizationId, m.id)
      await tx.expenseMember.update({ where: { id: m.id }, data: { status: 'INACTIVE' } })
      await audit(tx, current, m.status === 'PENDING' ? 'member.invite_cancel' : 'member.remove', 'member', m.id)
      return NextResponse.json({ ok: true })
    })
  })
}
