import { LifecycleError, type LifecycleClaim } from './state'
import { assertCheckoutClaim, checkoutDigest, checkoutPayloadDigest, customerIdValid, sessionIdValid, subscriptionIdValid, sealedCheckoutRequest, parseCheckoutDispatch, type CheckoutCapability, type CheckoutDispatch, type CheckoutPlan, type CheckoutRequest } from './checkout-receipt'
import { checkoutUrls } from './checkout-urls'

type Metadata = Record<string, string>
export type ProviderCustomer = { id: string; livemode: boolean; deleted?: boolean; email?: string | null; metadata: Metadata }
export type ProviderCheckout = { id: string; livemode: boolean; mode: string; status: string | null; client_reference_id: string | null; metadata: Metadata | null; customer: string | null; customer_email?: string | null; subscription: string | null; url: string | null; success_url?: string | null; cancel_url?: string | null; expires_at: number; line_items: { data: { quantity: number | null; price: { id: string } | null }[]; has_more?: boolean } }
export type CheckoutProvider = {
  createCustomer: (params: { email: string; name: string; metadata: Metadata }, options: { idempotencyKey: string }) => Promise<ProviderCustomer>
  retrieveCustomer: (id: string) => Promise<ProviderCustomer>
  createCheckout: (params: { mode: 'subscription'; customer: string | null; customer_email: string | null; priceId: string; trialDays: number; successUrl: string; cancelUrl: string; expiresAt: number; client_reference_id: string; metadata: Metadata }, options: { idempotencyKey: string }) => Promise<ProviderCheckout>
  retrieveCheckout: (id: string) => Promise<ProviderCheckout>
}
export type VerifiedCheckoutFact = { kind: 'customer' | 'checkout'; dispatch: CheckoutDispatch; resourceId: string; customerId: string | null; subscriptionId: string | null; status: 'created' | 'open' | 'complete' | 'expired'; expiresAt: number; url: string | null }
export type VerifiedCustomerReuse = { kind: 'reuse'; operationId: string; targetHash: string; inputDigest: string; customerId: string; mode: 'test' | 'live' }
export type VerifiedLegacyCheckout = { kind: 'legacy_checkout'; targetHash: string; inputDigest: string; mode: 'test' | 'live'; source: 'generic' | 'hr'; sessionId: string; customerId: string | null; subscriptionId: string | null; status: 'open' | 'complete' | 'expired'; url: string | null; expiresAt: number; rawHash: string; signature: string }
const facts = new WeakSet<object>()
const reuses = new WeakSet<object>()
const legacyFacts = new WeakSet<object>()
const mismatch = (): never => { throw new LifecycleError('CHECKOUT_PROVIDER_FACT_MISMATCH') }
// Runtime provenance is private to this module; JSON/claim tokens cannot manufacture a provider fact.
export function assertVerifiedCheckoutFact(value: unknown): asserts value is VerifiedCheckoutFact { if (!value || typeof value !== 'object' || !facts.has(value)) return mismatch() }
export function assertVerifiedCustomerReuse(value: unknown): asserts value is VerifiedCustomerReuse { if (!value || typeof value !== 'object' || !reuses.has(value)) return mismatch() }
export function assertVerifiedLegacyCheckout(value: unknown): asserts value is VerifiedLegacyCheckout { if (!value || typeof value !== 'object' || !legacyFacts.has(value)) return mismatch() }
function immutable<T extends object>(value: T): T { for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) immutable(child); Object.freeze(value); return value }
function dispatchMatches(d: CheckoutDispatch, p: CheckoutPlan, type: CheckoutDispatch['type']) {
  if (JSON.stringify(d.plan) !== JSON.stringify(p) || d.type !== type || d.identity.operationId !== p.identity.operationId || d.identity.targetUserId !== p.identity.targetUserId || d.targetHash !== p.targetHash || d.inputDigest !== p.inputDigest || d.mode !== p.mode || d.payloadDigest !== (type === 'customer_create' ? p.customerDigest : p.checkoutDigest) || d.expiresAt !== p.expiresAt) return mismatch()
}
const metadata = (p: CheckoutPlan, d: CheckoutDispatch): Metadata => ({ userId: p.identity.targetUserId, doyaOperation: p.identity.operationId, doyaInput: p.inputDigest, doyaPayload: d.payloadDigest, doyaDispatch: d.dispatchToken, planId: p.planId, serviceId: p.serviceId })
function metaMatches(m: Metadata | null, p: CheckoutPlan, d: CheckoutDispatch) {
  const expected = metadata(p, d)
  if (!m || Object.entries(expected).some(([k, v]) => m[k] !== v)) return mismatch()
}
function customerFact(raw: ProviderCustomer, p: CheckoutPlan, d: CheckoutDispatch): VerifiedCheckoutFact {
  dispatchMatches(d, p, 'customer_create'); metaMatches(raw.metadata, p, d)
  if (!customerIdValid(raw.id) || raw.deleted || raw.livemode !== (p.mode === 'live')) return mismatch()
  const f = immutable({ kind: 'customer' as const, dispatch: immutable(parseCheckoutDispatch(JSON.stringify(d))), resourceId: raw.id, customerId: raw.id, subscriptionId: null, status: 'created' as const, expiresAt: p.expiresAt, url: null }); facts.add(f); return f
}
function checkoutFact(raw: ProviderCheckout, p: CheckoutPlan, d: CheckoutDispatch): VerifiedCheckoutFact {
  dispatchMatches(d, p, 'checkout_create'); metaMatches(raw.metadata, p, d)
  if (p.version === 2 && (!p.recovery || raw.success_url !== checkoutUrls(p.recovery, p.planId, p.serviceId).successUrl || raw.cancel_url !== checkoutUrls(p.recovery, p.planId, p.serviceId).cancelUrl)) return mismatch()
  if (!sessionIdValid(raw.id) || raw.livemode !== (p.mode === 'live') || raw.mode !== 'subscription' || raw.client_reference_id !== p.identity.targetUserId || !['open', 'complete', 'expired'].includes(raw.status || '') || !Number.isSafeInteger(raw.expires_at) || raw.expires_at !== p.expiresAt || !(raw.customer === null || customerIdValid(raw.customer)) || !(raw.subscription === null || subscriptionIdValid(raw.subscription)) || p.customerId !== null && raw.customer !== p.customerId || !raw.line_items || !Array.isArray(raw.line_items.data) || raw.line_items.has_more === true || raw.line_items.data.length !== 1 || raw.line_items.data[0].quantity !== 1 || raw.line_items.data[0].price?.id !== p.priceId || raw.status === 'complete' && (!raw.customer || !raw.subscription)) return mismatch()
  if (raw.status === 'open') { try { if (!raw.url || new URL(raw.url).protocol !== 'https:') return mismatch() } catch { return mismatch() } }
  const f = immutable({ kind: 'checkout' as const, dispatch: immutable(parseCheckoutDispatch(JSON.stringify(d))), resourceId: raw.id, customerId: raw.customer, subscriptionId: raw.subscription, status: raw.status as 'open' | 'complete' | 'expired', expiresAt: raw.expires_at, url: raw.status === 'open' ? raw.url : null }); facts.add(f); return f
}
export function checkoutProviderAdapter(provider: CheckoutProvider) {
  return {
    async readLegacyReady(request: CheckoutRequest, sessionId: string, rawHash: string, signature: string): Promise<VerifiedLegacyCheckout> {
      const plan = sealedCheckoutRequest(request), raw = await provider.retrieveCheckout(sessionId)
      if (raw.id !== sessionId || !sessionIdValid(raw.id) || raw.livemode !== (plan.mode === 'live') || raw.mode !== 'subscription' ||
        !['open', 'complete', 'expired'].includes(raw.status || '') || raw.client_reference_id !== plan.identity.targetUserId ||
        raw.metadata?.userId !== plan.identity.targetUserId || raw.metadata?.planId !== plan.planId || raw.metadata?.serviceId !== plan.serviceId ||
        raw.success_url !== request.terms.successUrl || raw.cancel_url !== request.terms.cancelUrl || raw.expires_at !== plan.expiresAt ||
        !raw.line_items || raw.line_items.data.length !== 1 || raw.line_items.data[0].quantity !== 1 || raw.line_items.data[0].price?.id !== plan.priceId ||
        !(raw.customer === null || customerIdValid(raw.customer)) || !(raw.subscription === null || subscriptionIdValid(raw.subscription)) ||
        (plan.source === 'hr' ? raw.customer !== plan.customerId : raw.customer_email !== request.terms.email) ||
        raw.status === 'complete' && (!raw.customer || !raw.subscription) || raw.status === 'open' && (!raw.url || !raw.url.startsWith('https://') || raw.subscription !== null)) return mismatch()
      const fact = immutable({ kind: 'legacy_checkout' as const, targetHash: plan.targetHash, inputDigest: plan.inputDigest, mode: plan.mode, source: plan.source, sessionId: raw.id, customerId: raw.customer, subscriptionId: raw.subscription, status: raw.status as 'open' | 'complete' | 'expired', url: raw.status === 'open' ? raw.url : null, expiresAt: raw.expires_at, rawHash, signature })
      legacyFacts.add(fact); return fact
    },
    async createCustomer(request: CheckoutRequest, plan: CheckoutPlan, d: CheckoutDispatch): Promise<VerifiedCheckoutFact> {
      if (sealedCheckoutRequest(request).inputDigest !== plan.inputDigest) return mismatch()
      dispatchMatches(d, plan, 'customer_create')
      const raw = await provider.createCustomer({ email: request.terms.email, name: request.terms.name, metadata: metadata(plan, d) }, { idempotencyKey: d.idempotencyKey })
      return customerFact(raw, plan, d)
    },
    async reuseCustomer(plan: CheckoutPlan, request: CheckoutRequest): Promise<VerifiedCustomerReuse> {
      if (plan.customerMode !== 'reuse' || !plan.expectedCustomerId) return mismatch()
      const raw = await provider.retrieveCustomer(plan.expectedCustomerId)
      if (raw.id !== plan.expectedCustomerId || raw.deleted || raw.livemode !== (plan.mode === 'live') || raw.metadata?.userId !== plan.identity.targetUserId ||
          plan.version === 2 && (sealedCheckoutRequest(request).inputDigest !== plan.inputDigest || raw.email?.trim().toLowerCase() !== request.terms.email)) return mismatch()
      const f = immutable({ kind: 'reuse' as const, operationId: plan.identity.operationId, targetHash: plan.targetHash, inputDigest: plan.inputDigest, customerId: raw.id, mode: plan.mode }); reuses.add(f); return f
    },
    async createCheckout(request: CheckoutRequest, plan: CheckoutPlan, d: CheckoutDispatch): Promise<VerifiedCheckoutFact> {
      if (sealedCheckoutRequest(request).inputDigest !== plan.inputDigest || plan.checkoutDigest !== checkoutPayloadDigest(plan, plan.customerId)) return mismatch()
      dispatchMatches(d, plan, 'checkout_create')
      const raw = await provider.createCheckout({ mode: 'subscription', customer: plan.customerId, customer_email: plan.customerId ? null : request.terms.email, priceId: plan.priceId, trialDays: plan.trialDays, successUrl: request.terms.successUrl, cancelUrl: request.terms.cancelUrl, expiresAt: plan.expiresAt, client_reference_id: plan.identity.targetUserId, metadata: metadata(plan, d) }, { idempotencyKey: d.idempotencyKey })
      return checkoutFact(raw, plan, d)
    },
    async reconcileCustomer(plan: CheckoutPlan, d: CheckoutDispatch, id: string): Promise<VerifiedCheckoutFact> {
      if (!customerIdValid(id)) return mismatch()
      const f = customerFact(await provider.retrieveCustomer(id), plan, d)
      if (f.resourceId !== id) return mismatch()
      return f
    },
    async reconcileCheckout(plan: CheckoutPlan, d: CheckoutDispatch, id: string): Promise<VerifiedCheckoutFact> {
      if (!sessionIdValid(id)) return mismatch()
      const f = checkoutFact(await provider.retrieveCheckout(id), plan, d)
      if (f.resourceId !== id) return mismatch()
      return f
    },
    async readReady(plan: CheckoutPlan, d: CheckoutDispatch, capability: CheckoutCapability): Promise<VerifiedCheckoutFact> {
      const f = checkoutFact(await provider.retrieveCheckout(capability.sessionId), plan, d)
      if (f.resourceId !== capability.sessionId || f.customerId !== capability.customerId && capability.customerId !== null || capability.subscriptionId !== null && f.subscriptionId !== capability.subscriptionId) return mismatch()
      return f
    },
  }
}
export type CheckoutProviderAdapter = ReturnType<typeof checkoutProviderAdapter>
export const checkoutDispatchIdempotencyKey = (claim: LifecycleClaim, actionKey: string, token: string): string => 'doya-v2-' + checkoutDigest([claim.operationId, claim.generation, actionKey, token])
