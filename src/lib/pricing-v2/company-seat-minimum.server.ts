import type { Prisma } from '@prisma/client'
import { collectCompanySeatEntries } from './company-seat-entries.server'
import { readCompanySeatUsageUsers } from './company-seat-usage-users.server'

export class CompanySeatMinimumError extends Error {
  constructor(public readonly code: 'BELOW_USED' | 'SEAT_CONTEXT_CHANGED', public readonly used: number | null = null) { super(code) }
}

/** Complete company/tool union. Caller supplies its SQL snapshot/guard.
 * No provider/cache/profile/member/link writes occur here. */
export async function readCompanyOperatingSeatUsage(tx: Prisma.TransactionClient, companyId: string, now = new Date()) {
  const collected = await collectCompanySeatEntries(tx, companyId, now)
  return readCompanySeatUsageUsers(tx, { ...collected, now })
}

/** Before a new immutable Stripe request: guard -> owner User -> Company.
 * Other membership/role/link/email writers still need the shared guard.
 * Already-sent retries preserve their original request/key. No network. */
export async function verifyCompanySeatMinimum(tx: Prisma.TransactionClient, input: {
  companyId: string; ownerUserId: string; requested: number
}) {
  if (!input.ownerUserId || !Number.isInteger(input.requested) || input.requested < 1 || input.requested > 49) throw new Error('Invalid seat minimum request')
  const owners = await tx.$queryRaw<Array<{ id: string }>>
    `SELECT id FROM "User" WHERE id = ${input.ownerUserId} FOR UPDATE`
  if (owners.length !== 1) throw new CompanySeatMinimumError('SEAT_CONTEXT_CHANGED')
  const companies = await tx.$queryRaw<Array<{ id: string; userId: string }>>
    `SELECT id, "userId" FROM account_companies WHERE id = ${input.companyId} FOR UPDATE`
  if (companies.length !== 1 || companies[0].userId !== input.ownerUserId) throw new CompanySeatMinimumError('SEAT_CONTEXT_CHANGED')
  const usage = await readCompanyOperatingSeatUsage(tx, input.companyId)
  if (usage.used > input.requested) throw new CompanySeatMinimumError('BELOW_USED', usage.used)
  return usage.used
}
