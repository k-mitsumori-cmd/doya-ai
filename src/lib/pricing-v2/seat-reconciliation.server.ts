import { stripe } from '@/lib/stripe'
import { monthlyGrantExpiresAt } from '@/lib/doya-power/rules'
import { teamPriceConfig } from './prices'
import type { SeatOperationClaim } from './seat-operation'
import { classifySeatReconciliation, type SeatReconciliationProof } from './seat-reconciliation-proof'

type StripeReads = {
  events: Pick<typeof stripe.events, 'list'>
  subscriptions: Pick<typeof stripe.subscriptions, 'retrieve'>
  invoices: Pick<typeof stripe.invoices, 'retrieve'>
}
export type SeatReconciliationRead =
  | { ready: true; proof: Extract<SeatReconciliationProof, { ok: true }>; getRequests: number }
  | { ready: false; reason: string; getRequests: number }

/** Read-only evidence retrieval. Call only after deriving the company and its
 * durable claim from the authenticated owner; never from body-supplied IDs or
 * proof objects. No Stripe create/update/delete capability is exposed here.
 * Missing events are not proof that an operation failed or was never charged.
 */
export async function readSeatReconciliationEvidence(claim: SeatOperationClaim, source: StripeReads = stripe, now = Date.now()): Promise<SeatReconciliationRead> {
  let getRequests = 0
  const fail = (reason: string): SeatReconciliationRead => ({ ready: false, reason, getRequests })
  const active = claim.active
  if (active.phase !== 'stripe') return fail('NOT_STRIPE_PENDING')
  if (!Number.isSafeInteger(now) || now < active.firstSentAt) return fail('INVALID_TIME')
  if (now - active.firstSentAt < 20 * 60 * 60_000 || now < active.leaseUntil) return fail('OPERATION_NOT_SETTLED')
  // Events API retains 30 days; use a conservative margin rather than infer
  // failure from an empty result outside the supported retrieval window.
  if (now - active.firstSentAt >= 29 * 24 * 60 * 60_000) return fail('EVENT_RETENTION_REVIEW_REQUIRED')
  if (active.request.grantPoints && monthlyGrantExpiresAt(new Date(active.request.pointsAt)).getTime() <= now) return fail('POINT_ENTITLEMENT_REVIEW_REQUIRED')
  const config = teamPriceConfig()
  if (!config.ok) return fail('PRICE_CONFIG_UNAVAILABLE')
  const seatPriceId = active.request.interval === 'year' ? config.seat.yearly : config.seat.monthly
  try {
    getRequests++
    const subscription = await source.subscriptions.retrieve(active.request.subscriptionId)
    let after: string | undefined
    const invoices = new Map<string, Awaited<ReturnType<StripeReads['invoices']['retrieve']>>>()
    let lastReason = 'NO_MATCHING_EVENT'
    for (let page = 0; page < 5; page++) {
      getRequests++
      const events = await source.events.list({
        type: 'customer.subscription.updated', limit: 100,
        created: { gte: Math.floor(active.firstSentAt / 1000) - 1, lte: Math.floor(active.firstSentAt / 1000) + 20 * 60 * 60 },
        ...(after ? { starting_after: after } : {}),
      })
      for (const event of events.data) {
        let proof = classifySeatReconciliation({ claim, event, subscription, seatPriceId, now })
        if (!proof.ok && proof.reason === 'PAYMENT_PROOF_REQUIRED') {
          const snapshot = event.data.object as { latest_invoice?: string | { id: string } | null }
          const value = snapshot.latest_invoice
          const invoiceId = typeof value === 'string' ? value : value?.id
          if (!invoiceId || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) { lastReason = 'PAYMENT_NOT_PROVEN'; continue }
          if (!invoices.has(invoiceId)) {
            if (invoices.size >= 2) return fail('INVOICE_SCAN_LIMIT')
            getRequests++
            invoices.set(invoiceId, await source.invoices.retrieve(invoiceId))
          }
          proof = classifySeatReconciliation({ claim, event, subscription, invoice: invoices.get(invoiceId), seatPriceId, now })
        }
        if (proof.ok) return { ready: true, proof, getRequests }
        if (proof.reason !== 'EVENT_MISMATCH') lastReason = proof.reason
      }
      if (!events.has_more) return fail(lastReason)
      if (!events.data.length) return fail('INVALID_EVENT_PAGE')
      after = events.data[events.data.length - 1].id
    }
    return fail('EVENT_SCAN_LIMIT')
  } catch {
    return fail('PROVIDER_UNAVAILABLE')
  }
}
