import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertRetirementMembershipWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'
import {
  assertOwnerTransferIdentity, assertOwnerTransferInput, ownerTransferInputDigest, ownerTransferKey,
  OwnerTransferError, type OwnerTransferIdentity, type OwnerTransferInput, type OwnerTransferService,
} from './types'
import { readOwnerTransferReceipt, type OwnerTransferReceipt } from './receipt'

type Tx = Prisma.TransactionClient
type Member = { id: string; userId: string | null; role: string; status: string; name: string | null }
type Org = { id: string; slug: string; name: string }
const tables: Record<OwnerTransferService, { org: string; member: string }> = {
  shodan: { org: 'shodan_organizations', member: 'shodan_members' },
  aio: { org: 'aio_organizations', member: 'aio_members' },
  quote: { org: 'quote_organizations', member: 'quote_members' },
  mensetsu: { org: 'mensetsu_organizations', member: 'mensetsu_members' },
  aishodan: { org: 'aishodan_organizations', member: 'aishodan_members' },
}
const knownRole = (role: string) => ['owner', 'admin', 'manager', 'member'].includes(role)
const knownPlan = (plan: string) => [
  'GUEST', 'FREE', 'LIGHT', 'LIGHT_MONTHLY', 'BANNER_LIGHT', 'PRO', 'PRO_MONTHLY',
  'BANNER_PRO', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS', 'PREMIUM', 'ENTERPRISE',
  'ENTERPRISE_MONTHLY', 'BANNER_ENTERPRISE',
].includes(plan.trim().toUpperCase().replace(/-/g, '_'))
const options = { isolationLevel: 'Serializable' as const, maxWait: 10000, timeout: 30000 }
const readOptions = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const changed = () => new OwnerTransferError('OWNER_TRANSFER_PARTICIPANTS_CHANGED')
const unavailable = () => new OwnerTransferError('OWNER_TRANSFER_STATE_UNAVAILABLE')
const conflict = () => new OwnerTransferError('OWNER_TRANSFER_CONFIRMATION_CHANGED')
const keyFor = (identity: OwnerTransferIdentity) => ownerTransferKey(identity)
const codepoint = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const sortedUsers = (rows: Member[], actor: string, target?: string) =>
  [...new Set([actor, ...(target ? [target] : []), ...rows.flatMap(row => row.role === 'owner' && row.userId ? [row.userId] : [])])].sort(codepoint)
const signature = (rows: Member[]) => JSON.stringify(rows.map(row => [row.id, row.userId, row.role, row.status, row.name]))

async function organization(db: Tx | PrismaClient, service: OwnerTransferService, orgId: string): Promise<Org | null> {
  const table = Prisma.raw(tables[service].org)
  const rows = await db.$queryRaw<Org[]>(Prisma.sql`SELECT id, slug, name FROM ${table} WHERE id = ${orgId}`)
  return rows.length === 1 ? rows[0] : null
}
async function organizationBySlug(db: Tx | PrismaClient, service: OwnerTransferService, slug: string): Promise<Org | null> {
  const table = Prisma.raw(tables[service].org)
  const rows = await db.$queryRaw<Org[]>(Prisma.sql`SELECT id, slug, name FROM ${table} WHERE slug = ${slug}`)
  return rows.length === 1 ? rows[0] : null
}
async function members(db: Tx | PrismaClient, service: OwnerTransferService, orgId: string): Promise<Member[]> {
  const table = Prisma.raw(tables[service].member)
  return db.$queryRaw<Member[]>(Prisma.sql`SELECT id, "userId", role, status, name FROM ${table}
    WHERE "organizationId" = ${orgId} ORDER BY id`)
}
async function lockOrganization(tx: Tx, service: OwnerTransferService, orgId: string): Promise<boolean> {
  const org = Prisma.raw(tables[service].org), member = Prisma.raw(tables[service].member)
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM ${org} WHERE id = ${orgId} FOR UPDATE`)
  if (rows.length !== 1) return false
  await tx.$queryRaw(Prisma.sql`SELECT id FROM ${member} WHERE "organizationId" = ${orgId} ORDER BY id FOR UPDATE`)
  return true
}
async function lockOperation(tx: Tx, identity: OwnerTransferIdentity) {
  // The advisory value is domain-separated from billing's globally unique UUID lock.
  await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${keyFor(identity)})::bigint)`
}
async function receipt(tx: Tx, identity: OwnerTransferIdentity) {
  const row = await tx.systemSetting.findUnique({ where: { key: keyFor(identity) }, select: { value: true } })
  return row ? readOwnerTransferReceipt(row.value, identity) : null
}
function result(receiptValue: OwnerTransferReceipt) {
  return { actorId: receiptValue.identity.actorUserId, service: receiptValue.identity.service,
    organizationId: receiptValue.identity.organizationId, operationId: receiptValue.identity.operationId,
    phase: receiptValue.phase, input: receiptValue.input, createdAt: receiptValue.createdAt }
}
function retryable(error: unknown) {
  const e = error as { code?: string; meta?: { code?: string } }
  return e?.code === 'P2034' || e?.code === 'OWNER_TRANSFER_PARTICIPANTS_CHANGED' ||
    e?.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code ?? '')
}

