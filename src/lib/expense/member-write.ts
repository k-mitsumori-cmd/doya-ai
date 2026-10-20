import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withLifecycleOrganizationWrite } from '@/lib/account-lifecycle/organization-fence'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { EXPENSE_ROLES, type ExpenseRole } from './constants'
import type { ExpenseContext } from './access'

/** All member reads, authorization, last-owner counts, writes and audit use this transaction. */
export async function withExpenseMemberWrite<T>(
  ctx: ExpenseContext,
  targets: { memberIds: string[]; emails: string[]; grantsAuthority: boolean; repairsUnknownTargetRole?: boolean; pendingInvitationRoleChange?: boolean },
  work: (tx: Prisma.TransactionClient, current: ExpenseContext, lockedUserIds: string[]) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const discovered = await prisma.expenseMember.findMany({ where: { id: { in: targets.memberIds }, organizationId: ctx.organizationId }, select: { id: true, userId: true, status: true, invitedEmail: true } })
    if (discovered.length !== new Set(targets.memberIds).size || discovered.some(member => !['ACTIVE', 'PENDING'].includes(member.status))) throw new LifecycleError('LIFECYCLE_TARGET_UNAVAILABLE', 404)
    const pendingRoleEdit = targets.pendingInvitationRoleChange === true && discovered.length > 0 && discovered.every(member => member.status === 'PENDING' && member.userId === null && typeof member.invitedEmail === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(member.invitedEmail.trim()))
    const emails = [...new Set([...targets.emails, ...discovered.flatMap(member => member.status === 'PENDING' && member.invitedEmail ? [member.invitedEmail.trim().toLowerCase()] : [])])]
    try {
      return await withLifecycleOrganizationWrite(prisma, {
        service: 'expense', organizationId: ctx.organizationId, actorUserId: ctx.userId, access: 'member',
        targetMemberIds: targets.memberIds, targetUserIds: [], targetEmails: emails,
        grantsAuthority: targets.grantsAuthority && !pendingRoleEdit, pendingClaimUserId: null,
        repairsUnknownTargetRole: targets.repairsUnknownTargetRole === true,
      }, async (tx, scope) => {
        const actor = scope.memberRows.find(member => member.userId === ctx.userId)
        if (!actor || actor.id !== ctx.memberId || actor.status !== 'ACTIVE' || !['owner', 'admin'].includes(actor.role) || !(EXPENSE_ROLES as readonly string[]).includes(actor.role)) throw new LifecycleError('LIFECYCLE_ACTOR_UNAVAILABLE', 403)
        if (pendingRoleEdit && discovered.some(previous => {
          const locked = scope.memberRows.find(member => member.id === previous.id)
          return !locked || locked.status !== 'PENDING' || locked.userId !== null || locked.pendingEmail?.trim().toLowerCase() !== previous.invitedEmail?.trim().toLowerCase()
        })) throw new LifecycleError('EXPENSE_PENDING_ROLE_REPLAN')
        return work(tx, { ...ctx, role: actor.role as ExpenseRole }, scope.lockedUserIds)
      })
    } catch (error) {
      if (attempt === 3 || !(error instanceof LifecycleError) || error.code !== 'EXPENSE_PENDING_ROLE_REPLAN') throw error
    }
  }
  throw new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
}
