export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense, type ExpenseContext } from '@/lib/expense/access'
import { EXPENSE_ROLES, type ExpenseRole } from '@/lib/expense/constants'
import { canGrantRole, canManageMember } from '@/lib/expense/member-policy'
import { oneOf } from '@/lib/expense/validate'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'

type Params = { params: Promise<{ id: string }> }
type Tx = Prisma.TransactionClient
type Change = { kind: 'role'; role: ExpenseRole } | { kind: 'remove' }
const asRole = (r: string): ExpenseRole => ((EXPENSE_ROLES as readonly string[]).includes(r) ? (r as ExpenseRole) : 'owner')
const knownRole = (r: string): r is ExpenseRole => (EXPENSE_ROLES as readonly string[]).includes(r)

async function target(organizationId: string, id: string, db: Pick<Tx, 'expenseMember'> = prisma) {
  const m = await db.expenseMember.findFirst({ where: { id, organizationId, status: { in: ['ACTIVE', 'PENDING'] } } })
  if (!m) throw new ExpenseHttpError(404, 'メンバーが見つかりません')
  return m
}
async function assertOwnerRemains(tx: Tx, organizationId: string, excludingId: string) {
  const owners = await tx.expenseMember.count({ where: { organizationId, status: 'ACTIVE', role: 'owner', id: { not: excludingId } } })
  if (owners === 0) throw new ExpenseHttpError(409, 'オーナーが1人もいなくなるため変更できません')
}
function retryable(error: unknown) {
  const sql = error as { code?: string; meta?: { code?: string } }
  return sql?.code === 'P2034' || sql?.code === 'P2010' && ['40001', '40P01'].includes(sql?.meta?.code ?? '')
}

/** Pin current company authority before domain locks, then serialize all owner
 * decisions on the organization and re-read both actor and target. This fixes
 * authority/last-owner races. Company seat/payer transitions still require their
 * shared admission/revocation coordination; this local invariant is not that gate. */
async function mutateMember(ctx: ExpenseContext, id: string, change: Change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const ceiling = await ceilToolRole({ tool: 'expense', organizationId: ctx.organizationId, userId: ctx.userId, toolRole: 'owner' }, tx)
        if (!ceiling || !knownRole(ceiling)) throw new ExpenseHttpError(403, 'この操作を行う権限がありません')
        const organizations = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM expense_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
        if (organizations.length !== 1) throw new ExpenseHttpError(404, 'メンバーが見つかりません')
        await tx.$queryRaw`SELECT id FROM expense_members WHERE "organizationId" = ${ctx.organizationId} AND id IN (${ctx.memberId}, ${id}) ORDER BY id FOR UPDATE`
        const actor = await tx.expenseMember.findFirst({ where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE' } })
        if (!actor || !knownRole(actor.role)) throw new ExpenseHttpError(403, 'この操作を行う権限がありません')
        const limited = lowerToolRole('expense', actor.role, ceiling)
        const role = limited ? lowerToolRole('expense', limited, ctx.role) : null
        if (role !== 'owner' && role !== 'admin') throw new ExpenseHttpError(403, 'この操作を行う権限がありません')
        const m = await target(ctx.organizationId, id, tx)
        if (!canManageMember(role, asRole(m.role))) throw new ExpenseHttpError(403, change.kind === 'remove' ? '自分と同じか上の権限の人は外せません。オーナーに依頼してください。' : '自分と同じか上の権限の人は変更できません。オーナーに依頼してください。')
        if (change.kind === 'role' && !canGrantRole(role, change.role)) throw new ExpenseHttpError(403, '自分と同じか上の権限は付与できません。オーナーに依頼してください。')
        if (m.role === 'owner' && (change.kind === 'remove' || change.role !== 'owner')) await assertOwnerRemains(tx, ctx.organizationId, m.id)
        const result = await tx.expenseMember.updateMany({ where: { id: m.id, organizationId: ctx.organizationId, userId: m.userId, role: m.role, status: m.status }, data: change.kind === 'role' ? { role: change.role } : { status: 'INACTIVE' } })
        if (result.count !== 1) throw new ExpenseHttpError(409, 'メンバーの状態が変わりました。再読み込みしてください')
        if (change.kind === 'role') await audit(tx, ctx, 'member.role', 'member', m.id, { from: m.role, to: change.role })
        else await audit(tx, ctx, m.status === 'PENDING' ? 'member.invite_cancel' : 'member.remove', 'member', m.id)
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if (!retryable(error)) throw error
      if (attempt === 4) throw new ExpenseHttpError(409, 'メンバーの状態が変わりました。再読み込みしてください')
    }
  }
}

/** PATCH changes a role; unknown target roles stay owner-protected. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async ctx => {
    const { id } = await params
    await target(ctx.organizationId, id)
    const body = await readJson(req)
    const role = oneOf(body.role, EXPENSE_ROLES, '権限')
    await mutateMember(ctx, id, { kind: 'role', role })
    return NextResponse.json({ ok: true })
  })
}

/** DELETE deactivates a member or cancels a pending invitation. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async ctx => {
    const { id } = await params
    await target(ctx.organizationId, id)
    await mutateMember(ctx, id, { kind: 'remove' })
    return NextResponse.json({ ok: true })
  })
}
