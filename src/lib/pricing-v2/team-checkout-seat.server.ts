import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createReservedCheckoutSession } from '@/lib/checkout-reservation'
import { collectCompanySeatEntries, collectPersonalOwnerSeatEntries } from './company-seat-entries.server'
import { readCompanySeatUsageUsers } from './company-seat-usage-users.server'
import { checkoutSeatReservationKey, readCheckoutSeatLimit } from './checkout-seat-capacity.server'
import { SeatOperationError, withSeatAdmissionInTransaction } from './seat-operation'
import { subscriberKind } from './view'
import { newPricingPriceIds } from './prices'

export class TeamCheckoutSeatError extends Error {
  constructor(public readonly code: 'BELOW_USED' | 'SEAT_CONTEXT_CHANGED' | 'CHECKOUT_CAPACITY_RECONCILE' | 'ALREADY_ON_TEAM' | 'LEGACY_KEEPS_PRICE' | 'SEAT_CAPACITY_UNAVAILABLE' | 'SEAT_OPERATION_BUSY', public readonly used: number | null = null) { super(code) }
}

/** Stable owner scope survives profile registration. Same virtual-owner guard
 * as tool admission, followed by the real company guard when one exists.
 * Provider work must occur only after this SQL transaction returns. */
async function withOwnerScope<T>(ownerUserId: string, db: PrismaClient, work: (tx: Prisma.TransactionClient, companyId: string | null) => Promise<T>): Promise<T> {
  if (!ownerUserId) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
  const ownerFence = 'owner-scope-v1_' + createHash('sha256').update(ownerUserId).digest('hex')
  return db.$transaction(tx => withSeatAdmissionInTransaction(ownerFence, tx, async () => {
    const initial = await tx.accountCompany.findUnique({ where: { userId: ownerUserId }, select: { id: true } })
    const execute = async () => {
      const owners = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', ownerUserId)
      if (owners.length !== 1) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      const current = await tx.accountCompany.findUnique({ where: { userId: ownerUserId }, select: { id: true } })
      if ((current?.id ?? null) !== (initial?.id ?? null)) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      if (current) {
        const companies = await tx.$queryRawUnsafe<Array<{ userId: string }>>('SELECT "userId" FROM account_companies WHERE id=$1 FOR UPDATE', current.id)
        if (companies.length !== 1 || companies[0].userId !== ownerUserId) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      }
      return work(tx, current?.id ?? null)
    }
    return initial ? withSeatAdmissionInTransaction(initial.id, tx, execute) : execute()
  }), { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 })
}

export async function createTeamSeatCheckout<T extends { id: string; url: string | null; expires_at?: number }>(options: {
  userId: string; seats: number; ownerEmail: string; signatureParts: unknown
  create: (idempotencyKey: string, expiresAt: number) => Promise<T>
}, db: PrismaClient = prisma) {
  return createReservedCheckoutSession({
    ...options, teamSeats: options.seats,
    reservePreparing: async input => { try { return await withOwnerScope(options.userId, db, async (tx, companyId) => {
      if (input.key !== checkoutSeatReservationKey(options.userId)) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      const owner = await tx.user.findUnique({ where: { id: options.userId }, select: { plan: true, stripePriceId: true, email: true } })
      if (!owner || !owner.email || owner.email.trim().toLowerCase() !== options.ownerEmail.trim().toLowerCase()) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      const kind = subscriberKind({ ...owner, newPriceIds: newPricingPriceIds() })
      if (kind !== 'none') throw new TeamCheckoutSeatError(kind === 'team' ? 'ALREADY_ON_TEAM' : 'LEGACY_KEEPS_PRICE')
      const next = JSON.parse(input.value) as Record<string, unknown>
      if (next.phase !== 'creating' || next.teamSeats !== options.seats) throw new TeamCheckoutSeatError('CHECKOUT_CAPACITY_RECONCILE')
      if (input.previousValue !== null) {
        const previous = JSON.parse(input.previousValue) as Record<string, unknown>
        // An unknown create outcome cannot become a different/new request merely
        // because a clock expired. Preserve its exact quantity and idempotency key.
        if (previous.phase === 'creating' && (previous.idempotencyKey !== next.idempotencyKey || previous.teamSeats !== next.teamSeats)) throw new TeamCheckoutSeatError('CHECKOUT_CAPACITY_RECONCILE')
      }
      const now = new Date()
      const entries = companyId ? await collectCompanySeatEntries(tx, companyId, now) : await collectPersonalOwnerSeatEntries(tx, options.userId, now)
      if (entries.ownerUserId !== options.userId) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
      const usage = await readCompanySeatUsageUsers(tx, { ...entries, now })
      if (usage.used > options.seats) throw new TeamCheckoutSeatError('BELOW_USED', usage.used)
      if (input.previousValue !== null) {
        const changed = await tx.systemSetting.updateMany({ where: { key: input.key, value: input.previousValue }, data: { value: input.value } })
        return changed.count === 1
      }
      // The owner guard serializes competing new team requests. Check under
      // this guard before create instead of swallowing a transaction-aborting
      // unique error inside the SQL transaction.
      if (await tx.systemSetting.findUnique({ where: { key: input.key } })) return false
      await tx.systemSetting.create({ data: { key: input.key, value: input.value } })
      return true
    }) } catch (error) {
      if (error instanceof TeamCheckoutSeatError) throw error
      if (error instanceof SeatOperationError) throw new TeamCheckoutSeatError('SEAT_OPERATION_BUSY')
      throw new TeamCheckoutSeatError('SEAT_CAPACITY_UNAVAILABLE')
    } },
  }, db)
}

