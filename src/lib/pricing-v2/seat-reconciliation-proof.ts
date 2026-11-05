import type { SeatOperationClaim } from './seat-operation'

export type SeatReconciliationFailure =
  | 'NOT_STRIPE_PENDING' | 'INVALID_TIME' | 'EVENT_MISMATCH' | 'SUBSCRIPTION_MISMATCH'
  | 'PREVIOUS_QUANTITY_NOT_PROVEN' | 'QUANTITY_MISMATCH' | 'PAYMENT_PROOF_REQUIRED' | 'PAYMENT_NOT_PROVEN'
export type SeatReconciliationProof =
  | { ok: true; eventId: string; invoiceId: string | null }
  | { ok: false; reason: SeatReconciliationFailure }

const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const number = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function id(value: unknown): string | null {
  const text = typeof value === 'string' ? value : object(value)?.id
  return typeof text === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null
}
function closedList(value: unknown): Record<string, unknown>[] | null {
  const list = object(value)
  if (!list || list.has_more !== false || !Array.isArray(list.data)) return null
  const rows = list.data.map(object)
  return rows.every((row): row is Record<string, unknown> => row !== null) ? rows : null
}
function seatItem(subscription: Record<string, unknown>, itemId: string, priceId: string) {
  const items = closedList(subscription.items)
  if (!items) return null
  const matches = items.filter(item => id(item.id) === itemId)
  if (matches.length !== 1 || id(matches[0].price) !== priceId || object(matches[0].price)?.currency !== 'jpy') return null
  return matches[0]
}
const alive = (subscription: Record<string, unknown>) => ['active', 'past_due'].includes(String(subscription.status)) && subscription.pending_update === null

/** Pure validation of trusted server-side Stripe GET responses. Never accept
 * these objects from an HTTP request as evidence. Missing data is uncertainty,
 * not a declined payment. This function does not authorize a Stripe mutation.
 * The response shapes match this repository's pinned 2023-10-16 Stripe API.
 */
export function classifySeatReconciliation(input: {
  claim: SeatOperationClaim
  event: unknown
  subscription: unknown
  invoice?: unknown
  seatPriceId: string
  now: number
}): SeatReconciliationProof {
  const active = input.claim.active
  if (active.phase !== 'stripe') return { ok: false, reason: 'NOT_STRIPE_PENDING' }
  if (!number(input.now) || !number(active.firstSentAt) || input.now < active.firstSentAt) return { ok: false, reason: 'INVALID_TIME' }
  const request = active.request, event = object(input.event), current = object(input.subscription)
  const snapshot = object(object(event?.data)?.object)
  if (!event || event.object !== 'event' || typeof event.id !== 'string' || !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    event.type !== 'customer.subscription.updated' || (event.account !== undefined && event.account !== null) ||
    object(event.request)?.idempotency_key !== active.idempotencyKey || !number(event.created) ||
    event.created < Math.floor(active.firstSentAt / 1000) - 1 || event.created > Math.floor(input.now / 1000) + 5 ||
    // The app only issues/retries this mutation in its original 20h window.
    // A key reused after Stripe has pruned it must not prove this old operation.
    event.created > Math.floor(active.firstSentAt / 1000) + 20 * 60 * 60) {
    return { ok: false, reason: 'EVENT_MISMATCH' }
  }
  if (!current || !snapshot || current.object !== 'subscription' || snapshot.object !== 'subscription' ||
    id(current.id) !== request.subscriptionId || id(snapshot.id) !== request.subscriptionId ||
    typeof current.livemode !== 'boolean' || event.livemode !== current.livemode || snapshot.livemode !== current.livemode ||
    !id(current.customer) || id(snapshot.customer) !== id(current.customer) || !alive(current) || !alive(snapshot)) {
    return { ok: false, reason: 'SUBSCRIPTION_MISMATCH' }
  }
  const previous = object(object(object(event.data)?.previous_attributes)?.items)?.data
  const previousItems = Array.isArray(previous) ? previous.map(object).filter(row => row && id(row.id) === request.seatItemId) : []
  if (previousItems.length !== 1 || previousItems[0]?.quantity !== request.from) return { ok: false, reason: 'PREVIOUS_QUANTITY_NOT_PROVEN' }
  const originalItem = seatItem(snapshot, request.seatItemId, input.seatPriceId)
  const currentItem = seatItem(current, request.seatItemId, input.seatPriceId)
  if (!originalItem || !currentItem || originalItem.quantity !== request.to || currentItem.quantity !== request.to) return { ok: false, reason: 'QUANTITY_MISMATCH' }
  if (request.direction === 'down') return { ok: true, eventId: event.id, invoiceId: null }
  const invoiceId = id(snapshot.latest_invoice)
  if (!invoiceId || !invoiceId.startsWith('in_') || !input.invoice) return { ok: false, reason: 'PAYMENT_PROOF_REQUIRED' }
  const invoice = object(input.invoice), lines = closedList(invoice?.lines)
  if (!invoice || invoice.object !== 'invoice' || id(invoice.id) !== invoiceId ||
    id(invoice.subscription) !== request.subscriptionId || id(invoice.customer) !== id(current.customer) ||
    invoice.livemode !== current.livemode || invoice.currency !== 'jpy' ||
    invoice.billing_reason !== 'subscription_update' || invoice.status !== 'paid' || invoice.paid !== true ||
    invoice.amount_remaining !== 0 || !number(invoice.amount_paid) || !number(invoice.created) ||
    invoice.created < Math.floor(active.firstSentAt / 1000) - 1 || invoice.created > event.created + 5 ||
    !lines || !lines.some(line => id(line.subscription_item) === request.seatItemId &&
      id(line.subscription) === request.subscriptionId && id(line.price) === input.seatPriceId &&
      line.proration === true && number(line.amount) && line.currency === 'jpy' && line.livemode === current.livemode)) {
    return { ok: false, reason: 'PAYMENT_NOT_PROVEN' }
  }
  return { ok: true, eventId: event.id, invoiceId }
}
