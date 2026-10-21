import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertRetirementMembershipWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { IncomeError, hasMinRole, type IncomeContext, type IncomeRole } from './access'

type Tx = Prisma.TransactionClient
type Member = { id: string; userId: string | null; organizationId: string; role: string; status: string }
type Organization = { id: string; slug: string; name: string }
const retryCode = 'LIFECYCLE_PARTICIPANTS_CHANGED'
const changed = () => new LifecycleError(retryCode)
const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 }

function canonical(rows: Member[]): Member {
  const owners = rows.filter(row => row.role === 'owner')
  if (owners.length !== 1 || owners[0].status !== 'ACTIVE' || !owners[0].userId) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
  return owners[0]
}

function actor(rows: Member[], ctx: IncomeContext, minRole: IncomeRole): Member {
  const found = rows.filter(row => row.id === ctx.memberId && row.userId === ctx.userId && row.organizationId === ctx.organizationId)
  if (found.length !== 1 || found[0].status !== 'ACTIVE' || !hasMinRole(found[0].role, minRole)) throw new LifecycleError('LIFECYCLE_ACTOR_UNAVAILABLE', 403)
  return found[0]
}

function signature(org: Organization, rows: Member[]) {
  return JSON.stringify([org, rows.map(row => [row.id, row.userId, row.organizationId, row.role, row.status])])
}

function retryable(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string }; originalCode?: string }
  return e?.code === retryCode || e?.code === 'P2034' || e?.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code || '') || ['40001', '40P01'].includes(e?.code || '')
}
function exhausted(error: unknown): never {
  if ((error as { code?: string })?.code === retryCode) throw error
  throw new IncomeError('同時に別の操作が行われました。もう一度お試しください。', 409)
}

/** One Serializable transaction owns the final authorization, domain write and audit. */
export async function withIncomeWrite<T>(ctx: IncomeContext, minRole: IncomeRole, work: (tx: Tx, locked: IncomeContext) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
    const discovered = await prisma.$transaction(async tx => {
      const org = await tx.incomeOrganization.findUnique({ where: { id: ctx.organizationId }, select: { id: true, slug: true, name: true } })
      if (!org) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
      const rows = await tx.incomeMember.findMany({ where: { organizationId: ctx.organizationId, OR: [{ role: 'owner' }, { id: ctx.memberId }] }, select: { id: true, userId: true, organizationId: true, role: true, status: true }, orderBy: { id: 'asc' } })
      const owner = canonical(rows)
      actor(rows, ctx, minRole)
      return { signature: signature(org, rows), ids: [...new Set([ctx.userId, owner.userId!])].sort() }
    }, options)
      return await prisma.$transaction(async tx => {
        await lockLifecycleUsers(tx, discovered.ids)
        const orgs = await tx.$queryRaw<Organization[]>`SELECT id, slug, name FROM income_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
        if (orgs.length !== 1) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
        const rows = await tx.$queryRaw<Member[]>`SELECT id, "userId", "organizationId", role, status FROM income_members WHERE "organizationId" = ${ctx.organizationId} AND (role = 'owner' OR id = ${ctx.memberId}) ORDER BY id FOR UPDATE`
        if (signature(orgs[0], rows) !== discovered.signature) throw changed()
        const owner = canonical(rows)
        if (![ctx.userId, owner.userId].every(id => id !== null && discovered.ids.includes(id))) throw changed()
        const member = actor(rows, ctx, minRole)
        await assertRetirementMembershipWritable(tx, discovered.ids)
        return work(tx, { ...ctx, memberId: member.id, role: member.role as IncomeRole, organizationSlug: orgs[0].slug, organizationName: orgs[0].name })
      }, options)
    } catch (error) {
      if (!retryable(error)) throw error
      if (attempt === 3) exhausted(error)
    }
  }
  throw changed()
}

/** Authenticated maintenance work has no actor; the canonical owner is a fence participant only. */
export async function withIncomeMaintenanceWrite<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const discovered = await prisma.$transaction(async tx => {
        const org = await tx.incomeOrganization.findUnique({ where: { id: organizationId }, select: { id: true, slug: true, name: true } })
        if (!org) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
        const rows = await tx.incomeMember.findMany({ where: { organizationId, role: 'owner' }, select: { id: true, userId: true, organizationId: true, role: true, status: true }, orderBy: { id: 'asc' } })
        const owner = canonical(rows)
        return { signature: signature(org, rows), ownerId: owner.userId! }
      }, options)
      return await prisma.$transaction(async tx => {
        await lockLifecycleUsers(tx, [discovered.ownerId])
        const orgs = await tx.$queryRaw<Organization[]>`SELECT id, slug, name FROM income_organizations WHERE id = ${organizationId} FOR UPDATE`
        if (orgs.length !== 1) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
        const rows = await tx.$queryRaw<Member[]>`SELECT id, "userId", "organizationId", role, status FROM income_members WHERE "organizationId" = ${organizationId} AND role = 'owner' ORDER BY id FOR UPDATE`
        if (signature(orgs[0], rows) !== discovered.signature || canonical(rows).userId !== discovered.ownerId) throw changed()
        await assertRetirementMembershipWritable(tx, [discovered.ownerId])
        return work(tx)
      }, options)
    } catch (error) {
      if (!retryable(error)) throw error
      if (attempt === 3) exhausted(error)
    }
  }
  throw changed()
}
