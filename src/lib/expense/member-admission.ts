import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { EXPENSE_ROLES, type ExpenseRole } from './constants'
import { canGrantRole } from './member-policy'
import type { ExpenseContext } from './access'
import { pinToolSeatPrincipals, ToolSeatAdmissionError, toolSeatAdmissionFailure, withToolSeatAdmissionInTransaction } from '@/lib/pricing-v2/tool-seat-admission.server'
import { resolveToolUnionScope, toolUnionScopeIdentity } from '@/lib/pricing-v2/tool-seat-union-scope.server'
import { withSeatRevocationInTransaction } from '@/lib/pricing-v2/seat-operation'

type Tx = Prisma.TransactionClient
export type ExpenseClaimIssue = { organizationSlug?: string; organizationName?: string; code: string; message: string; action: 'contact-owner' | 'retry' }
export type ExpenseClaimResult = { claimed: number; issues: ExpenseClaimIssue[] }
class ExpenseAdmissionError extends Error {
  constructor(public readonly status: 403 | 409 | 503, message: string, public readonly code: string, public readonly action: 'contact-owner' | 'retry' = 'retry') { super(message) }
}
const changed = () => new ExpenseAdmissionError(409, '所属や招待の状態が変わりました。もう一度お試しください。', 'EXPENSE_MEMBERSHIP_CHANGED')
const duplicate = () => new ExpenseAdmissionError(409, 'この方は既にメンバーか招待中です。権限はメンバー一覧から変更してください。', 'EXPENSE_MEMBER_EXISTS', 'contact-owner')
const permission = () => new ExpenseAdmissionError(403, 'この操作を行う権限がありません。組織のオーナーに確認を依頼してください。', 'EXPENSE_MEMBER_PERMISSION_REQUIRED', 'contact-owner')
const isRole = (role: string): role is ExpenseRole => (EXPENSE_ROLES as readonly string[]).includes(role)
const normalized = (email: string | null | undefined) => email?.trim().toLowerCase() || null

export function expenseMemberAdmissionFailure(error: unknown) {
  const common = toolSeatAdmissionFailure(error)
  if (common) return common
  if (error instanceof ExpenseAdmissionError) return { status: error.status, body: { error: error.message, code: error.code, action: error.action } }
  return null
}
function retryable(error: unknown) {
  const sql = error as { code?: string; meta?: { code?: string } }
  return sql?.code === 'P2034' || sql?.code === 'P2002' || sql?.code === 'P2010' && ['40001', '40P01'].includes(sql?.meta?.code ?? '') || error instanceof ToolSeatAdmissionError && error.code === 'SEAT_CONTEXT_CHANGED' || error instanceof ExpenseAdmissionError && error.code === 'EXPENSE_MEMBERSHIP_CHANGED'
}
async function retry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await work() } catch (error) { if (!retryable(error)) throw error; if (attempt === 4) throw changed() }
  }
  throw changed()
}
async function pinUsers(tx: Tx, actorUserId: string, otherUserIds: string[] = []) {
  const ids = [...new Set([actorUserId, ...otherUserIds])].sort()
  const rows = await tx.$queryRaw<Array<{ id: string }>>
    `SELECT id FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`
  if (!rows.some(row => row.id === actorUserId)) throw permission()
  if (rows.length !== ids.length) throw changed()
}
async function lockOrg(tx: Tx, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>
    `SELECT id FROM expense_organizations WHERE id = ${organizationId} FOR UPDATE`
  if (rows.length !== 1) throw changed()
}
async function recipientUserId(db: Pick<Tx, 'user'>, email: string): Promise<string | null> {
  const users = await db.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
  if (users.length > 1) throw new ExpenseAdmissionError(503, '招待先のアカウントを確認できません。組織のオーナーに確認を依頼してください。', 'EXPENSE_RECIPIENT_UNAVAILABLE', 'contact-owner')
  return users[0]?.id ?? null
}

/** Registered recipients stay ACTIVE; unknown emails reserve PENDING.
 * Requester authority and recipient identity share the same transaction.
 * Unknown addresses never create a synthetic User/profile/central membership. */
