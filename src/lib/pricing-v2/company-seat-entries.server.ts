import { companyRolesModeFor, companyRolesRollout } from '@/lib/company-roles/rollout'
import type { Prisma } from '@prisma/client'
import { TOOL_ROLE_TABLES, type ToolId } from '@/lib/company-roles/tool-roles'
import { isKintaiInviteExpired } from '@/lib/kintai/invite-token'
import { SeatUsageUnavailableError, type SeatUsageEntry } from './company-seat-usage'

type Member = {
  id: string; userId: string | null; role: string; createdAt: Date
  organizationId?: string; workspaceId?: string; status?: string; isActive?: boolean
  inviteToken?: string | null; inviteEmail?: string | null; invitedEmail?: string | null
  employee?: { email: string; isActive: boolean } | null
}
type MemberReader = { findMany(args: Record<string, unknown>): Promise<Member[]> }
type OrganizationReader = { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; userId?: string }>> }
export type AttributedSeatOrganization = {
  tool: ToolId; organizationId: string; attribution: 'linked-org' | 'verified-creator-company'
}

/** Collect the COMPLETE verified company scope, not a client-supplied org list.
 * Explicit links win. Unlinked organizations qualify only when their original
 * creator is still their sole current owner and owns this company. Transfers
 * and ambiguous owners require explicit setup; this reader never creates it.
 * Read inside the caller's guarded transaction. No provider/cache/link writes.
 */
export async function collectCompanySeatEntries(tx: Prisma.TransactionClient, companyId: string, now: Date) {
  if (!companyId || !Number.isFinite(now.getTime())) throw new SeatUsageUnavailableError()
  const company = await tx.accountCompany.findUnique({ where: { id: companyId }, select: { id: true, userId: true } })
  if (!company?.userId) throw new SeatUsageUnavailableError()
  return collectAttributedEntries(tx, company, now, true)
}

/** A valid existing free/personal tool organization must not require filling in
 * a company profile merely to retain its licensed collaboration. This virtual
 * owner scope performs no profile/member/link creation and grants no paid plan.
 * The pricing/admission caller must still verify FREE/legacy capacity; a Team
 * contract with no persisted company remains a configuration failure. Before
 * writes, pin/recheck the owner/profile and serialize the exact resolved scope.
 */
export async function collectPersonalOwnerSeatEntries(tx: Prisma.TransactionClient, ownerUserId: string, now: Date) {
  if (!ownerUserId || !Number.isFinite(now.getTime())) throw new SeatUsageUnavailableError()
  const owner = await tx.user.findUnique({ where: { id: ownerUserId }, select: { id: true } })
  if (!owner) throw new SeatUsageUnavailableError()
  const company = await tx.accountCompany.findUnique({ where: { userId: ownerUserId }, select: { id: true, userId: true } })
  return collectAttributedEntries(tx, company ?? { id: 'personal-owner:' + ownerUserId, userId: ownerUserId }, now, !!company)
}

