import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { lockSfaMutationActor, SfaMutationError } from './mutation-authority'
import { makeSfaRecordScope, scopeAllowsSfaAssignment, type SfaRecordScope } from './record-policy'
import type { SfaContext, SfaRole } from './types'

const validRoles = ['owner', 'admin', 'manager', 'member']
const forbidden = () => new SfaMutationError(403, '操作権限を確認できません。画面を再読み込みしてください。')

/**
 * Lock order: organization, actor membership, business rows.
 * Team changes and membership mutations must use withSfaScopeManagement.
 * Shared organization locks allow concurrent record operations while their team scope stays stable.
 */
export async function lockSfaRecordScope(tx: Prisma.TransactionClient, ctx: SfaContext, manage = false, changeRecordAccess = false): Promise<SfaRecordScope> {
  if (!ctx.organizationId || !ctx.memberId || !ctx.userId) throw forbidden()
  const organizations = manage || changeRecordAccess
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_organizations WHERE id = ${ctx.organizationId} FOR SHARE`
  if (!organizations.some(row => row.id === ctx.organizationId)) throw forbidden()
  await lockSfaMutationActor(tx, ctx)
  const actor = await tx.sfaMember.findFirst({
    where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: validRoles } },
    select: { role: true },
  })
  if (!actor) throw forbidden()
  const role = await ceilToolRole({ tool: 'sfa', userId: ctx.userId, organizationId: ctx.organizationId, toolRole: actor.role })
  if (!role || !validRoles.includes(role)) throw forbidden()
  const fresh = { ...ctx, role: role as SfaRole }
  if (manage && role !== 'admin' && role !== 'owner') throw forbidden()
  if (role !== 'manager') return makeSfaRecordScope(fresh)

  const ownTeams = await tx.sfaTeamMember.findMany({
    where: { organizationId: ctx.organizationId, memberId: ctx.memberId }, select: { teamId: true },
  })
  if (!ownTeams.length) return makeSfaRecordScope(fresh)
  const peers = await tx.sfaTeamMember.findMany({
    where: {
      organizationId: ctx.organizationId,
      teamId: { in: ownTeams.map(team => team.teamId) },
      member: { organizationId: ctx.organizationId, status: 'ACTIVE', role: { in: validRoles } },
    },
    select: { memberId: true },
  })
  return makeSfaRecordScope(fresh, peers.map(peer => peer.memberId))
}

/** Read the actor, team scope, records, names and counts in the same authority transaction. */
export function withSfaRecordRead<T>(ctx: SfaContext, read: (tx: Prisma.TransactionClient, scope: SfaRecordScope) => Promise<T>) {
  return prisma.$transaction(async tx => read(tx, await lockSfaRecordScope(tx, ctx)), {
    isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000,
  })
}

/**
 * ACL writers lock and update the organization row before changing membership/team access.
 * The actual row update also invalidates an older Serializable admission snapshot:
 * a lock alone would leave that transaction able to read already-revoked team membership.
 */
export function withSfaScopeManagement<T>(ctx: SfaContext, mutate: (tx: Prisma.TransactionClient, scope: SfaRecordScope) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const scope = await lockSfaRecordScope(tx, ctx, true)
    await tx.sfaOrganization.update({ where: { id: ctx.organizationId }, data: { updatedAt: new Date() } })
    return mutate(tx, scope)
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}

/** Check both the actor's assignment range and the current target membership before a write. */
export async function lockSfaAssignee(tx: Prisma.TransactionClient, scope: SfaRecordScope, targetId: string | null): Promise<string | null> {
  if (targetId === null) {
    if (scope.actor.role === 'member') throw forbidden()
    return null
  }
  if (!scopeAllowsSfaAssignment(scope, targetId)) throw forbidden()
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_members WHERE id = ${targetId} AND "organizationId" = ${scope.actor.organizationId} FOR SHARE`
  if (!rows.some(row => row.id === targetId)) throw forbidden()
  const target = await tx.sfaMember.findFirst({
    where: { id: targetId, organizationId: scope.actor.organizationId, status: 'ACTIVE', role: { in: validRoles } }, select: { id: true },
  })
  if (!target) throw forbidden()
  return target.id
}

/** Assignment/sharing writers use the same organization barrier as team and role changes. */
export function withSfaRecordAccessChange<T>(ctx: SfaContext, mutate: (tx: Prisma.TransactionClient, scope: SfaRecordScope) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const scope = await lockSfaRecordScope(tx, ctx, false, true)
    const result = await mutate(tx, scope)
    await tx.sfaOrganization.update({ where: { id: ctx.organizationId }, data: { updatedAt: new Date() } })
    return result
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}