/** Read candidates without changing the current owner's authority or the stored operation. */
export async function ownerTransferCandidates(service: OwnerTransferService, orgSlug: string, actorId: string, orgId?: string) {
  const org = await organizationBySlug(prisma, service, orgSlug)
  if (!org || orgId && org.id !== orgId) throw new OwnerTransferError('OWNER_TRANSFER_ORG_UNAVAILABLE', 404)
  const rows = await members(prisma, service, org.id)
  const owners = rows.filter(row => row.role === 'owner')
  if (owners.length !== 1 || owners[0].status !== 'ACTIVE' || owners[0].userId !== actorId) throw new OwnerTransferError('OWNER_TRANSFER_OWNER_REQUIRED', 403)
  await prisma.$transaction(async tx => {
    await lockLifecycleUsers(tx, [actorId])
    await assertRetirementMembershipWritable(tx, [actorId])
  }, options)
  const eligible = rows.filter(row => row.id !== owners[0].id && row.status === 'ACTIVE' && row.userId && knownRole(row.role) && row.role !== 'owner')
  if (eligible.length > 60) throw new OwnerTransferError('OWNER_TRANSFER_CANDIDATES_TOO_MANY', 409)
  const users = await prisma.user.findMany({ where: { id: { in: eligible.map(row => row.userId!) } }, select: { id: true, plan: true } })
  const byId = new Map(users.map(user => [user.id, user.plan]))
  if (eligible.some(row => !knownPlan(byId.get(row.userId!) ?? ''))) throw unavailable()
  const candidates = [] as Array<{ memberId: string; userId: string; name: string | null; role: string; plan: string }>
  for (const row of eligible) {
    try {
      await prisma.$transaction(async tx => {
        await lockLifecycleUsers(tx, [actorId, row.userId!])
        await assertRetirementMembershipWritable(tx, [actorId, row.userId!])
      }, options)
      candidates.push({ memberId: row.id, userId: row.userId!, name: row.name, role: row.role, plan: byId.get(row.userId!)! })
    } catch (error) {
      if ((error as { code?: string }).code !== 'ACCOUNT_RETIREMENT_IN_PROGRESS') throw error
    }
  }
  return { actorId, service, organization: org, owner: { memberId: owners[0].id, userId: actorId },
    candidates }
}

/** A status lookup remains available to the former owner after an exact successful transfer. */
export async function ownerTransferStatus(identity: OwnerTransferIdentity) {
  assertOwnerTransferIdentity(identity)
  const user = await prisma.user.findUnique({ where: { id: identity.actorUserId }, select: { id: true } })
  if (!user) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_UNAVAILABLE', 403)
  const row = await prisma.systemSetting.findUnique({ where: { key: keyFor(identity) }, select: { value: true } })
  return row ? result(readOwnerTransferReceipt(row.value, identity)) : {
    actorId: identity.actorUserId, service: identity.service, organizationId: identity.organizationId,
    operationId: identity.operationId, phase: 'missing' as const, input: null, createdAt: null,
  }
}

/** Missing cancel is a new write; an existing terminal receipt is read without another retirement guard. */
export async function cancelOwnerTransfer(identity: OwnerTransferIdentity, db: PrismaClient = prisma) {
  assertOwnerTransferIdentity(identity)
  return db.$transaction(async tx => {
    await lockLifecycleUsers(tx, [identity.actorUserId])
    await lockOperation(tx, identity)
    const saved = await receipt(tx, identity)
    if (saved) return result(saved)
    await assertRetirementMembershipWritable(tx, [identity.actorUserId])
    const next: OwnerTransferReceipt = { version: 1, identity, input: null, inputDigest: null,
      phase: 'canceled', createdAt: new Date().toISOString() }
    await tx.systemSetting.create({ data: { key: keyFor(identity), value: JSON.stringify(next) } })
    return result(next)
  }, readOptions)
}