/** Trusted server provider port, never client-supplied expiry proof. A browser
 * cancel navigation or local expiry cannot release a potentially paid session.
 * Unknown creating outcomes remain blocked for explicit reconciliation. */
export async function releaseVerifiedExpiredCheckoutCapacity(ownerUserId: string,
  retrieve: (sessionId: string) => Promise<{ id: string; status: string | null }>, db: PrismaClient = prisma) {
  const key = checkoutSeatReservationKey(ownerUserId)
  const row = await db.systemSetting.findUnique({ where: { key } })
  if (!row) return false
  const state = JSON.parse(row.value) as Record<string, unknown>
  if (state.phase !== 'ready' || typeof state.sessionId !== 'string') throw new TeamCheckoutSeatError('CHECKOUT_CAPACITY_RECONCILE')
  const remote = await retrieve(state.sessionId)
  if (remote.id !== state.sessionId || remote.status !== 'expired') return false
  return withOwnerScope(ownerUserId, db, async tx => {
    const changed = await tx.systemSetting.updateMany({ where: { key, value: row.value }, data: { value: JSON.stringify({ ...state, seatCapacityReleased: true }) } })
    return changed.count === 1
  })
}


/** A provider-open URL is returned only for the still-current owned reservation
 * whose requested seats cover the actual union. The provider lookup precedes
 * this transaction; no remote request runs while SQL locks are held. */
export async function verifyReadyCheckoutForResume(input: {
  ownerUserId: string; expectedEmail: string; reservationValue: string
}, db: PrismaClient = prisma) {
  return withOwnerScope(input.ownerUserId, db, async (tx, companyId) => {
    const current = await tx.systemSetting.findUnique({ where: { key: checkoutSeatReservationKey(input.ownerUserId) } })
    if (!current || current.value !== input.reservationValue) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
    const owner = await tx.user.findUnique({ where: { id: input.ownerUserId }, select: { email: true, plan: true, stripePriceId: true } })
    if (!owner?.email || owner.email.trim().toLowerCase() !== input.expectedEmail.trim().toLowerCase()) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
    const kind = subscriberKind({ ...owner, newPriceIds: newPricingPriceIds() })
    if (kind !== 'none') throw new TeamCheckoutSeatError(kind === 'team' ? 'ALREADY_ON_TEAM' : 'LEGACY_KEEPS_PRICE')
    let seats: number | null
    try { seats = await readCheckoutSeatLimit(tx, input.ownerUserId) }
    catch { throw new TeamCheckoutSeatError('CHECKOUT_CAPACITY_RECONCILE') }
    if (seats === null) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
    const now = new Date()
    const entries = companyId ? await collectCompanySeatEntries(tx, companyId, now) : await collectPersonalOwnerSeatEntries(tx, input.ownerUserId, now)
    if (entries.ownerUserId !== input.ownerUserId) throw new TeamCheckoutSeatError('SEAT_CONTEXT_CHANGED')
    const usage = await readCompanySeatUsageUsers(tx, { ...entries, now })
    if (usage.used > seats) throw new TeamCheckoutSeatError('BELOW_USED', usage.used)
    return seats
  })
}