async function collectAttributedEntries(tx: Prisma.TransactionClient, company: { id: string; userId: string }, now: Date, persistedCompany: boolean) {
  const companyId = company.id
  const entries: SeatUsageEntry[] = [], organizations: AttributedSeatOrganization[] = []
  const addOperator = (key: string, userId: string) => entries.push({ companyId, key, kind: 'operator', userId })
  const reserve = (key: string, email: string | null | undefined, createdAt: Date, expiresAt: Date | null) => {
    // Non-central routes do not reject future createdAt when their explicit
    // expiry/token remains usable. Reserve conservatively from this snapshot.
    entries.push({ companyId, key, kind: 'reservation', email: email ?? '',
      startsAt: new Date(Math.min(createdAt.getTime(), now.getTime())), expiresAt })
  }
  const central = persistedCompany ? await tx.accountCompanyMember.findMany({
    where: { companyId, status: { in: ['active', 'invited'] } },
    select: { id: true, userId: true, email: true, status: true, invitedAt: true, inviteToken: true, role: true },
  }) : []
  // Only a current explicit active guest can override an independent tool
  // role. Mixed/unknown active central roles stay conservative until reconciled.
  // Resolve preview against this account's CURRENT email, never the row email.
  const centralRoles = new Map<string, string[]>()
  for (const row of central) if (row.status === 'active' && row.userId && row.userId !== company.userId) {
    const roles = centralRoles.get(row.userId) ?? []
    roles.push(row.role); centralRoles.set(row.userId, roles)
  }
  const guestIds = [...centralRoles].filter(([, roles]) => roles.every(role => role === 'guest')).map(([id]) => id)
  const roleRollout = companyRolesRollout()
  const enforcedGuestAccounts: Array<{ id: string; email: string | null }> = []
  if (roleRollout !== 'off' && roleRollout !== 'shadow' && guestIds.length) {
    const users = await tx.user.findMany({ where: { id: { in: guestIds } }, select: { id: true, email: true } })
    for (const user of users) if (companyRolesModeFor(user.email) === 'enforce') enforcedGuestAccounts.push(user)
  }
  for (const row of central) {
    // Explicit central guests are view-only. Independent operating tool roles
    // still contribute through their actual stored memberships below. Unknown
    // central roles remain counted until separately reconciled.
    if (row.role === 'guest') continue
    const key = 'company:member:' + row.id
    if (row.status === 'active') {
      if (row.userId) addOperator(key, row.userId)
      else entries.push({ companyId, key, kind: 'opaque' })
    } else if (row.status === 'invited' && row.inviteToken && row.inviteToken.length <= 128 && row.invitedAt &&
      row.invitedAt.getTime() <= now.getTime() && now.getTime() - row.invitedAt.getTime() < 7 * 86400000) {
      reserve(key, row.email, row.invitedAt, new Date(row.invitedAt.getTime() + 7 * 86400000))
    }
  }
  const memberReaders: Record<ToolId, MemberReader> = {
    kintai: tx.kintaiMember, hr: tx.hrOrganizationMember, expense: tx.expenseMember,
    income: tx.incomeMember, quote: tx.quoteMember, promane: tx.promaneMember,
    sfa: tx.sfaMember, shodan: tx.shodanMember, aio: tx.aioMember,
    mensetsu: tx.mensetsuMember, aishodan: tx.aishodanMember,
  } as unknown as Record<ToolId, MemberReader>
  const orgReaders = {
    kintai: tx.kintaiOrganization, hr: tx.hrOrganization, expense: tx.expenseOrganization,
    income: tx.incomeOrganization, quote: tx.quoteOrganization, promane: tx.promaneWorkspace,
    sfa: tx.sfaOrganization, shodan: tx.shodanOrganization, aio: tx.aioOrganization,
    mensetsu: tx.mensetsuOrganization, aishodan: tx.aishodanOrganization,
  } as unknown as Record<ToolId, OrganizationReader>
  const links = persistedCompany ? await tx.accountCompanyToolOrg.findMany({ where: { companyId }, select: { tool: true, organizationId: true } }) : []
  for (const link of links) if (!Object.prototype.hasOwnProperty.call(TOOL_ROLE_TABLES, link.tool) || !link.organizationId) throw new SeatUsageUnavailableError()
  for (const tool of Object.keys(TOOL_ROLE_TABLES) as ToolId[]) {
    const reader = memberReaders[tool], field = tool === 'promane' ? 'workspaceId' : 'organizationId'
    const roles = TOOL_ROLE_TABLES[tool].order, topRole = roles[roles.length - 1]
    const active = tool === 'promane' ? { isActive: true } : { status: 'ACTIVE' }
    const ownerRows = await reader.findMany({ where: { userId: company.userId, role: topRole, ...active },
      select: { id: true, [field]: true } })
    const explicit = new Set(links.filter(link => link.tool === tool).map(link => link.organizationId))
    const ownerIds = [...new Set(ownerRows.map(row => (tool === 'promane' ? row.workspaceId : row.organizationId)!))]
    if (ownerIds.some(id => !id)) throw new SeatUsageUnavailableError()
    const existingLinks = ownerIds.length ? await tx.accountCompanyToolOrg.findMany({
      where: { tool, organizationId: { in: ownerIds } }, select: { organizationId: true, companyId: true },
    }) : []
    // A current owner may have explicitly linked their org to another company.
    // Never charge that org to their unrelated personal company as well.
    const otherLinked = new Set(existingLinks.filter(link => !persistedCompany || link.companyId !== companyId).map(link => link.organizationId))
    const pool = [...new Set([...explicit, ...ownerIds.filter(id => !otherLinked.has(id))])]
    if (!pool.length) continue
    const orgs = await orgReaders[tool].findMany({ where: { id: { in: pool } }, select: tool === 'promane' ? { id: true, userId: true } : { id: true } })
    if (orgs.length !== pool.length) throw new SeatUsageUnavailableError()
    const commonSelect = { id: true, userId: true, role: true, createdAt: true, [field]: true }
    const select = tool === 'promane' ? { ...commonSelect, isActive: true }
      : tool === 'hr' || tool === 'income' ? { ...commonSelect, status: true }
      : tool === 'expense' ? { ...commonSelect, status: true, invitedEmail: true }
      : { ...commonSelect, status: true, inviteEmail: true, inviteToken: true,
          ...(tool === 'kintai' ? { employee: { select: { email: true, isActive: true } } } : {}) }
    const rows = await reader.findMany({ where: { [field]: { in: pool } }, select,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    const accepted = new Set(explicit)
    for (const org of orgs) {
      if (explicit.has(org.id)) continue
      const members = rows.filter(row => (tool === 'promane' ? row.workspaceId : row.organizationId) === org.id)
      const owners = members.filter(row => (tool === 'promane' ? row.isActive : row.status === 'ACTIVE') && row.role === topRole)
      const creator = tool === 'promane' ? org.userId : members[0]?.userId
      if (creator === company.userId && owners.length === 1 && owners[0].userId === company.userId) accepted.add(org.id)
    }
    for (const organizationId of accepted) organizations.push({ tool, organizationId,
      attribution: explicit.has(organizationId) ? 'linked-org' : 'verified-creator-company' })
    for (const row of rows) {
      const orgId = tool === 'promane' ? row.workspaceId : row.organizationId
      if (!orgId || !accepted.has(orgId) || !roles.includes(row.role) || (tool === 'promane' && row.role === 'guest')) continue
      const key = tool + ':member:' + row.id
      if (tool === 'kintai' && (!row.employee || !row.employee.isActive)) continue
      if (tool === 'promane' ? row.isActive : row.status === 'ACTIVE') {
        if (row.userId) addOperator(key, row.userId)
        // Null User fields in tool tables are employees/contacts, not accounts.
        continue
      }
      if (row.status !== 'PENDING' || tool === 'hr' || tool === 'income') continue
      if (tool === 'expense') {
        // Actual auto-claim requires userId=null and has no expiry/token field.
        if (!row.userId && row.invitedEmail) reserve(key, row.invitedEmail, row.createdAt, null)
      } else if (tool === 'kintai') {
        if (!isKintaiInviteExpired(row.inviteToken ?? null, row.createdAt, now.getTime())) {
          const issued = row.inviteToken!.startsWith('v2.') ? parseInt(row.inviteToken!.split('.')[1], 36) : row.createdAt.getTime()
          reserve(key, row.inviteEmail || row.employee!.email, new Date(issued), new Date(issued + 48 * 3600000))
        }
      } else if (row.inviteToken && ['admin', 'manager', 'member'].includes(row.role) &&
        row.createdAt.getTime() + 48 * 3600000 > now.getTime()) {
        reserve(key, row.inviteEmail, row.createdAt, new Date(row.createdAt.getTime() + 48 * 3600000))
      }
    }
    if (tool === 'hr') {
      const invitations = await tx.hrInvitation.findMany({
        where: { organizationId: { in: [...accepted] }, status: 'PENDING', role: 'MEMBER', expiresAt: { gt: now } },
        select: { id: true, token: true, email: true, createdAt: true, expiresAt: true },
      })
      for (const row of invitations) if (row.token.trim() && row.token.length <= 256) reserve('hr:invite:' + row.id, row.email, row.createdAt, row.expiresAt)
    } else if (tool === 'promane') {
      const invitations = await tx.promaneInvitation.findMany({
        where: { workspaceId: { in: [...accepted] }, role: { in: ['admin', 'member'] }, acceptedAt: null, expiresAt: { gt: now } },
        select: { id: true, token: true, email: true, createdAt: true, expiresAt: true },
      })
      for (const row of invitations) if (row.token && row.token.length <= 128) reserve('promane:invite:' + row.id, row.email, row.createdAt, row.expiresAt)
    }
  }
  return { companyId: company.id, ownerUserId: company.userId, persistedCompany, entries, organizations, enforcedGuestAccounts }
}
