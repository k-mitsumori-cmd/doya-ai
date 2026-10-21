import { createHash } from 'node:crypto'
import { LifecycleError, assertLifecycleIdentity, lifecycleSubject, validLifecycleDigest, validLifecycleUuid, type LifecycleClaim, type LifecycleIdentity } from './state'
import { checkoutUrls } from './checkout-urls'

export const checkoutDigest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type CheckoutRecoveryBinding = { version: 1; recipe: 'generic' | 'hr'; origin: string; returnPath: string | null }
export type CheckoutTerms = { priceId: string; planId: string; serviceId: string; trialDays: number; successUrl: string; cancelUrl: string; email: string; name: string; expiresAt: number }
export type CheckoutRequest = { cutoverEpoch: string; identity: LifecycleIdentity; mode: 'test' | 'live'; source: 'generic' | 'hr'; organizationId: string | null; customerMode: 'create' | 'reuse' | 'implicit'; customerId: string | null; terms: CheckoutTerms; recovery?: CheckoutRecoveryBinding }
export type CheckoutPlan = { version: 1 | 2; cutoverEpoch: string; identity: LifecycleIdentity; inputDigest: string; targetHash: string; priceId: string; planId: string; serviceId: string; trialDays: number; mode: 'test' | 'live'; source: 'generic' | 'hr'; organizationId: string | null; customerMode: 'create' | 'reuse' | 'implicit'; expectedCustomerId: string | null; customerId: string | null; expiresAt: number; customerDigest: string; checkoutDigest: string | null; recovery?: CheckoutRecoveryBinding; previousOperationId?: string | null }
export type CheckoutDispatch = { version: 1; plan: CheckoutPlan; identity: LifecycleIdentity; targetHash: string; generation: string; actionKey: string; dispatchToken: string; inputDigest: string; payloadDigest: string; mode: 'test' | 'live'; type: 'customer_create' | 'checkout_create'; customerId: string | null; expiresAt: number; idempotencyKey: string }
export type CheckoutCapability = { version: 1; operationId: string; targetHash: string; inputDigest: string; mode: 'test' | 'live'; sessionId: string; customerId: string | null; subscriptionId: string | null; status: 'open' | 'complete' | 'expired'; url: string | null; expiresAt: number; revision: number }
export type CheckoutIndex = { version: 1; targetHash: string; revision: number; currentOperationId: string | null; dirty: boolean; notifiedRetirement: string | null; resources: { type: 'customer' | 'checkout' | 'subscription'; id: string; operationId: string }[] }
export const checkoutKeys = {
  cutover: (mode: string) => 'doya-checkout-cutover:v2:' + mode,
  plan: (id: string) => 'doya-checkout-plan:v2:' + id,
  dispatch: (token: string) => 'doya-checkout-dispatch:v2:' + token,
  capability: (id: string) => 'doya-checkout-capability:v2:' + id,
  index: (hash: string) => 'doya-checkout-index:v2:' + hash,
  resource: (mode: string, type: string, id: string) => 'doya-checkout-resource:v2:' + checkoutDigest([mode, type, id]),
  fact: (token: string) => 'doya-checkout-fact:v2:' + token,
  legacy: (hash: string) => 'doya-checkout-legacy:v2:' + hash,
  legacyMapping: (targetHash: string, mode: string) => 'doya-checkout-legacy-mapping:v2:' + checkoutDigest([targetHash, mode]),
}
export const checkoutUnavailable = (): never => { throw new LifecycleError('CHECKOUT_STATE_UNAVAILABLE') }
export function exactCheckoutObject(value: unknown, keys: string): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.split(',').sort().join(',')
}
const text = (v: unknown, size = 500) => typeof v === 'string' && v.length > 0 && v.length <= size
export function validCheckoutRecoveryBinding(v: unknown, source: CheckoutRequest['source']): v is CheckoutRecoveryBinding {
  if (!exactCheckoutObject(v, 'version,recipe,origin,returnPath') || v.version !== 1 || v.recipe !== source || !text(v.origin, 500)) return false
  try {
    const origin = new URL(v.origin as string)
    if (origin.protocol !== 'https:' || origin.origin !== v.origin || origin.username || origin.password) return false
  } catch { return false }
  return v.recipe === 'hr' ? v.returnPath === null : v.returnPath === null || typeof v.returnPath === 'string' && v.returnPath.startsWith('/') && !v.returnPath.startsWith('//') && v.returnPath.length <= 500 && !/[?#\\]/.test(v.returnPath)
}
export const customerIdValid = (v: unknown): v is string => typeof v === 'string' && /^cus_[A-Za-z0-9_]{1,200}$/.test(v)
export const sessionIdValid = (v: unknown): v is string => typeof v === 'string' && /^cs_[A-Za-z0-9_]{1,200}$/.test(v)
export const subscriptionIdValid = (v: unknown): v is string => typeof v === 'string' && /^sub_[A-Za-z0-9_]{1,150}$/.test(v)
export const checkoutRevision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER
export function sealedCheckoutRequest(r: CheckoutRequest): CheckoutPlan {
  const hasRecovery = Object.prototype.hasOwnProperty.call(r, 'recovery')
  if (!exactCheckoutObject(r, hasRecovery ? 'cutoverEpoch,identity,mode,source,organizationId,customerMode,customerId,terms,recovery' : 'cutoverEpoch,identity,mode,source,organizationId,customerMode,customerId,terms') || hasRecovery && !validCheckoutRecoveryBinding(r.recovery, r.source)) return checkoutUnavailable()
  assertLifecycleIdentity(r.identity)
  if (!validLifecycleUuid(r.cutoverEpoch) || r.identity.kind !== 'checkout' || r.identity.operator.kind !== 'user' || r.identity.operator.id !== r.identity.targetUserId || !['test', 'live'].includes(r.mode) || !['generic', 'hr'].includes(r.source) || !['create', 'reuse', 'implicit'].includes(r.customerMode) || !(r.organizationId === null || text(r.organizationId, 128)) || r.source === 'hr' && r.organizationId === null || (r.customerMode === 'reuse' ? !customerIdValid(r.customerId) : r.customerId !== null)) return checkoutUnavailable()
  const t = r.terms
  if (!exactCheckoutObject(t, 'priceId,planId,serviceId,trialDays,successUrl,cancelUrl,email,name,expiresAt') || !text(t.priceId, 200) || !t.priceId.startsWith('price_') || !text(t.planId, 100) || !text(t.serviceId, 100) || !Number.isSafeInteger(t.trialDays) || t.trialDays < 0 || t.trialDays > 365 || !text(t.email, 320) || t.email !== t.email.trim().toLowerCase() || typeof t.name !== 'string' || t.name.length > 200 || !Number.isSafeInteger(t.expiresAt) || t.expiresAt <= 0) return checkoutUnavailable()
  for (const u of [t.successUrl, t.cancelUrl]) { try { if (!text(u, 2048) || new URL(u).protocol !== 'https:') return checkoutUnavailable() } catch { return checkoutUnavailable() } }
  if (hasRecovery) {
    const urls = checkoutUrls(r.recovery!, t.planId, t.serviceId)
    if (t.successUrl !== urls.successUrl || t.cancelUrl !== urls.cancelUrl) return checkoutUnavailable()
  }
  const digestFields = [r.cutoverEpoch, r.mode, r.source, r.organizationId, r.customerMode, r.customerId, t.priceId, t.planId, t.serviceId, t.trialDays, t.successUrl, t.cancelUrl, t.email, t.name, t.expiresAt]
  const digest = checkoutDigest(hasRecovery ? [...digestFields, r.recovery] : digestFields)
  const base = { version: hasRecovery ? 2 as const : 1 as const, cutoverEpoch: r.cutoverEpoch, identity: { ...r.identity, operator: { ...r.identity.operator } }, inputDigest: digest, priceId: t.priceId, planId: t.planId, serviceId: t.serviceId, trialDays: t.trialDays, targetHash: lifecycleSubject(r.identity.targetUserId), mode: r.mode, source: r.source, organizationId: r.organizationId, customerMode: r.customerMode, expectedCustomerId: r.customerId, customerId: r.customerId, expiresAt: t.expiresAt, customerDigest: checkoutDigest([digest, 'customer']), checkoutDigest: null, ...(hasRecovery ? { recovery: { ...r.recovery! }, previousOperationId: null } : {}) }
  return { ...base, checkoutDigest: r.customerMode === 'create' ? null : checkoutPayloadDigest(base, r.customerId) }
}
export const checkoutPayloadDigest = (p: Pick<CheckoutPlan, 'inputDigest' | 'expiresAt'>, customer: string | null): string => checkoutDigest([p.inputDigest, customer, p.expiresAt, 'checkout'])
export function parseCheckoutPlan(raw: string): CheckoutPlan {
  const p: unknown = JSON.parse(raw)
  if (!p || typeof p !== 'object' || !('version' in p) || !exactCheckoutObject(p, p.version === 2 ? 'version,cutoverEpoch,identity,inputDigest,targetHash,priceId,planId,serviceId,trialDays,mode,source,organizationId,customerMode,expectedCustomerId,customerId,expiresAt,customerDigest,checkoutDigest,recovery,previousOperationId' : 'version,cutoverEpoch,identity,inputDigest,targetHash,priceId,planId,serviceId,trialDays,mode,source,organizationId,customerMode,expectedCustomerId,customerId,expiresAt,customerDigest,checkoutDigest')) return checkoutUnavailable()
  assertLifecycleIdentity((p as Record<string, unknown>).identity)
  const v = p as CheckoutPlan
  if (![1, 2].includes(v.version) || v.version === 2 && !validCheckoutRecoveryBinding(v.recovery, v.source) || !validLifecycleUuid(v.cutoverEpoch) || v.identity.kind !== 'checkout' || v.identity.operator.kind !== 'user' || v.identity.operator.id !== v.identity.targetUserId || !text(v.priceId, 200) || !text(v.planId, 100) || !text(v.serviceId, 100) || !Number.isSafeInteger(v.trialDays) || v.trialDays < 0 || v.trialDays > 365 || !validLifecycleDigest(v.inputDigest) || v.targetHash !== lifecycleSubject(v.identity.targetUserId) || !['test', 'live'].includes(v.mode) || !['generic', 'hr'].includes(v.source) || !['create', 'reuse', 'implicit'].includes(v.customerMode) || !(v.organizationId === null || text(v.organizationId, 128)) || !(v.expectedCustomerId === null || customerIdValid(v.expectedCustomerId)) || !(v.customerId === null || customerIdValid(v.customerId)) || !Number.isSafeInteger(v.expiresAt) || v.expiresAt <= 0 || v.customerDigest !== checkoutDigest([v.inputDigest, 'customer']) || !(v.checkoutDigest === null && v.customerMode === 'create' && v.customerId === null || v.checkoutDigest === checkoutPayloadDigest(v, v.customerId))) return checkoutUnavailable()
  if (v.source === 'hr' && v.organizationId === null || v.customerMode === 'reuse' && (!v.expectedCustomerId || v.customerId !== v.expectedCustomerId) || v.customerMode !== 'reuse' && v.expectedCustomerId !== null || v.customerMode === 'implicit' && v.customerId !== null || v.version === 2 && !(v.previousOperationId === null || validLifecycleUuid(v.previousOperationId) && v.previousOperationId !== v.identity.operationId)) return checkoutUnavailable()
  return v
}
export function parseCheckoutIndex(raw: string, targetHash: string): CheckoutIndex {
  const p: unknown = JSON.parse(raw)
  if (!exactCheckoutObject(p, 'version,targetHash,revision,currentOperationId,dirty,notifiedRetirement,resources') || p.version !== 1 || p.targetHash !== targetHash || !checkoutRevision(p.revision) || !(p.currentOperationId === null || validLifecycleUuid(p.currentOperationId)) || typeof p.dirty !== 'boolean' || !(p.notifiedRetirement === null || validLifecycleUuid(p.notifiedRetirement)) || !Array.isArray(p.resources) || p.resources.length > 128) return checkoutUnavailable()
  for (const r of p.resources) if (!exactCheckoutObject(r, 'type,id,operationId') || !validLifecycleUuid(r.operationId) || !(r.type === 'customer' ? customerIdValid(r.id) : r.type === 'checkout' ? sessionIdValid(r.id) : r.type === 'subscription' && subscriptionIdValid(r.id))) return checkoutUnavailable()
  if (new Set(p.resources.map(r => `${r.type}:${r.id}`)).size !== p.resources.length) return checkoutUnavailable()
  return p as CheckoutIndex
}
export function parseCheckoutCapability(raw: string): CheckoutCapability {
  const p: unknown = JSON.parse(raw)
  if (!exactCheckoutObject(p, 'version,operationId,targetHash,inputDigest,mode,sessionId,customerId,subscriptionId,status,url,expiresAt,revision') || p.version !== 1 || !validLifecycleUuid(p.operationId) || !validLifecycleDigest(p.targetHash) || !validLifecycleDigest(p.inputDigest) || !['test', 'live'].includes(p.mode as string) || !sessionIdValid(p.sessionId) || !(p.customerId === null || customerIdValid(p.customerId)) || !(p.subscriptionId === null || subscriptionIdValid(p.subscriptionId)) || !['open', 'complete', 'expired'].includes(p.status as string) || !(p.url === null || text(p.url, 4096) && new URL(p.url as string).protocol === 'https:') || !Number.isSafeInteger(p.expiresAt) || !checkoutRevision(p.revision)) return checkoutUnavailable()
  if (p.status === 'open' ? p.url === null || p.subscriptionId !== null : p.url !== null) return checkoutUnavailable()
  return p as CheckoutCapability
}
export function assertCheckoutClaim(claim: LifecycleClaim, p: CheckoutPlan): void {
  if (claim.operator.kind !== p.identity.operator.kind || claim.operator.id !== p.identity.operator.id || claim.operationId !== p.identity.operationId || claim.targetUserId !== p.identity.targetUserId || claim.kind !== 'checkout') return checkoutUnavailable()
}

export function parseCheckoutDispatch(raw: string): CheckoutDispatch {
  const p: unknown = JSON.parse(raw)
  if (!exactCheckoutObject(p, 'version,plan,identity,targetHash,generation,actionKey,dispatchToken,inputDigest,payloadDigest,mode,type,customerId,expiresAt,idempotencyKey')) return checkoutUnavailable()
  assertLifecycleIdentity(p.identity)
  const v = p as CheckoutDispatch, plan = parseCheckoutPlan(JSON.stringify(v.plan))
  if (v.version !== 1 || JSON.stringify(v.identity) !== JSON.stringify(plan.identity) || v.targetHash !== plan.targetHash || !validLifecycleUuid(v.generation) || !validLifecycleUuid(v.dispatchToken) || !validLifecycleDigest(v.actionKey) || v.inputDigest !== plan.inputDigest || !['customer_create', 'checkout_create'].includes(v.type) || v.payloadDigest !== (v.type === 'customer_create' ? plan.customerDigest : plan.checkoutDigest) || v.mode !== plan.mode || v.customerId !== plan.customerId || v.expiresAt !== plan.expiresAt || v.idempotencyKey !== 'doya-v2-' + checkoutDigest([v.identity.operationId, v.generation, v.actionKey, v.dispatchToken])) return checkoutUnavailable()
  return v
}
