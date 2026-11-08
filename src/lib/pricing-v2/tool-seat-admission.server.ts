import { ceilToolRole } from '@/lib/company-roles/access.server'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TOOL_ROLE_TABLES, type ToolId } from '@/lib/company-roles/tool-roles'
import { resolveToolUnionScope, toolUnionScopeIdentity, readToolUnionLicense, ToolUnionScopeError, type ResolvedToolUnionScope, type ToolUnionScope } from './tool-seat-union-scope.server'
import { SeatOperationError, withSeatAdmissionInTransaction } from './seat-operation'

type FailureCode = 'OPERATING_ROLE_REQUIRED' | 'INVALID_TOOL_MEMBERSHIP' | 'COMPANY_MEMBERSHIP_REQUIRED' | 'COMPANY_JOIN_REQUIRED' | 'COMPANY_SETUP_REQUIRED' | 'SEAT_CAPACITY_UNAVAILABLE' | 'SEAT_CAPACITY_EXCEEDED' | 'SEAT_CONTEXT_CHANGED' | 'SEAT_OPERATION_BUSY'
type Action = 'contact-owner' | 'join-company' | 'retry' | 'increase-seats'
export type ToolSeatAdmissionInput = { tool: ToolId; organizationId: string; actorUserId: string; additionalUserIds?: readonly string[] }
export class ToolSeatAdmissionError extends Error {
  constructor(public readonly status: 403 | 409 | 503, public readonly code: FailureCode, public readonly action: Action) { super(code) }
}

/** Compatibility responses never offer automatic purchasing to a member.
 * This guard does not require central company membership or auto-enroll anyone.
 */
export function toolSeatAdmissionFailure(error: unknown) {
  if (!(error instanceof ToolSeatAdmissionError)) return null
  const action = error.action === 'increase-seats' ? 'contact-owner' : error.action
  const message = error.code === 'OPERATING_ROLE_REQUIRED'
    ? '会社の現在の権限では操作メンバーとして参加できません。会社のオーナーに権限の確認を依頼してください。'
    : error.code === 'COMPANY_JOIN_REQUIRED'
    ? '会社への参加が必要です。会社の招待をご確認ください。'
    : error.code === 'SEAT_CAPACITY_EXCEEDED'
      ? '会社の購入人数を超えています。会社のオーナーに人数の確認を依頼してください。'
      : error.status === 503
        ? '会社の購入人数を確認できません。時間をおいて、もう一度お試しください。'
        : action === 'retry'
          ? '会社の人数や所属を確認中です。時間をおいて、もう一度お試しください。'
          : '会社の所属や設定の確認が必要です。会社のオーナーに確認を依頼してください。'
  return { status: error.status, body: { error: message, code: error.code, action } }
}

function requireScope(resolved: ResolvedToolUnionScope): ToolUnionScope {
  if (!resolved.enabled || !('scope' in resolved)) {
    if (resolved.enabled && resolved.error === 'setup-required') throw new ToolSeatAdmissionError(403, 'COMPANY_SETUP_REQUIRED', 'contact-owner')
    throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
  }
  return resolved.scope
}

