import type { Prisma } from '@prisma/client'

/** Same mode/user key as checkout-reservation. No provider calls or writes. */
export function checkoutSeatReservationKey(ownerUserId: string) {
  if (!ownerUserId) throw new Error('Checkout owner required')
  const mode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'
  return 'checkout-reservation:v1:' + mode + ':' + ownerUserId
}

/** Never release from a local clock: a completed or unknown session may have
 * paid before expiry. Only a verified remote expired-session CAS can mark a
 * ready reservation released. Fresh Team capacity supersedes this free-owner
 * restriction at the admission caller. Unknown legacy rows fail closed. */
export async function readCheckoutSeatLimit(tx: Pick<Prisma.TransactionClient, 'systemSetting'>, ownerUserId: string): Promise<number | null> {
  const row = await tx.systemSetting.findUnique({ where: { key: checkoutSeatReservationKey(ownerUserId) } })
  if (!row) return null
  return checkoutSeatLimitFromValue(row.value)
}

/** Parse the exact reservation snapshot already read by the caller. */
export function checkoutSeatLimitFromValue(value: string): number | null {
  const state: unknown = JSON.parse(value)
  if (!state || typeof state !== 'object') throw new Error('Checkout capacity unavailable')
  const s = state as Record<string, unknown>
  if ((s.phase !== 'ready' && s.phase !== 'creating') || typeof s.signature !== 'string' || !Number.isSafeInteger(s.expiresAt)) throw new Error('Checkout capacity unavailable')
  if (s.phase === 'ready' && s.seatCapacityReleased === true && typeof s.sessionId === 'string') return null
  if (!Number.isInteger(s.teamSeats) || Number(s.teamSeats) < 1 || Number(s.teamSeats) > 49 || s.seatCapacityReleased !== undefined) throw new Error('Checkout capacity unavailable')
  if (s.phase === 'ready' && (typeof s.sessionId !== 'string' || typeof s.url !== 'string')) throw new Error('Checkout capacity unavailable')
  if (s.phase === 'creating' && (typeof s.idempotencyKey !== 'string' || !Number.isSafeInteger(s.leaseUntil) || !Number.isSafeInteger(s.createdAt))) throw new Error('Checkout capacity unavailable')
  return Number(s.teamSeats)
}