/** All relation locks and the two role changes plus receipt belong to one transaction. */
export async function transferOwner(identity: OwnerTransferIdentity, input: OwnerTransferInput, expectedSlug: string, db: PrismaClient = prisma) {
  assertOwnerTransferIdentity(identity)
  assertOwnerTransferInput(input)
  if (!expectedSlug || expectedSlug.length > 160) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_ORG', 400)
  const digest = ownerTransferInputDigest(identity, input)
  // Historical replay cannot depend on the target's current User or membership still existing.
  const terminal = await db.$transaction(async tx => {
    await lockLifecycleUsers(tx, [identity.actorUserId])
    await lockOperation(tx, identity)
    return receipt(tx, identity)
  }, readOptions)
  if (terminal) {
    if (terminal.phase === 'committed' && terminal.inputDigest !== digest) throw new OwnerTransferError('OWNER_TRANSFER_INPUT_CONFLICT')
    return result(terminal)
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const discovered = await members(db, identity.service, identity.organizationId)
    const users = sortedUsers(discovered, identity.actorUserId, input.targetUserId)
    let missingParticipantAtLock = false
    try {
      return await db.$transaction(async tx => {
        try {
          await lockLifecycleUsers(tx, users)
        } catch (error) {
          if ((error as { code?: string }).code === 'LIFECYCLE_USER_UNAVAILABLE') missingParticipantAtLock = true
          throw error
        }
        await lockOperation(tx, identity)
        const saved = await receipt(tx, identity)
        if (saved) {
          if (saved.phase === 'canceled') return result(saved)
          if (saved.inputDigest !== digest) throw new OwnerTransferError('OWNER_TRANSFER_INPUT_CONFLICT')
          return result(saved)
        }
        if (!await lockOrganization(tx, identity.service, identity.organizationId)) throw unavailable()
        const org = await organization(tx, identity.service, identity.organizationId)
        if (!org || org.slug !== expectedSlug) throw conflict()
        const current = await members(tx, identity.service, identity.organizationId)
        if (signature(current) !== signature(discovered)) throw changed()
        const owners = current.filter(row => row.role === 'owner')
        const owner = owners[0]
        const target = current.find(row => row.id === input.targetMemberId)
        if (owners.length !== 1 || !owner || owner.id !== input.expectedOwnerMemberId ||
            owner.userId !== identity.actorUserId || owner.status !== 'ACTIVE' ||
            !target || target.id === owner.id || target.userId !== input.targetUserId ||
            target.status !== 'ACTIVE' || target.role !== input.targetRole || !knownRole(target.role)) throw conflict()
        const targetUser = await tx.user.findUnique({ where: { id: input.targetUserId }, select: { plan: true } })
        if (!targetUser || targetUser.plan !== input.targetPlan || !knownPlan(input.targetPlan)) throw conflict()
        await assertRetirementMembershipWritable(tx, users)
        const table = Prisma.raw(tables[identity.service].member)
        const demoted = await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET role = 'admin', "updatedAt" = NOW()
          WHERE id = ${owner.id} AND "organizationId" = ${identity.organizationId} AND "userId" = ${identity.actorUserId}
          AND role = 'owner' AND status = 'ACTIVE'`)
        if (demoted !== 1) throw changed()
        const promoted = await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET role = 'owner', "updatedAt" = NOW()
          WHERE id = ${target.id} AND "organizationId" = ${identity.organizationId} AND "userId" = ${input.targetUserId}
          AND role = ${input.targetRole} AND status = 'ACTIVE'`)
        if (promoted !== 1) throw changed()
        const next: OwnerTransferReceipt = { version: 1, identity, input, inputDigest: digest,
          phase: 'committed', createdAt: new Date().toISOString() }
        await tx.systemSetting.create({ data: { key: keyFor(identity), value: JSON.stringify(next) } })
        return result(next)
      }, options)
    } catch (error) {
      if (missingParticipantAtLock && (error as { code?: string }).code === 'LIFECYCLE_USER_UNAVAILABLE') {
        // The full transaction has rolled back. Recheck the same operation after
        // locking its surviving actor: another request may have committed before
        // the candidate User disappeared. Historical receipt always wins.
        return db.$transaction(async tx => {
          await lockLifecycleUsers(tx, [identity.actorUserId])
          await lockOperation(tx, identity)
          const saved = await receipt(tx, identity)
          if (saved) {
            if (saved.phase === 'committed' && saved.inputDigest !== digest) throw new OwnerTransferError('OWNER_TRANSFER_INPUT_CONFLICT')
            return result(saved)
          }
          const existing = await tx.user.findMany({ where: { id: { in: users } }, select: { id: true } })
          const present = new Set(existing.map(user => user.id))
          if (input.targetUserId !== identity.actorUserId &&
              users.filter(userId => !present.has(userId)).length === 1 &&
              !present.has(input.targetUserId)) throw conflict()
          throw error
        }, readOptions)
      }
      if (!retryable(error)) throw error
      if (attempt === 3) throw changed()
    }
  }
  throw changed()
}
