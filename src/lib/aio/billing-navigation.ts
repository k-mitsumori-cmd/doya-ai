import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const session = /^cs_[A-Za-z0-9_]{1,250}$/
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected.split(',').sort().join(',')
const text = (value: unknown, max = 512): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)

export const validAioNavigationId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value)
export const validAioSessionId = (value: unknown): value is string => typeof value === 'string' && session.test(value)

export type AioOrganization = { id: string; slug: string; name: string; role: 'owner' | 'admin' | 'manager' | 'member' }
export type AioBillingRead = { service: 'aio'; actorId: string; memberships: AioOrganization[]; current: (AioOrganization & { plan: string; canManageBilling: boolean }) | null }
const knownPlan = (value: unknown): value is string => typeof value === 'string' && [
  'GUEST', 'FREE', 'LIGHT', 'LIGHT_MONTHLY', 'BANNER_LIGHT', 'PRO', 'PRO_MONTHLY', 'BANNER_PRO', 'BUNDLE',
  'BASIC', 'STARTER', 'BUSINESS', 'PREMIUM', 'ENTERPRISE', 'ENTERPRISE_MONTHLY', 'BANNER_ENTERPRISE',
].includes(value.trim().toUpperCase().replace(/-/g, '_'))
const organization = (value: unknown): value is AioOrganization => record(value) && keys(value, 'id,slug,name,role') &&
  text(value.id) && validWorkspaceSlug(value.slug) && text(value.name) &&
  typeof value.role === 'string' && ['owner', 'admin', 'manager', 'member'].includes(value.role)

export function parseAioBillingRead(value: unknown, actorId: string, requestedSlug: string | null): AioBillingRead {
  if (!record(value) || !keys(value, 'service,actorId,memberships,current') || value.service !== 'aio' || value.actorId !== actorId ||
    !Array.isArray(value.memberships) || value.memberships.length > 512 || !value.memberships.every(organization) ||
    new Set(value.memberships.map(row => row.id)).size !== value.memberships.length ||
    new Set(value.memberships.map(row => row.slug)).size !== value.memberships.length) throw Error('AIO billing scope unavailable')
  if (requestedSlug === null) {
    if (value.current !== null) throw Error('AIO billing scope unavailable')
  } else {
    const current = value.current
    if (!record(current) || !keys(current, 'id,slug,name,role,plan,canManageBilling') || !validWorkspaceSlug(requestedSlug) ||
      !organization({ id: current.id, slug: current.slug, name: current.name, role: current.role }) ||
      current.slug !== requestedSlug || !knownPlan(current.plan) || typeof current.canManageBilling !== 'boolean' ||
      current.canManageBilling !== (current.role === 'owner') ||
      !value.memberships.some(row => row.id === current.id && row.slug === current.slug && row.name === current.name && row.role === current.role)) throw Error('AIO billing scope unavailable')
  }
  return value as AioBillingRead
}

type Origin = { version: 1; actorId: string; organizationId: string; slug: string }
export type AioCheckoutHint = Origin & { kind: 'checkout'; operationId: string; sessionId: string }
export type AioPortalHint = Origin & { kind: 'portal'; navigationId: string }
const validOrigin = (value: Record<string, unknown>) => value.version === 1 && text(value.actorId, 128) && text(value.organizationId) && validWorkspaceSlug(value.slug)
const validCheckoutHint = (value: unknown): value is AioCheckoutHint => record(value) && keys(value, 'version,kind,actorId,organizationId,slug,operationId,sessionId') && validOrigin(value) && value.kind === 'checkout' && validAioNavigationId(value.operationId) && validAioSessionId(value.sessionId)
const validPortalHint = (value: unknown): value is AioPortalHint => record(value) && keys(value, 'version,kind,actorId,organizationId,slug,navigationId') && validOrigin(value) && value.kind === 'portal' && validAioNavigationId(value.navigationId)
const checkoutKey = (actorId: string, sessionId: string) => `aio-billing-return:checkout:v1:${encodeURIComponent(actorId)}:${sessionId}`
const portalKey = (actorId: string, navigationId: string) => `aio-billing-return:portal:v1:${encodeURIComponent(actorId)}:${navigationId}`
const equal = (a: AioCheckoutHint | AioPortalHint, b: AioCheckoutHint | AioPortalHint) => JSON.stringify(a) === JSON.stringify(b)

/** Navigation evidence only; it never authorizes payment or organization membership. */
export function readAioCheckoutHint(storage: Pick<Storage, 'getItem'>, actorId: string, sessionId: string): AioCheckoutHint | null {
  if (!text(actorId, 128) || !validAioSessionId(sessionId)) return null
  try { const raw = storage.getItem(checkoutKey(actorId, sessionId)); const value: unknown = raw === null ? null : JSON.parse(raw); return validCheckoutHint(value) && value.actorId === actorId && value.sessionId === sessionId ? value : null }
  catch { return null }
}
export function saveAioCheckoutHint(storage: Pick<Storage, 'getItem' | 'setItem'>, hint: AioCheckoutHint): boolean {
  if (!validCheckoutHint(hint)) return false
  try {
    const key = checkoutKey(hint.actorId, hint.sessionId)
    const before = storage.getItem(key)
    if (before !== null) { const old: unknown = JSON.parse(before); return validCheckoutHint(old) && equal(old, hint) }
    storage.setItem(key, JSON.stringify(hint))
    const read = readAioCheckoutHint(storage, hint.actorId, hint.sessionId)
    return read !== null && equal(read, hint)
  } catch { return false }
}
export function readAioPortalHint(storage: Pick<Storage, 'getItem'>, actorId: string, navigationId: string): AioPortalHint | null {
  if (!text(actorId, 128) || !validAioNavigationId(navigationId)) return null
  try { const raw = storage.getItem(portalKey(actorId, navigationId)); const value: unknown = raw === null ? null : JSON.parse(raw); return validPortalHint(value) && value.actorId === actorId && value.navigationId === navigationId ? value : null }
  catch { return null }
}
export function saveAioPortalHint(storage: Pick<Storage, 'getItem' | 'setItem'>, hint: AioPortalHint): boolean {
  if (!validPortalHint(hint)) return false
  try {
    const key = portalKey(hint.actorId, hint.navigationId)
    const before = storage.getItem(key)
    if (before !== null) { const old: unknown = JSON.parse(before); return validPortalHint(old) && equal(old, hint) }
    storage.setItem(key, JSON.stringify(hint))
    const read = readAioPortalHint(storage, hint.actorId, hint.navigationId)
    return read !== null && equal(read, hint)
  } catch { return false }
}

/** Fixed local destinations; never treat a hint as a provider or checkout fact. */
export function aioBillingReturnPath(kind: 'portal' | 'checkout', id: string): string | null {
  return kind === 'portal' ? validAioNavigationId(id) ? `/aio/billing-return/portal/${id}` : null
    : validAioSessionId(id) ? `/aio/billing-return/checkout/${id}` : null
}
