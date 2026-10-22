import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertRetirementMembershipWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'

type Tx = Prisma.TransactionClient
type Participant = { id: string; userId: string | null; role: string; status: string }
export class HrMembershipChanged extends Error {
  constructor() { super('組織またはメンバーの状態が変わりました。再確認してください。') }
}
const codepoint = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const retryable = (error: unknown) => {
  const e = error as { code?: string; meta?: { code?: string } }
  return e?.code === 'HR_MEMBERSHIP_CHANGED' || e?.code === 'P2034' ||
    e?.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code ?? '')
}
type Snapshot = { owner: Participant; requested: Participant[]; userIds: string[]; discoveredUsers: string[] }
const signature = (rows: Participant[]) => JSON.stringify(rows.map(row => [row.id, row.userId, row.role, row.status]))
async function participants(db: Tx | PrismaClient, organizationId: string, requestedMemberIds: string[]): Promise<Snapshot> {
  const rows = await db.hrOrganizationMember.findMany({
    where: { organizationId, OR: [{ role: 'OWNER', status: 'ACTIVE' }, { id: { in: requestedMemberIds } }] },
    select: { id: true, userId: true, role: true, status: true }, orderBy: { id: 'asc' },
  })
  const owners = rows.filter(row => row.role === 'OWNER' && row.status === 'ACTIVE')
  if (owners.length !== 1 || !owners[0].userId) throw new HrMembershipChanged()
  return { owner: owners[0], requested: rows.filter(row => requestedMemberIds.includes(row.id)),
    userIds: rows.flatMap(row => row.userId ? [row.userId] : []), discoveredUsers: [] }
}

/**
 * Discover participants outside the transaction, then lock every User before
 * the organization and member rows. A changed owner/target restarts the whole
 * transaction; no new User lock is acquired after the organization lock.
 */
type MembershipWriteInput<T> = {
  organizationId: string; actorUserId: string; requestedMemberIds?: string[]; knownUserIds?: string[]
  discoverUserIds?: (db: Tx | PrismaClient) => Promise<string[]>
  run: (tx: Tx, snapshot: Snapshot) => Promise<T>
}

async function writeMembership<T>(input: MembershipWriteInput<T>, db: PrismaClient,
  isolationLevel: 'Serializable' | 'ReadCommitted'): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const requested = input.requestedMemberIds ?? []
    const discovered = await participants(db, input.organizationId, requested)
    discovered.discoveredUsers = input.discoverUserIds ? await input.discoverUserIds(db) : []
    const users = [...new Set([input.actorUserId, ...discovered.userIds,
      ...(input.knownUserIds ?? []), ...discovered.discoveredUsers])].sort(codepoint)
    try {
      return await db.$transaction(async tx => {
        await lockLifecycleUsers(tx, users)
        await assertRetirementMembershipWritable(tx, users)
        const org = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM hr_organizations WHERE id = ${input.organizationId} FOR UPDATE`)
        if (org.length !== 1) throw new HrMembershipChanged()
        const current = await participants(tx, input.organizationId, requested)
        if (signature([current.owner, ...current.requested]) !== signature([discovered.owner, ...discovered.requested])) {
          throw Object.assign(new HrMembershipChanged(), { code: 'HR_MEMBERSHIP_CHANGED' })
        }
        current.discoveredUsers = input.discoverUserIds ? await input.discoverUserIds(tx) : []
        if (JSON.stringify([...current.discoveredUsers].sort(codepoint)) !==
          JSON.stringify([...discovered.discoveredUsers].sort(codepoint))) {
          throw Object.assign(new HrMembershipChanged(), { code: 'HR_MEMBERSHIP_CHANGED' })
        }
        const ids = [...new Set([current.owner.id, ...current.requested.map(row => row.id)])].sort(codepoint)
        await tx.$queryRaw(Prisma.sql`SELECT id FROM hr_organization_members WHERE "organizationId" = ${input.organizationId}
          AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`)
        return input.run(tx, current)
      }, { isolationLevel, maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if (!retryable(error) || attempt === 3) throw error
    }
  }
  throw new HrMembershipChanged()
}

/** All existing membership writers retain Serializable admission. */
export function withHrMembershipWrite<T>(input: MembershipWriteInput<T>, db: PrismaClient = prisma): Promise<T> {
  return writeMembership(input, db, 'Serializable')
}

/** Invitation issuance alone must recheck a newly registered recipient after a User-lock wait. */
export function withHrInvitationIssue<T>(input: MembershipWriteInput<T> & {
  discoverUserIds: (db: Tx | PrismaClient) => Promise<string[]>
}, db: PrismaClient = prisma): Promise<T> {
  if (typeof input.discoverUserIds !== 'function') throw new HrMembershipChanged()
  return writeMembership(input, db, 'ReadCommitted')
}
