import { Prisma } from '@prisma/client'
import { teamMembershipCapacity } from './team.server'
import { readCompanyOperatingSeatUsage } from './company-seat-minimum.server'
import { readCheckoutSeatLimit } from './checkout-seat-capacity.server'

export class CompanyMembershipSeatError extends Error {
  constructor(public readonly code: 'NO_SEAT' | 'OWNER_CHANGED') { super(code) }
}

/** Shared fence is acquired by the caller first; no provider work here.
 * Pin sorted principals before Company, matching tool admissions and quantity.
 */
export async function pinCompanyMembershipPrincipals(tx: Prisma.TransactionClient, input: {
  companyId: string; ownerUserId: string; actorUserId: string
}) {
  const ids = [...new Set([input.ownerUserId, input.actorUserId])].sort()
  const users = await tx.$queryRaw<Array<{ id: string; email: string | null }>>
    `SELECT id, email FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`
  if (users.length !== ids.length) throw new CompanyMembershipSeatError('OWNER_CHANGED')
  const companies = await tx.$queryRaw<Array<{ id: string; userId: string }>>
    `SELECT id, "userId" FROM account_companies WHERE id = ${input.companyId} FOR UPDATE`
  if (companies.length !== 1 || companies[0].userId !== input.ownerUserId) throw new CompanyMembershipSeatError('OWNER_CHANGED')
  return users.find(user => user.id === input.actorUserId)!
}

/** Caller supplies one snapshot or holds the company fence. Current persisted
 * tool + central identities determine usage; a free pending purchase may lower
 * capacity but cannot enlarge a free/legacy entitlement. */
export async function readCompanyMembershipLicense(tx: Prisma.TransactionClient, companyId: string) {
  const capacity = await teamMembershipCapacity(companyId, tx)
  const usage = await readCompanyOperatingSeatUsage(tx, companyId)
  const pending = capacity.kind === 'team' ? null : await readCheckoutSeatLimit(tx, capacity.ownerUserId)
  return { ...capacity, used: usage.used, limit: pending === null ? capacity.limit : Math.min(capacity.limit, pending) }
}

/** Throw after a tentative write so an over-capacity invitation/claim rolls
 * back with its token. Do not return an error Response after such a write. */
export function requireCompanyMembershipCapacity(value: { used: number; limit: number }) {
  if (value.used > value.limit) throw new CompanyMembershipSeatError('NO_SEAT')
}
