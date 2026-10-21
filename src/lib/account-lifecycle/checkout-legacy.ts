import { checkoutDigest, exactCheckoutObject, sessionIdValid, sealedCheckoutRequest, type CheckoutRequest } from './checkout-receipt'
import { LifecycleError } from './state'

export type LegacyCheckoutClassification = { version: 1; keyHash: string; rawHash: string | null; targetHash: string; mode: 'test' | 'live'; classification: 'absent_unproven_drain' | 'creating_needs_review' | 'ready_needs_exact_provider' | 'malformed_needs_review'; sessionId: string | null; legacyKeyHash: string | null }
// Classification is deliberately pure. It never deletes v1 data, grants admission, expires a lease or sends a provider request.
export function classifyLegacyV1(input: { key: string; raw: string | null; userId: string; targetHash: string; mode: 'test' | 'live' }): LegacyCheckoutClassification {
  const base = { version: 1 as const, keyHash: checkoutDigest(input.key), rawHash: input.raw === null ? null : checkoutDigest(input.raw), targetHash: input.targetHash, mode: input.mode, sessionId: null, legacyKeyHash: null }
  if (input.key !== `checkout-reservation:v1:${input.mode}:${input.userId}` || !['test', 'live'].includes(input.mode)) return { ...base, classification: 'malformed_needs_review' }
  if (input.raw === null) return { ...base, classification: 'absent_unproven_drain' }
  try {
    const p: unknown = JSON.parse(input.raw)
    if (exactCheckoutObject(p, 'phase,signature,idempotencyKey,createdAt,leaseUntil,expiresAt') && p.phase === 'creating' && typeof p.signature === 'string' && typeof p.idempotencyKey === 'string' && Number.isSafeInteger(p.createdAt) && Number.isSafeInteger(p.leaseUntil) && Number.isSafeInteger(p.expiresAt)) return { ...base, classification: 'creating_needs_review', legacyKeyHash: checkoutDigest(p.idempotencyKey) }
    if (exactCheckoutObject(p, 'phase,signature,sessionId,url,expiresAt') && p.phase === 'ready' && typeof p.signature === 'string' && sessionIdValid(p.sessionId) && typeof p.url === 'string' && Number.isSafeInteger(p.expiresAt)) return { ...base, classification: 'ready_needs_exact_provider', sessionId: p.sessionId }
  } catch { /* Keep the original value for explicit review. */ }
  return { ...base, classification: 'malformed_needs_review' }
}

export type LegacySignatureParts =
  | { priceId: string; planId: string; service: string; email: string; successUrl: string; cancelUrl: string; trialDays?: number }
  | { priceId: string; plan: 'starter' | 'pro' | 'enterprise'; interval: 'monthly' | 'yearly'; stripeCustomerId: string; baseUrl: string }
const signatureMismatch = (): never => { throw new LifecycleError('CHECKOUT_LEGACY_SIGNATURE_MISMATCH') }

/** Reconstruct the exact v1 route signature; the caller cannot supply an opaque hash as authority. */
export function verifiedLegacySignature(request: CheckoutRequest, parts: LegacySignatureParts): string {
  const plan = sealedCheckoutRequest(request)
  if (request.source === 'generic') {
    if (!(exactCheckoutObject(parts, 'priceId,planId,service,email,successUrl,cancelUrl,trialDays') || exactCheckoutObject(parts, 'priceId,planId,service,email,successUrl,cancelUrl')) ||
      !('service' in parts) || parts.priceId !== plan.priceId || parts.planId !== plan.planId || parts.service !== plan.serviceId || parts.email !== request.terms.email ||
      parts.successUrl !== request.terms.successUrl || parts.cancelUrl !== request.terms.cancelUrl || parts.trialDays !== (request.terms.trialDays || undefined) || plan.customerMode !== 'implicit') return signatureMismatch()
  } else {
    if (!exactCheckoutObject(parts, 'priceId,plan,interval,stripeCustomerId,baseUrl') || !('plan' in parts) ||
      !['starter', 'pro', 'enterprise'].includes(parts.plan) || !['monthly', 'yearly'].includes(parts.interval) || parts.priceId !== plan.priceId ||
      plan.planId !== `hr-${parts.plan}` || plan.serviceId !== 'hr' || plan.customerMode !== 'reuse' || parts.stripeCustomerId !== plan.customerId || plan.trialDays !== 0 ||
      request.terms.successUrl !== `${parts.baseUrl}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}` ||
      request.terms.cancelUrl !== `${parts.baseUrl}/hr/settings/billing`) return signatureMismatch()
  }
  // v1 hashed JSON.stringify of the route's literal property order.
  return request.source === 'generic'
    ? checkoutDigest({ priceId: plan.priceId, planId: plan.planId, service: plan.serviceId, email: request.terms.email, successUrl: request.terms.successUrl, cancelUrl: request.terms.cancelUrl, trialDays: request.terms.trialDays || undefined })
    : checkoutDigest({ priceId: plan.priceId, plan: (parts as Extract<LegacySignatureParts, { plan: string }>).plan, interval: (parts as Extract<LegacySignatureParts, { plan: string }>).interval, stripeCustomerId: plan.customerId, baseUrl: (parts as Extract<LegacySignatureParts, { plan: string }>).baseUrl })
}
