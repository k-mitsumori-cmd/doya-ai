import { prisma } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions } from '@/lib/stripe'
import { billingRedirectUrl } from '@/lib/billing-response-client'
import { checkoutSeatReservationKey, checkoutSeatLimitFromValue } from './checkout-seat-capacity.server'
import { releaseVerifiedExpiredCheckoutCapacity, verifyReadyCheckoutForResume } from './team-checkout-seat.server'
import type { CheckoutRecoveryView } from './checkout-recovery-view'

type Owner = { id: string; email: string; stripeCustomerId: string | null }
async function snapshot(ownerUserId: string) {
  const row = await prisma.systemSetting.findUnique({ where: { key: checkoutSeatReservationKey(ownerUserId) } })
  if (!row) return null
  const state: unknown = JSON.parse(row.value)
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Checkout reservation unavailable')
  const s = state as Record<string, unknown>
  if ((s.phase !== 'ready' && s.phase !== 'creating') || typeof s.signature !== 'string' || !Number.isSafeInteger(s.expiresAt)) throw new Error('Checkout reservation unavailable')
  if (s.phase === 'ready' && (typeof s.sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{1,120}$/.test(s.sessionId))) throw new Error('Checkout reservation unavailable')
  let seats: number | null = null, bindingKnown = true
  try { seats = checkoutSeatLimitFromValue(row.value) } catch { bindingKnown = false }
  return { value: row.value, state: s, seats, bindingKnown }
}

/** GET is local-only and never treats a clock or browser cancel as expiry. */
export async function readCheckoutRecovery(ownerUserId: string): Promise<CheckoutRecoveryView> {
  const data = await snapshot(ownerUserId)
  if (!data) return { state: 'none', seats: null }
  if (!data.bindingKnown) return { state: 'reconcile', seats: null }
  if (data.state.seatCapacityReleased === true) return { state: 'expired', seats: data.seats }
  return { state: data.state.phase === 'creating' ? 'creating' : 'ready', seats: data.seats }
}

/** Only the authenticated owner is supplied by the HTTP boundary. Provider
 * reads occur outside SQL; expiry uses CAS and open links are revalidated
 * under owner/company locks. No Checkout, payment, plan or point creation. */
export async function checkCheckoutRecovery(owner: Owner): Promise<CheckoutRecoveryView> {
  const data = await snapshot(owner.id)
  if (!data) return { state: 'none', seats: null }
  if (data.state.seatCapacityReleased === true && data.bindingKnown) return { state: 'expired', seats: data.seats }
  if (data.state.phase === 'creating') return { state: data.bindingKnown ? 'creating' : 'reconcile', seats: data.seats }
  const sessionId = data.state.sessionId as string
  const remote = await stripe.checkout.sessions.retrieve(sessionId)
  if (remote.id !== sessionId) throw new Error('Checkout session identity unavailable')
  if (remote.status === 'expired') {
    const released = await releaseVerifiedExpiredCheckoutCapacity(owner.id, async () => ({ id: remote.id, status: remote.status }), prisma)
    return released ? { state: 'expired', seats: data.seats } : readCheckoutRecovery(owner.id)
  }
  const current = await prisma.systemSetting.findUnique({ where: { key: checkoutSeatReservationKey(owner.id) } })
  if (!current || current.value !== data.value) return readCheckoutRecovery(owner.id)
  if (remote.status === 'complete') return { state: 'complete', seats: data.seats }
  if (remote.status !== 'open') throw new Error('Checkout session state unavailable')
  if (!data.bindingKnown) return { state: 'reconcile', seats: null }
  // A locally stale plan must not reopen a payable second contract.
  const active = await findActiveLikeSubscriptions({ userId: owner.id, email: owner.email, stripeCustomerId: owner.stripeCustomerId })
  if (active.length) return { state: 'active', seats: data.seats }
  const seats = await verifyReadyCheckoutForResume({ ownerUserId: owner.id, expectedEmail: owner.email, reservationValue: data.value }, prisma)
  const url = billingRedirectUrl(remote.url)
  if (!url) throw new Error('Checkout URL unavailable')
  return { state: 'open', seats, url }
}