export async function pinToolSeatPrincipals(tx: Prisma.TransactionClient, scope: ToolUnionScope, actorUserId: string, additionalUserIds: readonly string[] = []) {
  const ids = [...new Set([scope.ownerUserId, actorUserId, ...additionalUserIds])].sort()
  const rows = await tx.$queryRaw<Array<{ id: string }>>
    `SELECT id FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`
  if (!rows.some(row => row.id === actorUserId)) throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
  if (!rows.some(row => row.id === scope.ownerUserId)) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
  if (additionalUserIds.some(id => !rows.some(row => row.id === id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
  // User rows precede Company and organization rows. Pinning an unregistered
  // owner also serializes an AccountCompany insertion's normal FK check.
  if (scope.companyId) {
    const companies = await tx.$queryRaw<Array<{ id: string }>>
      `SELECT id FROM account_companies WHERE id = ${scope.companyId} FOR UPDATE`
    if (companies.length !== 1) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
  }
}

/** SQL-only composition point. Invoke before taking domain/User row locks.
 * Lock order: shared company/virtual-owner fence -> sorted User rows -> real
 * Company row -> domain organization/role/invitation locks. authorizeDomain
 * must validate current domain authority and return a server-resolved role;
 * additions made for another account must include its server-resolved User ID
 * in additionalUserIds, and validate the recipient/email/ceiling in the callback.
 * work may do only transactional SQL. No automatic seat purchase, profile,
 * central membership or User.plan creation occurs here.
 *
 * Existing operation/context/role/link/profile/User writers and all11 callers
 * still need the same order; this helper alone is not full integration.
 */
export async function withToolSeatAdmissionInTransaction<T, Domain>(
  input: ToolSeatAdmissionInput,
  tx: Prisma.TransactionClient,
  authorizeDomain: (tx: Prisma.TransactionClient) => Promise<{ role: string; value: Domain }>,
  work: (tx: Prisma.TransactionClient, domain: Domain) => Promise<T>,
): Promise<T> {
  if (!input.actorUserId || !input.organizationId || !Object.prototype.hasOwnProperty.call(TOOL_ROLE_TABLES, input.tool)) {
    throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
  }
  if (input.additionalUserIds !== undefined && (!Array.isArray(input.additionalUserIds) || input.additionalUserIds.length > 8 || input.additionalUserIds.some(id => typeof id !== 'string' || !id.trim()))) {
    throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
  }
  const initial = await resolveToolUnionScope(input, tx)
  let executeEntered = false, executeCompleted = false
  const execute = async () => {
    executeEntered = true
    if (initial.enabled && 'scope' in initial) {
      await pinToolSeatPrincipals(tx, initial.scope, input.actorUserId, input.additionalUserIds)
      const pinned = await resolveToolUnionScope(input, tx)
      if (toolUnionScopeIdentity(pinned) !== toolUnionScopeIdentity(initial)) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
    }
    // Company authority is read before the callback locks its domain org.
    // The real role server pins current User/Company/Link/role rows in this tx.
    const companyCeiling = initial.enabled && 'scope' in initial
      ? await ceilToolRole({ tool: input.tool, organizationId: input.organizationId, userId: input.actorUserId,
        toolRole: TOOL_ROLE_TABLES[input.tool].order[TOOL_ROLE_TABLES[input.tool].order.length - 1] }, tx)
      : undefined
    const domain = await authorizeDomain(tx)
    if (!initial.enabled) return work(tx, domain.value)
    const roles = TOOL_ROLE_TABLES[input.tool].order
    if (!roles.includes(domain.role)) throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
    // Sharing and service limits remain the domain callback's responsibility.
    if (input.tool === 'promane' && domain.role === 'guest') return work(tx, domain.value)
    if (companyCeiling === null || companyCeiling === 'guest') throw new ToolSeatAdmissionError(403, 'OPERATING_ROLE_REQUIRED', 'contact-owner')
    const scope = requireScope(initial)
    const current = await resolveToolUnionScope(input, tx)
    if (toolUnionScopeIdentity(current) !== toolUnionScopeIdentity(initial)) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
    // New admissions/reservations are strict for owners too. Existing reads
    // and decrease-only revocations require their separate operation policy.
    const before = await readToolUnionLicense(scope, tx)
    if (before.used > before.limit) throw new ToolSeatAdmissionError(409, 'SEAT_CAPACITY_EXCEEDED', 'contact-owner')
    const result = await work(tx, domain.value)
    const final = await resolveToolUnionScope(input, tx)
    if (toolUnionScopeIdentity(final) !== toolUnionScopeIdentity(initial)) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
    // Count the actual persisted membership/invitation result before commit.
    // A denial throws and rolls back business writes and invitation claiming.
    const after = await readToolUnionLicense(scope, tx)
    if (after.used > after.limit) throw new ToolSeatAdmissionError(409, 'SEAT_CAPACITY_EXCEEDED', 'contact-owner')
    return result
  }
  try {
    if (initial.enabled && 'scope' in initial) return await withSeatAdmissionInTransaction(initial.scope.fenceKey, tx, async () => {
      const result = await execute(); executeCompleted = true; return result
    })
    return await execute()
  } catch (error) {
    if (error instanceof ToolUnionScopeError) throw new ToolSeatAdmissionError(error.code === 'SEAT_CONTEXT_CHANGED' ? 409 : 503, error.code, 'retry')
    if (error instanceof SeatOperationError && error.code === 'SEAT_OPERATION_BUSY') throw new ToolSeatAdmissionError(409, 'SEAT_OPERATION_BUSY', 'retry')
    if ((!executeEntered || executeCompleted) && !(error instanceof ToolSeatAdmissionError)) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
    throw error
  }
}

export async function withToolSeatAdmission<T, Domain>(
  input: ToolSeatAdmissionInput,
  authorizeDomain: (tx: Prisma.TransactionClient) => Promise<{ role: string; value: Domain }>,
  work: (tx: Prisma.TransactionClient, domain: Domain) => Promise<T>,
  db: Pick<PrismaClient, '$transaction'> = prisma,
): Promise<T> {
  try {
    return await db.$transaction(tx => withToolSeatAdmissionInTransaction(input, tx, authorizeDomain, work), {
      isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000,
    })
  } catch (error) {
    const sqlError = error as { code?: string; meta?: { code?: string } }
    if (sqlError?.code === 'P2034' || sqlError?.code === 'P2010' && ['40001', '40P01'].includes(sqlError.meta?.code ?? '')) {
      throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
    }
    throw error
  }
}