export async function addExpenseMember(ctx: ExpenseContext, input: { email: string; name: string; role: ExpenseRole }): Promise<void> {
  await retry(async () => {
    const recipient = await recipientUserId(prisma, input.email)
    await prisma.$transaction(tx => withToolSeatAdmissionInTransaction({ tool: 'expense', organizationId: ctx.organizationId, actorUserId: ctx.userId, additionalUserIds: recipient ? [recipient] : [] }, tx,
      async currentTx => {
        await pinUsers(currentTx, ctx.userId, recipient ? [recipient] : [])
        if (await recipientUserId(currentTx, input.email) !== recipient) throw changed()
        const hint = await currentTx.expenseMember.findUnique({ where: { id: ctx.memberId } })
        if (!hint || hint.organizationId !== ctx.organizationId || hint.userId !== ctx.userId || hint.status !== 'ACTIVE' || !isRole(hint.role)) throw permission()
        const ceiling = await ceilToolRole({ tool: 'expense', organizationId: ctx.organizationId, userId: ctx.userId, toolRole: hint.role }, currentTx)
        const actorRole = ceiling ? lowerToolRole('expense', ceiling, ctx.role) : null
        if (!actorRole || !isRole(actorRole) || !['owner', 'admin'].includes(actorRole) || !canGrantRole(actorRole, input.role) || input.role === 'owner') throw permission()
        // Company authority is pinned before the domain organization.
        if (recipient) {
          const targetRole = await ceilToolRole({ tool: 'expense', organizationId: ctx.organizationId, userId: recipient, toolRole: input.role }, currentTx)
          if (!targetRole || !isRole(targetRole)) throw new ToolSeatAdmissionError(403, 'OPERATING_ROLE_REQUIRED', 'contact-owner')
        }
        await lockOrg(currentTx, ctx.organizationId)
        const actors = await currentTx.$queryRaw<Array<{ role: string; status: string; userId: string | null }>>
          `SELECT role, status, "userId" FROM expense_members WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`
        if (actors.length !== 1 || actors[0].userId !== ctx.userId || actors[0].status !== 'ACTIVE' || actors[0].role !== hint.role) throw changed()
        const own = recipient ? await currentTx.expenseMember.findUnique({ where: { organizationId_userId: { organizationId: ctx.organizationId, userId: recipient } } }) : null
        const invited = await currentTx.expenseMember.findUnique({ where: { organizationId_invitedEmail: { organizationId: ctx.organizationId, invitedEmail: input.email } } })
        if (own && own.status !== 'INACTIVE' || invited && invited.status !== 'INACTIVE') throw duplicate()
        if (own && invited && own.id !== invited.id) throw new ExpenseAdmissionError(409, 'この方には別の所属記録があります。組織のオーナーに確認を依頼してください。', 'EXPENSE_MEMBERSHIP_CONFLICT', 'contact-owner')
        return { role: input.role, value: { recipient, existing: own ?? invited } }
      }, async (currentTx, domain) => {
        const data = { userId: domain.recipient, invitedEmail: input.email, name: input.name, role: input.role, status: domain.recipient ? 'ACTIVE' : 'PENDING' }
        let memberId: string
        if (domain.existing) {
          const old = domain.existing
          const result = await currentTx.expenseMember.updateMany({ where: { id: old.id, organizationId: ctx.organizationId, userId: old.userId, invitedEmail: old.invitedEmail, role: old.role, status: 'INACTIVE' }, data })
          if (result.count !== 1) throw changed()
          memberId = old.id
        } else memberId = (await currentTx.expenseMember.create({ data: { organizationId: ctx.organizationId, ...data }, select: { id: true } })).id
        await currentTx.expenseAuditLog.create({ data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: 'member.add', targetType: 'member', targetId: memberId, diff: { role: input.role } } })
      }), { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
  })
}

async function claimOneExpenseMembership(userId: string, id: string, organizationId: string): Promise<{ claimed: number; issue?: ExpenseClaimIssue }> {
  const verified: { organization?: { slug: string; name: string } } = {}
  try {
    return await retry(() => prisma.$transaction(async tx => {
      const initial = await resolveToolUnionScope({ tool: 'expense', organizationId }, tx)
      const work = async (): Promise<{ claimed: number }> => {
        if (initial.enabled && 'scope' in initial) {
          await pinToolSeatPrincipals(tx, initial.scope, userId)
          if (toolUnionScopeIdentity(await resolveToolUnionScope({ tool: 'expense', organizationId }, tx)) !== toolUnionScopeIdentity(initial)) throw changed()
        } else await pinUsers(tx, userId)
        const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
        const email = normalized(user?.email)
        if (!email) return { claimed: 0 }
        const hint = await tx.expenseMember.findUnique({ where: { id }, include: { organization: { select: { slug: true, name: true } } } })
        if (!hint || hint.organizationId !== organizationId || hint.status !== 'PENDING' || hint.userId !== null || normalized(hint.invitedEmail) !== email) return { claimed: 0 }
        verified.organization = hint.organization
        const ownHint = await tx.expenseMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { id: true } })
        // Existing membership means cleanup only; otherwise pin role before org.
        if (!ownHint) await ceilToolRole({ tool: 'expense', organizationId, userId, toolRole: 'owner' }, tx)
        await lockOrg(tx, organizationId)
        const current = await tx.expenseMember.findUnique({ where: { id } })
        if (!current || current.organizationId !== organizationId || current.status !== 'PENDING' || current.userId !== null || current.invitedEmail !== hint.invitedEmail || current.role !== hint.role) throw changed()
        const own = await tx.expenseMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { id: true } })
        if (!!own !== !!ownHint || own?.id !== ownHint?.id) throw changed()
        if (own) {
          const result = await tx.expenseMember.updateMany({ where: { id, organizationId, status: 'PENDING', userId: null, invitedEmail: hint.invitedEmail, role: hint.role }, data: { status: 'INACTIVE' } })
          if (result.count !== 1) throw changed()
          return { claimed: 0 }
        }
        if (!isRole(hint.role)) throw permission()
        return withToolSeatAdmissionInTransaction({ tool: 'expense', organizationId, actorUserId: userId }, tx,
          async currentTx => {
            const account = await currentTx.user.findUnique({ where: { id: userId }, select: { email: true } })
            const member = await currentTx.expenseMember.findUnique({ where: { id } })
            if (!member || member.organizationId !== organizationId || member.status !== 'PENDING' || member.userId !== null || member.role !== hint.role || member.invitedEmail !== hint.invitedEmail || normalized(account?.email) !== email) throw changed()
            return { role: member.role, value: member }
          }, async (currentTx, member) => {
            const result = await currentTx.expenseMember.updateMany({ where: { id, organizationId, status: 'PENDING', userId: null, role: member.role, invitedEmail: member.invitedEmail }, data: { userId, status: 'ACTIVE' } })
            if (result.count !== 1) throw changed()
            await currentTx.expenseAuditLog.create({ data: { organizationId, actorUserId: userId, action: 'member.join', targetType: 'member', targetId: id } })
            return { claimed: 1 }
          })
      }
      return initial.enabled && 'scope' in initial ? withSeatRevocationInTransaction(initial.scope.fenceKey, tx, work) : work()
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 }))
  } catch (error) {
    const failure = expenseMemberAdmissionFailure(error)
    if (!failure) throw error
    return { claimed: 0, issue: { ...(verified.organization ? { organizationSlug: verified.organization.slug, organizationName: verified.organization.name } : {}), code: failure.body.code ?? 'EXPENSE_JOIN_UNAVAILABLE', message: failure.body.error, action: failure.body.action === 'contact-owner' || failure.body.action === 'join-company' ? 'contact-owner' : 'retry' } }
  }
}

/** Per-org transactions keep other usable memberships available. Unknown storage
 * errors still fail loudly; only known admission denials become display issues. */
export async function claimExpensePendingMemberships(userId: string): Promise<ExpenseClaimResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const email = normalized(user?.email)
  if (!email) return { claimed: 0, issues: [] }
  const pending = await prisma.expenseMember.findMany({ where: { invitedEmail: email, status: 'PENDING', userId: null }, select: { id: true, organizationId: true }, orderBy: [{ organizationId: 'asc' }, { id: 'asc' }] })
  const result: ExpenseClaimResult = { claimed: 0, issues: [] }
  for (const member of pending) {
    const outcome = await claimOneExpenseMembership(userId, member.id, member.organizationId)
    result.claimed += outcome.claimed
    if (outcome.issue) result.issues.push(outcome.issue)
  }
  return result
}
