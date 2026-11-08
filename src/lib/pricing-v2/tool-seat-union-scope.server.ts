import { createHash } from 'node:crypto'
import { readCheckoutSeatLimit } from './checkout-seat-capacity.server'
import type { Prisma } from '@prisma/client'
import type { ToolId } from '@/lib/company-roles/tool-roles'
import { createToolSeatOwnershipReader } from './tool-seat-ownership.server'
import { teamMembershipCapacity } from './team.server'
import { memberLimit } from './team'
import { collectCompanySeatEntries, collectPersonalOwnerSeatEntries } from './company-seat-entries.server'
import { readCompanySeatUsageUsers } from './company-seat-usage-users.server'

export type ToolUnionScope = {
  companyId: string | null; ownerUserId: string; fenceKey: string
  kind: 'none' | 'legacy' | 'team'; attribution: 'linked-org' | 'current-owner-convention'
}
export type ResolvedToolUnionScope =
  | { enabled: false }
  | { enabled: true; scope: ToolUnionScope }
  | { enabled: true; error: 'setup-required' | 'unavailable' }

export class ToolUnionScopeError extends Error {
  constructor(public readonly code: 'SEAT_CONTEXT_CHANGED' | 'SEAT_CAPACITY_UNAVAILABLE') { super(code) }
}

/** Read-only scope resolution. Reuses only existing ownership/rollout ports,
 * never the superseded requirement to join central company membership. The
 * oldest-stored-member ownership convention is not immutable creator history.
 */
export async function resolveToolUnionScope(input: { tool: ToolId; organizationId: string }, tx: Prisma.TransactionClient): Promise<ResolvedToolUnionScope> {
  try {
    const reader = createToolSeatOwnershipReader(tx)
    if (!reader.globallyEnabled()) return { enabled: false }
    const link = await reader.findLink(input.tool, input.organizationId)
    if (link) {
      const company = await reader.findCompany(link.companyId)
      if (!company || company.id !== link.companyId) return { enabled: true, error: 'unavailable' }
      if (!reader.enabledForOwner(company.owner.email)) return { enabled: false }
      return { enabled: true, scope: { companyId: company.id, ownerUserId: company.owner.id,
        fenceKey: company.id, kind: company.owner.subscriberKind, attribution: 'linked-org' } }
    }
    const owner = await reader.findPersonalOwner(input.tool, input.organizationId)
    if (!owner) return { enabled: true, error: 'setup-required' }
    if (!reader.enabledForOwner(owner.email)) return { enabled: false }
    const own = await reader.findOwnedCompany(owner.id)
    if (own) {
      const company = await reader.findCompany(own.id)
      if (!company || company.owner.id !== owner.id) return { enabled: true, error: 'unavailable' }
      return { enabled: true, scope: { companyId: company.id, ownerUserId: owner.id,
        fenceKey: company.id, kind: company.owner.subscriberKind, attribution: 'current-owner-convention' } }
    }
    if (owner.subscriberKind === 'team') return { enabled: true, error: 'unavailable' }
    return { enabled: true, scope: { companyId: null, ownerUserId: owner.id,
      fenceKey: 'owner-scope-v1_' + createHash('sha256').update(owner.id).digest('hex'), kind: owner.subscriberKind, attribution: 'current-owner-convention' } }
  } catch { return { enabled: true, error: 'unavailable' } }
}

export function toolUnionScopeIdentity(value: ResolvedToolUnionScope) {
  if (!value.enabled) return 'off'
  if (!('scope' in value)) return 'error:' + value.error
  // An existing role resolver may materialize the same-payer link. Only a
  // real payer/owner/plan/fence change invalidates this guarded transaction.
  const { companyId, ownerUserId, fenceKey, kind } = value.scope
  return JSON.stringify({ companyId, ownerUserId, fenceKey, kind })
}

/** SQL-only actual union and strict capacity. Caller holds the scope fence and
 * pins/rechecks owner/profile and domain authority. Stripe/cache preparation
 * belongs outside this transaction; a missing/stale Team cache is unavailable.
 */
export async function readToolUnionLicense(scope: ToolUnionScope, tx: Prisma.TransactionClient, now = new Date()) {
  try {
    const data = scope.companyId
      ? await collectCompanySeatEntries(tx, scope.companyId, now)
      : await collectPersonalOwnerSeatEntries(tx, scope.ownerUserId, now)
    const usageScopeId = scope.companyId ?? 'personal-owner:' + scope.ownerUserId
    if (data.companyId !== usageScopeId || data.ownerUserId !== scope.ownerUserId || data.persistedCompany !== !!scope.companyId) {
      throw new ToolUnionScopeError('SEAT_CONTEXT_CHANGED')
    }
    const capacity = scope.companyId ? await teamMembershipCapacity(scope.companyId, tx)
      : { ownerUserId: scope.ownerUserId, kind: scope.kind, limit: memberLimit(scope.kind, null) }
    if (capacity.ownerUserId !== scope.ownerUserId || capacity.kind !== scope.kind) throw new ToolUnionScopeError('SEAT_CONTEXT_CHANGED')
    const usage = await readCompanySeatUsageUsers(tx, { ...data, now })
    const pendingLimit = scope.kind === 'team' ? null : await readCheckoutSeatLimit(tx, scope.ownerUserId)
    return { used: usage.used, limit: pendingLimit === null ? capacity.limit : Math.min(capacity.limit, pendingLimit) }
  } catch (error) {
    if (error instanceof ToolUnionScopeError) throw error
    throw new ToolUnionScopeError('SEAT_CAPACITY_UNAVAILABLE')
  }
}
