import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clearAutomaticLinkOptOut } from './auto-link-opt-out.server'
import { TOOL_ROLE_TABLES, type ToolId } from './tool-roles'
import { createToolSeatOwnershipReader } from '@/lib/pricing-v2/tool-seat-ownership.server'
import { readToolUnionLicense, resolveToolUnionScope, toolUnionScopeIdentity, ToolUnionScopeError, type ToolUnionScope } from '@/lib/pricing-v2/tool-seat-union-scope.server'
import { SeatOperationError, withSeatAdmissionInTransaction, withSeatContextInTransaction } from '@/lib/pricing-v2/seat-operation'

export type CompanyToolLinkCode = 'NOT_ALLOWED' | 'NOT_TOP_MEMBER' | 'LINKED_ELSEWHERE' | 'INVALID' |
  'SEAT_CAPACITY_EXCEEDED' | 'SEAT_CAPACITY_UNAVAILABLE' | 'SEAT_OPERATION_BUSY' | 'SEAT_CONTEXT_CHANGED'
export type CompanyToolLinkDecision = { ok: true; created: boolean } | { ok: false; status: number; code: CompanyToolLinkCode }
type Input = { companyId: string; actorUserId: string; actorIsAdmin: boolean; tool: ToolId; organizationId: string }
type Tx = Prisma.TransactionClient
const organizationTables: Record<ToolId, string> = {
  kintai: 'kintai_organizations', hr: 'hr_organizations', expense: 'expense_organizations',
  income: 'income_organizations', quote: 'quote_organizations', promane: 'promane_workspaces',
  sfa: 'sfa_organizations', shodan: 'shodan_organizations', aio: 'aio_organizations',
  mensetsu: 'mensetsu_organizations', aishodan: 'aishodan_organizations',
}
class LinkDenied extends Error {
  constructor(readonly status: number, readonly code: CompanyToolLinkCode) { super(code) }
}
const deny = (status: number, code: CompanyToolLinkCode): never => { throw new LinkDenied(status, code) }

const memberTables: Record<ToolId, string> = {
  kintai: 'kintai_members', hr: 'hr_organization_members', expense: 'expense_members',
  income: 'income_members', quote: 'quote_members', promane: 'promane_members',
  sfa: 'sfa_members', shodan: 'shodan_members', aio: 'aio_members',
  mensetsu: 'mensetsu_members', aishodan: 'aishodan_members',
}
async function currentTopMember(tx: Tx, input: Input) {
  const scopeColumn = input.tool === 'promane' ? 'workspaceId' : 'organizationId'
  const active = input.tool === 'promane' ? '"isActive"=true' : "status='ACTIVE'"
  const rows = await tx.$queryRawUnsafe<Array<{ role: string }>>('SELECT role FROM "' + memberTables[input.tool] + '" WHERE "' + scopeColumn + '"=$1 AND "userId"=$2 AND ' + active + ' ORDER BY id FOR UPDATE', input.organizationId, input.actorUserId)
  const top = TOOL_ROLE_TABLES[input.tool].order.at(-1)
  return rows.length > 0 && rows.every(row => row.role === top)
}

/** Explicit linking may add an entire organization to the destination seat union.
 * All network work stays outside this SQL transaction. Never purchase seats,
 * enroll central members, infer an HR transfer payer, or change User.plan here.
 * Same-company retries are read-only after current authority is checked.
 */
