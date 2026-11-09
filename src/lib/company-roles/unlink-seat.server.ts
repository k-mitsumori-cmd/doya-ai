import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TOOL_ROLE_TABLES, type ToolId } from './tool-roles'
import { suppressAutomaticLink } from './auto-link-opt-out.server'
import { resolveToolUnionScope, readToolUnionLicense, toolUnionScopeIdentity, ToolUnionScopeError } from '@/lib/pricing-v2/tool-seat-union-scope.server'
import { SeatOperationError, withSeatAdmissionInTransaction, withSeatContextInTransaction } from '@/lib/pricing-v2/seat-operation'

type Tx = Prisma.TransactionClient
type Input = { companyId: string; actorUserId: string; actorIsOwner: boolean; tool: ToolId; organizationId: string }
type Code = 'INVALID' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'SEAT_CAPACITY_EXCEEDED' | 'SEAT_CAPACITY_UNAVAILABLE' | 'SEAT_OPERATION_BUSY' | 'SEAT_CONTEXT_CHANGED'
export type CompanyToolUnlinkDecision = { ok: true } | { ok: false; status: number; code: Code }
const tables: Record<ToolId, string> = {
  kintai: 'kintai_organizations', hr: 'hr_organizations', expense: 'expense_organizations',
  income: 'income_organizations', quote: 'quote_organizations', promane: 'promane_workspaces',
  sfa: 'sfa_organizations', shodan: 'shodan_organizations', aio: 'aio_organizations',
  mensetsu: 'mensetsu_organizations', aishodan: 'aishodan_organizations',
}
class UnlinkDenied extends Error {
  constructor(readonly status: number, readonly code: Code) { super(code) }
}
const deny = (status: number, code: Code): never => { throw new UnlinkDenied(status, code) }

/** A role-link revocation is not necessarily a seat decrease: the current
 * verified creator's billing scope can differ. Lock both contexts in stable
 * order, preserve all admission claims, and check the actual resulting union.
 * Marker, link deletion and audit either all commit or all roll back. */
export async function unlinkCompanyToolOrganization(input: Input, options: { onUnlinked?: (tx: Tx) => Promise<void> } = {}): Promise<CompanyToolUnlinkDecision> {
  if (!input.actorIsOwner) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  if (!input.actorUserId || !input.companyId || !input.organizationId || input.organizationId.length > 128 ||
      !Object.prototype.hasOwnProperty.call(TOOL_ROLE_TABLES, input.tool)) return { ok: false, status: 400, code: 'INVALID' }
  try {
    return await prisma.$transaction(async tx => {
      const ownerFloor = await tx.accountCompany.findUnique({ where: { id: input.companyId }, select: { userId: true } })
      if (ownerFloor?.userId !== input.actorUserId) return deny(403, 'NOT_ALLOWED')
      const before = await resolveToolUnionScope(input, tx)
      const future = await resolveToolUnionScope(input, tx, { ignoreExplicitLink: true })
      // Ambiguous/transferred ownership must not invent an unlicensed payer.
      if ((before.enabled && !('scope' in before)) || (future.enabled && !('scope' in future))) return deny(503, 'SEAT_CAPACITY_UNAVAILABLE')
      const scopes = [before, future].flatMap(value => value.enabled && 'scope' in value ? [value.scope] : [])
      const fences = [...new Set(scopes.map(scope => scope.fenceKey))].sort()
      const execute = async (): Promise<CompanyToolUnlinkDecision> => {
        const initialCompany = await tx.accountCompany.findUnique({ where: { id: input.companyId }, select: { userId: true } })
        if (!initialCompany) return deny(403, 'NOT_ALLOWED')
        const users = [...new Set([input.actorUserId, initialCompany.userId, ...scopes.map(scope => scope.ownerUserId)])].sort()
        const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "User" WHERE id IN (' + users.map((_, i) => '$' + (i + 1)).join(',') + ') ORDER BY id FOR UPDATE', ...users)
        if (locked.length !== users.length) return deny(409, 'SEAT_CONTEXT_CHANGED')
        const companies = [...new Set([input.companyId, ...scopes.flatMap(scope => scope.companyId ? [scope.companyId] : [])])].sort()
        await tx.$queryRawUnsafe('SELECT id FROM account_companies WHERE id IN (' + companies.map((_, i) => '$' + (i + 1)).join(',') + ') ORDER BY id FOR UPDATE', ...companies)
        const company = await tx.accountCompany.findUnique({ where: { id: input.companyId }, select: { userId: true } })
        if (!company || company.userId !== input.actorUserId) return deny(403, 'NOT_ALLOWED')
        const orgs = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "' + tables[input.tool] + '" WHERE id=$1 FOR UPDATE', input.organizationId)
        const link = await tx.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } }, select: { companyId: true } })
        if (orgs.length !== 1 || link?.companyId !== input.companyId) return deny(404, 'NOT_FOUND')
        if (toolUnionScopeIdentity(await resolveToolUnionScope(input, tx)) !== toolUnionScopeIdentity(before) ||
            toolUnionScopeIdentity(await resolveToolUnionScope(input, tx, { ignoreExplicitLink: true })) !== toolUnionScopeIdentity(future)) return deny(409, 'SEAT_CONTEXT_CHANGED')
        const write = async (): Promise<CompanyToolUnlinkDecision> => {
          await suppressAutomaticLink(tx, input.companyId, input.tool, input.organizationId)
          await tx.accountCompanyToolOrg.delete({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } } })
          const after = await resolveToolUnionScope(input, tx)
          if (toolUnionScopeIdentity(after) !== toolUnionScopeIdentity(future)) return deny(409, 'SEAT_CONTEXT_CHANGED')
          if (after.enabled && 'scope' in after) {
            const license = await readToolUnionLicense(after.scope, tx)
            if (license.used > license.limit) return deny(409, 'SEAT_CAPACITY_EXCEEDED')
          }
          if (options.onUnlinked) await options.onUnlinked(tx)
          return { ok: true }
        }
        // Admission verifies any financial claim/cache without refreshing it.
        // Include source as well as destination; malformed/busy claims stay intact.
        const admissions = [...new Set(scopes.flatMap(scope => scope.companyId ? [scope.companyId] : []))].sort()
        const admitted = (index: number): Promise<CompanyToolUnlinkDecision> => index === admissions.length
          ? write() : withSeatAdmissionInTransaction(admissions[index], tx, () => admitted(index + 1))
        return admitted(0)
      }
      const fenced = (index: number): Promise<CompanyToolUnlinkDecision> => index === fences.length
        ? execute() : withSeatContextInTransaction(fences[index], tx, () => fenced(index + 1))
      return fenced(0)
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 })
  } catch (error) {
    if (error instanceof UnlinkDenied) return { ok: false, status: error.status, code: error.code }
    if (error instanceof SeatOperationError) return { ok: false, status: error.code === 'SEAT_OPERATION_BUSY' ? 409 : 503, code: error.code === 'SEAT_OPERATION_BUSY' ? 'SEAT_OPERATION_BUSY' : 'SEAT_CAPACITY_UNAVAILABLE' }
    if (error instanceof ToolUnionScopeError) return { ok: false, status: error.code === 'SEAT_CONTEXT_CHANGED' ? 409 : 503, code: error.code }
    if ((error as { code?: string }).code === 'P2034') return { ok: false, status: 409, code: 'SEAT_CONTEXT_CHANGED' }
    throw error
  }
}
