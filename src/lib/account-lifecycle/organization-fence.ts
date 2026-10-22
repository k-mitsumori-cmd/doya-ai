import { Prisma } from '@prisma/client'
import { LifecycleError, validLifecycleUser } from './state'
import { assertRetirementMembershipWritable, lifecycleInvitationRecipientDisposition, lockLifecycleUsers, type LifecycleDb } from './store'

const organizations = {
  hr: ['hr_organizations', 'hr_organization_members', 'OWNER', ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']],
  kintai: ['kintai_organizations', 'kintai_members', 'system_admin', ['system_admin', 'hr_admin', 'manager', 'employee']],
  sfa: ['sfa_organizations', 'sfa_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  shodan: ['shodan_organizations', 'shodan_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  aio: ['aio_organizations', 'aio_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  mensetsu: ['mensetsu_organizations', 'mensetsu_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  quote: ['quote_organizations', 'quote_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  aishodan: ['aishodan_organizations', 'aishodan_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  income: ['income_organizations', 'income_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  expense: ['expense_organizations', 'expense_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  promane: ['promane_workspaces', 'promane_members', 'owner', ['owner', 'admin', 'member', 'guest']],
} as const
export type LifecycleOrganizationScope = {
  service: keyof typeof organizations; organizationId: string
  actorUserId: string | null; access: 'member' | 'invitation' | 'maintenance'
  targetMemberIds: string[]; targetUserIds: string[]; targetEmails: string[]; grantsAuthority: boolean; pendingClaimUserId: string | null; repairsUnknownTargetRole: boolean
}
export type LifecycleMemberSnapshot = { id: string; userId: string | null; role: string; status: string; pendingEmail?: string | null; inviteToken?: string | null }
export type LifecycleOrganizationContext = { service: keyof typeof organizations; organizationId: string; ownerUserId: string | null; authorityUserIds: string[]; memberRows: LifecycleMemberSnapshot[]; lockedUserIds: string[] }
type Snapshot = { ownerUserId: string | null; authorityUserIds: string[]; members: LifecycleMemberSnapshot[]; userIds: string[]; signature: string }
const nullablePendingServices: readonly string[] = ['sfa', 'shodan', 'aio', 'mensetsu', 'quote', 'aishodan', 'expense']
const kintaiPendingUser = (row: LifecycleMemberSnapshot) => row.status === 'PENDING' && typeof row.userId === 'string' && /^pending_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.userId)
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const replan = () => new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
function validate(scope: LifecycleOrganizationScope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).sort().join(',') !== 'access,actorUserId,grantsAuthority,organizationId,pendingClaimUserId,repairsUnknownTargetRole,service,targetEmails,targetMemberIds,targetUserIds' || typeof scope.service !== 'string' || !Object.hasOwn(organizations, scope.service) || !validLifecycleUser(scope.organizationId) || !['member', 'invitation', 'maintenance'].includes(scope.access) || typeof scope.grantsAuthority !== 'boolean' || typeof scope.repairsUnknownTargetRole !== 'boolean' || !(scope.actorUserId === null && scope.access === 'maintenance' || validLifecycleUser(scope.actorUserId))) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  for (const ids of [scope.targetMemberIds, scope.targetUserIds]) if (!Array.isArray(ids) || ids.length > 64 || ids.some(id => !validLifecycleUser(id))) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  if (!Array.isArray(scope.targetEmails) || scope.targetEmails.length > 64 || scope.targetEmails.some(email => typeof email !== 'string' || email.length > 254 || email !== email.trim().toLowerCase() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  if (scope.repairsUnknownTargetRole && (scope.service !== 'expense' || scope.access !== 'member' || !scope.targetMemberIds.length || scope.pendingClaimUserId !== null)) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  if (scope.pendingClaimUserId !== null && (!validLifecycleUser(scope.pendingClaimUserId) || scope.actorUserId !== scope.pendingClaimUserId || scope.access !== 'invitation' || !scope.grantsAuthority || !scope.targetMemberIds.length || !scope.targetUserIds.includes(scope.pendingClaimUserId) || !scope.targetEmails.length || !(scope.service === 'kintai' || nullablePendingServices.includes(scope.service)))) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
}
async function snapshot(tx: Prisma.TransactionClient, scope: LifecycleOrganizationScope, lock: boolean, invitationEmail?: string): Promise<Snapshot> {
  const [organizationTable, memberTable, ownerRole, roles] = organizations[scope.service]
  const table = Prisma.raw(`"${organizationTable}"`), members = Prisma.raw(`"${memberTable}"`), suffix = lock ? Prisma.raw('FOR UPDATE') : Prisma.empty
  const orgs = await tx.$queryRaw<Array<{ id: string; userId?: string | null }>>(Prisma.sql`SELECT id ${scope.service === 'promane' ? Prisma.raw(', "userId"') : Prisma.empty} FROM ${table} WHERE id = ${scope.organizationId}`)
  if (orgs.length !== 1) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
  // Resolve email recipients before and after locks. A newly registered recipient requires a full replan.
  const emails = [...new Set(scope.targetEmails)].sort()
  const recipients = emails.length ? await tx.user.findMany({ where: { OR: emails.map(email => ({ email: { equals: email, mode: 'insensitive' as const } })) }, select: { id: true, email: true } }) : []
  const emailMap = emails.map(email => {
    const matches = recipients.filter(user => user.email?.trim().toLowerCase() === email)
    if (matches.length > 1) throw new LifecycleError('LIFECYCLE_TARGET_AMBIGUOUS')
    return [email, matches[0]?.id ?? null] as const
  })
  const targetMembers = [...new Set(scope.targetMemberIds)].sort(), targetUsers = [...new Set(scope.targetUserIds)].sort()
  const actor = scope.actorUserId ? Prisma.sql`OR "userId" = ${scope.actorUserId}` : Prisma.empty
  const selectedMembers = targetMembers.length ? Prisma.sql`OR id IN (${Prisma.join(targetMembers)})` : Prisma.empty
  const selectedUserIds = [...new Set([...targetUsers, ...(invitationEmail ? recipients.map(user => user.id) : [])])]
  const selectedUsers = selectedUserIds.length ? Prisma.sql`OR "userId" IN (${Prisma.join(selectedUserIds)})` : Prisma.empty
  const invitation = invitationEmail ? Prisma.sql`OR "invitedEmail" = ${invitationEmail}` : Prisma.empty
  const status = scope.service === 'promane' ? Prisma.raw('CASE WHEN "isActive" THEN \'ACTIVE\' ELSE \'INACTIVE\' END AS status') : Prisma.raw('status')
  const pendingFields = scope.service === 'kintai' ? Prisma.raw(', "inviteEmail" AS "pendingEmail", "inviteToken"') : scope.service === 'expense' ? Prisma.raw(', "invitedEmail" AS "pendingEmail"') : nullablePendingServices.includes(scope.service) ? Prisma.raw(', "inviteEmail" AS "pendingEmail", "inviteToken"') : Prisma.empty
  const rows = await tx.$queryRaw<LifecycleMemberSnapshot[]>(Prisma.sql`SELECT id, "userId", role, ${status} ${pendingFields} FROM ${members}
    WHERE ${scope.service === 'promane' ? Prisma.raw('"workspaceId"') : Prisma.raw('"organizationId"')} = ${scope.organizationId}
      AND (role = ${ownerRole} ${actor} ${selectedMembers} ${selectedUsers} ${invitation}) ORDER BY id ${suffix}`)
  if (rows.some(row => !validLifecycleUser(row.id) || (!(roles as readonly string[]).includes(row.role) && !(scope.repairsUnknownTargetRole && targetMembers.includes(row.id) && row.userId !== scope.actorUserId)) || !(scope.service === 'hr' ? ['ACTIVE', 'INVITED', 'SUSPENDED'] : ['ACTIVE', 'PENDING', 'INACTIVE']).includes(row.status))) throw new LifecycleError('LIFECYCLE_MEMBERSHIP_UNAVAILABLE')
  // Kintai supports several system administrators; authority additionally requires an active employee.
  const employees = scope.service === 'kintai' && rows.length
    ? await tx.$queryRaw<Array<{ id: string; memberId: string; organizationId: string; isActive: boolean; email: string }>>(Prisma.sql`SELECT id, "memberId", "organizationId", "isActive", email FROM "kintai_employees" WHERE "memberId" IN (${Prisma.join(rows.map(row => row.id))}) ORDER BY id ${suffix}`) : []
  if (employees.some(employee => employee.organizationId !== scope.organizationId)) throw new LifecycleError('LIFECYCLE_MEMBERSHIP_UNAVAILABLE')
  const hasKintaiAuthority = (row: LifecycleMemberSnapshot) => row.status === 'ACTIVE' && employees.some(employee => employee.memberId === row.id && employee.isActive)
  const owners = rows.filter(row => row.role === ownerRole)
  let ownerUserId: string | null = null
  let authorityUserIds: string[]
  if (scope.service === 'kintai') {
    authorityUserIds = owners.filter(hasKintaiAuthority).map(row => {
      if (!validLifecycleUser(row.userId) || row.userId.startsWith('pending_')) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
      return row.userId
    })
    if (!authorityUserIds.length) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
  } else if (scope.service === 'expense') {
    authorityUserIds = owners.filter(row => row.status === 'ACTIVE').map(row => {
      if (!validLifecycleUser(row.userId)) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
      return row.userId
    })
    if (!authorityUserIds.length) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
  } else {
    if (owners.length !== 1 || owners[0].status !== 'ACTIVE' || !validLifecycleUser(owners[0].userId)) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
    ownerUserId = owners[0].userId
    authorityUserIds = [ownerUserId]
    if (scope.service === 'promane' && orgs[0].userId !== ownerUserId) throw new LifecycleError('LIFECYCLE_OWNER_UNAVAILABLE')
  }
  authorityUserIds = [...new Set(authorityUserIds)].sort()
  const actorRows = rows.filter(row => row.userId === scope.actorUserId)
  if (scope.access === 'member' && (actorRows.length !== 1 || actorRows[0].status !== 'ACTIVE' || scope.service === 'kintai' && !hasKintaiAuthority(actorRows[0]))) throw new LifecycleError('LIFECYCLE_ACTOR_UNAVAILABLE')
  if (scope.repairsUnknownTargetRole && (actorRows.length !== 1 || actorRows[0].role !== 'owner')) throw new LifecycleError('LIFECYCLE_ACTOR_UNAVAILABLE')
  const targets = targetMembers.map(id => rows.find(row => row.id === id))
  if (targets.some(row => !row)) throw new LifecycleError('LIFECYCLE_TARGET_UNAVAILABLE')
  const referencedUsers: string[] = []
  const invitationPriorBindings: string[] = []
  for (const row of rows) {
    const directTarget = targetMembers.includes(row.id) || targetUsers.includes(row.userId || '')
    if (scope.service === 'expense' && row.status === 'INACTIVE' && row.userId === null && (scope.actorUserId === null || row.userId !== scope.actorUserId) && !directTarget) continue
    if (invitationEmail && row.userId !== scope.actorUserId && !authorityUserIds.includes(row.userId || '')) {
      if (row.userId !== null) {
        if (!validLifecycleUser(row.userId)) throw new LifecycleError('LIFECYCLE_TARGET_UNAVAILABLE')
        invitationPriorBindings.push(row.userId)
      }
      continue
    }
    const unboundPending = scope.service === 'kintai' && kintaiPendingUser(row) || nullablePendingServices.includes(scope.service) && row.status === 'PENDING' && row.userId === null
    if (unboundPending && (!targets.some(target => target?.id === row.id) || !scope.grantsAuthority || scope.pendingClaimUserId !== null)) continue
    if (!validLifecycleUser(row.userId) || scope.service === 'kintai' && row.userId.startsWith('pending_')) throw new LifecycleError('LIFECYCLE_TARGET_UNAVAILABLE')
    referencedUsers.push(row.userId)
  }
  const pendingEmail = (row: LifecycleMemberSnapshot) => row.pendingEmail || (scope.service === 'kintai' ? employees.find(employee => employee.memberId === row.id)?.email : null)
  if (scope.pendingClaimUserId !== null && targets.some(row => !row || row.status !== 'PENDING' || !(scope.service === 'kintai' ? kintaiPendingUser(row) && typeof row.inviteToken === 'string' && row.inviteToken.length > 0 : row.userId === null && (scope.service === 'expense' || typeof row.inviteToken === 'string' && row.inviteToken.length > 0)) || typeof pendingEmail(row) !== 'string' || !emailMap.some(([email, id]) => email === pendingEmail(row)!.trim().toLowerCase() && id === scope.pendingClaimUserId))) throw new LifecycleError('LIFECYCLE_PENDING_CLAIM_UNAVAILABLE')
  const existingPriorBindings = invitationPriorBindings.length ? await tx.user.findMany({ where: { id: { in: invitationPriorBindings } }, select: { id: true } }) : []
  const userIds = [...new Set([...authorityUserIds, ...targetUsers, ...(scope.actorUserId ? [scope.actorUserId] : []), ...referencedUsers, ...existingPriorBindings.map(user => user.id), ...recipients.map(user => user.id)])].sort()
  if (userIds.length > 64) throw new LifecycleError('LIFECYCLE_PARTICIPANTS_LIMIT')
  return { ownerUserId, authorityUserIds, members: rows, userIds, signature: JSON.stringify([ownerUserId, authorityUserIds, rows, employees, emailMap, userIds]) }
}

/** DB-only. Discover first, then lock all Users before any org/member or operation row. Never nest a new scope after org locks. */
async function withOrganizationTransactions<T>(db: LifecycleDb, scopes: LifecycleOrganizationScope[], work: (tx: Prisma.TransactionClient, contexts: LifecycleOrganizationContext[]) => Promise<T>, invitationEmail?: string): Promise<T> {
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > 32 || typeof work !== 'function') throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  for (const scope of scopes) validate(scope)
  const sorted = [...scopes].sort((a, b) => `${a.service}:${a.organizationId}`.localeCompare(`${b.service}:${b.organizationId}`))
  if (new Set(sorted.map(scope => `${scope.service}:${scope.organizationId}`)).size !== sorted.length) throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  for (let attempt = 0; attempt < 4; attempt++) {
    const discovered = await db.$transaction(async tx => {
      const list: Snapshot[] = []
      for (const scope of sorted) list.push(await snapshot(tx, scope, false, invitationEmail))
      return list
    }, options)
    const ids = [...new Set(discovered.flatMap(value => value.userIds))].sort()
    try {
      return await db.$transaction(async tx => {
        await lockLifecycleUsers(tx, ids)
        // Acquire every organization before any member row, including multi-org writes.
        for (const scope of sorted) {
          const table = Prisma.raw(`"${organizations[scope.service][0]}"`)
          const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM ${table} WHERE id = ${scope.organizationId} FOR UPDATE`)
          if (rows.length !== 1) throw new LifecycleError('LIFECYCLE_ORGANIZATION_UNAVAILABLE')
        }
        const contexts: LifecycleOrganizationContext[] = []
        for (let n = 0; n < sorted.length; n++) {
          const current = await snapshot(tx, sorted[n], true, invitationEmail)
          if (current.signature !== discovered[n].signature) throw replan()
          contexts.push({ service: sorted[n].service, organizationId: sorted[n].organizationId, ownerUserId: current.ownerUserId, authorityUserIds: current.authorityUserIds, memberRows: current.members, lockedUserIds: ids })
        }
        const protectedIds = invitationEmail ? [...new Set(contexts.flatMap(context => [...context.authorityUserIds, ...(sorted[0].actorUserId ? [sorted[0].actorUserId] : [])]))] : ids
        await assertRetirementMembershipWritable(tx, protectedIds)
        return work(tx, contexts)
      }, options)
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } }
      const retryable = failure?.code === 'LIFECYCLE_PARTICIPANTS_CHANGED' || failure?.code === 'P2034' || failure?.code === 'P2010' && ['40001', '40P01'].includes(failure.meta?.code || '')
      if (!retryable || attempt === 3) throw error
    }
  }
  throw replan()
}
export async function withLifecycleOrganizationWrites<T>(db: LifecycleDb, scopes: LifecycleOrganizationScope[], work: (tx: Prisma.TransactionClient, contexts: LifecycleOrganizationContext[]) => Promise<T>): Promise<T> {
  return withOrganizationTransactions(db, scopes, work)
}

export type LifecycleExpenseInviteScope = { organizationId: string; actorUserId: string; actorMemberId: string; recipientEmail: string }
/** POST invite/reinvite only. Active/pending duplicates never execute work or expose a recipient fence. */
export async function withLifecycleExpenseInvitation<T>(db: LifecycleDb, input: LifecycleExpenseInviteScope, authorizeActor: (context: LifecycleOrganizationContext) => void, work: (tx: Prisma.TransactionClient, context: LifecycleOrganizationContext, recipient: { status: 'ACTIVE' | 'PENDING'; userId: string | null; existingMemberId: string | null }) => Promise<T>): Promise<{ kind: 'duplicate' } | { kind: 'written'; value: T }> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'actorMemberId,actorUserId,organizationId,recipientEmail' || !validLifecycleUser(input.actorMemberId) || typeof authorizeActor !== 'function' || typeof work !== 'function') throw new LifecycleError('INVALID_LIFECYCLE_SCOPE', 400)
  const scope: LifecycleOrganizationScope = { service: 'expense', organizationId: input.organizationId, actorUserId: input.actorUserId, access: 'member', targetMemberIds: [], targetUserIds: [], targetEmails: [input.recipientEmail], grantsAuthority: true, pendingClaimUserId: null, repairsUnknownTargetRole: false }
  validate(scope)
  return withOrganizationTransactions(db, [scope], async (tx, [context]) => {
    const actor = context.memberRows.find(row => row.userId === input.actorUserId)
    if (!actor || actor.id !== input.actorMemberId || actor.status !== 'ACTIVE' || !['owner', 'admin'].includes(actor.role)) throw new LifecycleError('LIFECYCLE_ACTOR_UNAVAILABLE', 403)
    authorizeActor(context)
    const users = await tx.user.findMany({ where: { email: { equals: input.recipientEmail, mode: 'insensitive' } }, select: { id: true } })
    if (users.length > 1 || users.some(user => !context.lockedUserIds.includes(user.id))) throw replan()
    const recipientUserId = users[0]?.id ?? null
    const matches = context.memberRows.filter(row => row.pendingEmail?.trim().toLowerCase() === input.recipientEmail || recipientUserId !== null && row.userId === recipientUserId)
    if (matches.length > 1 || matches.some(row => row.status !== 'INACTIVE')) return { kind: 'duplicate' as const }
    const status = recipientUserId ? await lifecycleInvitationRecipientDisposition(tx, recipientUserId) : 'PENDING'
    const value = await work(tx, context, { status, userId: status === 'ACTIVE' ? recipientUserId : null, existingMemberId: matches[0]?.id ?? null })
    return { kind: 'written' as const, value }
  }, input.recipientEmail)
}

export async function withLifecycleOrganizationWrite<T>(db: LifecycleDb, scope: LifecycleOrganizationScope, work: (tx: Prisma.TransactionClient, context: LifecycleOrganizationContext) => Promise<T>): Promise<T> {
  return withLifecycleOrganizationWrites(db, [scope], (tx, contexts) => work(tx, contexts[0]))
}