export async function linkCompanyToolOrganization(input: Input, options: { onLinked?: (tx: Tx) => Promise<void> } = {}): Promise<CompanyToolLinkDecision> {
  if (!input.actorIsAdmin) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  if (!input.companyId || !input.actorUserId || !input.organizationId || input.organizationId.length > 128 ||
      !Object.prototype.hasOwnProperty.call(organizationTables, input.tool)) return { ok: false, status: 400, code: 'INVALID' }
  try {
    return await prisma.$transaction(async tx => {
      const reader = createToolSeatOwnershipReader(tx)
      const initialCompany = await reader.findCompany(input.companyId)
      if (!initialCompany) return deny(403, 'NOT_ALLOWED')
      const pricing = reader.globallyEnabled() && reader.enabledForOwner(initialCompany.owner.email)
      const initialScope = pricing ? await resolveToolUnionScope(input, tx) : { enabled: false as const }
      if (initialScope.enabled && 'error' in initialScope && initialScope.error === 'unavailable') return deny(503, 'SEAT_CAPACITY_UNAVAILABLE')
      // A setup-required organization is exactly what this explicit authorized
      // link configures; no previous payer is invented for it.
      const oldScope = initialScope.enabled && 'scope' in initialScope ? initialScope.scope : null
      const fences = pricing ? [...new Set([input.companyId, ...(oldScope ? [oldScope.fenceKey] : [])])].sort() : []
      const execute = async (): Promise<CompanyToolLinkDecision> => {
        const ids = [...new Set([input.actorUserId, initialCompany.owner.id, ...(oldScope ? [oldScope.ownerUserId] : [])])].sort()
        const placeholders = ids.map((_, index) => '$' + (index + 1)).join(',')
        const users = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "User" WHERE id IN (' + placeholders + ') ORDER BY id FOR UPDATE', ...ids)
        if (users.length !== ids.length) return deny(409, 'SEAT_CONTEXT_CHANGED')
        const companies = [...new Set([input.companyId, ...(oldScope?.companyId ? [oldScope.companyId] : [])])].sort()
        await tx.$queryRawUnsafe('SELECT id FROM account_companies WHERE id IN (' + companies.map((_, index) => '$' + (index + 1)).join(',') + ') ORDER BY id FOR UPDATE', ...companies)
        const currentCompany = await reader.findCompany(input.companyId)
        if (!currentCompany || currentCompany.owner.id !== initialCompany.owner.id ||
            currentCompany.owner.subscriberKind !== initialCompany.owner.subscriberKind ||
            (reader.globallyEnabled() && reader.enabledForOwner(currentCompany.owner.email)) !== pricing) return deny(409, 'SEAT_CONTEXT_CHANGED')
        if (currentCompany.owner.id !== input.actorUserId) {
          const members = await tx.$queryRawUnsafe<Array<{ role: string }>>('SELECT role FROM account_company_members WHERE "companyId"=$1 AND "userId"=$2 AND status=$3 ORDER BY id FOR UPDATE', input.companyId, input.actorUserId, 'active')
          if (!members.length || members.some(member => member.role !== 'admin')) return deny(403, 'NOT_ALLOWED')
        }
        // Values are parameters; the identifier comes only from the closed map.
        const organizations = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "' + organizationTables[input.tool] + '" WHERE id=$1 FOR UPDATE', input.organizationId)
        if (organizations.length !== 1 || !(await currentTopMember(tx, input))) return deny(403, 'NOT_TOP_MEMBER')
        const existing = await tx.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } }, select: { companyId: true } })
        if (existing) return existing.companyId === input.companyId ? { ok: true, created: false } : deny(409, 'LINKED_ELSEWHERE')
        if (pricing && toolUnionScopeIdentity(await resolveToolUnionScope(input, tx)) !== toolUnionScopeIdentity(initialScope)) return deny(409, 'SEAT_CONTEXT_CHANGED')
        const destination: ToolUnionScope = { companyId: input.companyId, ownerUserId: currentCompany.owner.id, fenceKey: input.companyId, kind: currentCompany.owner.subscriberKind, attribution: 'linked-org' }
        const write = async () => {
          if (pricing) {
            const before = await readToolUnionLicense(destination, tx)
            if (before.used > before.limit) return deny(409, 'SEAT_CAPACITY_EXCEEDED')
          }
          await tx.accountCompanyToolOrg.create({ data: { tool: input.tool, organizationId: input.organizationId, companyId: input.companyId, linkedBy: input.actorUserId } })
          if (pricing) {
            const after = await readToolUnionLicense(destination, tx)
            if (after.used > after.limit) return deny(409, 'SEAT_CAPACITY_EXCEEDED')
          }
          await clearAutomaticLinkOptOut(tx, input.companyId, input.tool, input.organizationId)
          if (options.onLinked) await options.onLinked(tx)
          return { ok: true as const, created: true }
        }
        if (!pricing) return write()
        let writeEntered = false, writeCompleted = false
        try {
          return await withSeatAdmissionInTransaction(input.companyId, tx, async () => {
            writeEntered = true
            const result = await write()
            writeCompleted = true
            return result
          })
        } catch (error) {
          if ((!writeEntered || writeCompleted) && !(error instanceof SeatOperationError) && !(error instanceof ToolUnionScopeError)) return deny(503, 'SEAT_CAPACITY_UNAVAILABLE')
          throw error
        }
      }
      const inFence = (index: number): Promise<CompanyToolLinkDecision> => index === fences.length
        ? execute() : withSeatContextInTransaction(fences[index], tx, () => inFence(index + 1))
      return inFence(0)
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 })
  } catch (error) {
    if (error instanceof LinkDenied) return { ok: false, status: error.status, code: error.code }
    if (error instanceof SeatOperationError) return { ok: false, status: error.code === 'SEAT_OPERATION_BUSY' ? 409 : 503, code: error.code === 'SEAT_OPERATION_BUSY' ? 'SEAT_OPERATION_BUSY' : 'SEAT_CAPACITY_UNAVAILABLE' }
    if (error instanceof ToolUnionScopeError) return { ok: false, status: error.code === 'SEAT_CONTEXT_CHANGED' ? 409 : 503, code: error.code }
    const sql = error as { code?: string }
    if (sql.code === 'P2034' || sql.code === 'P2002') return { ok: false, status: 409, code: 'SEAT_CONTEXT_CHANGED' }
    throw error
  }
}
