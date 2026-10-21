import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const key = (actorId: string) => `aishodan-checkout-origin:v1:${encodeURIComponent(actorId)}`
const portalKey = (actorId: string, navigationId: string) => `aishodan-portal-origin:v1:${encodeURIComponent(actorId)}:${navigationId}`

export interface CheckoutOriginHint {
  version: 1
  actorId: string
  operationId: string
  organizationId: string
  slug: string
  returnPath: '/aishodan'
}

export function parseCheckoutOriginHint(value: unknown, actorId: string, operationId: string): CheckoutOriginHint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const hint = value as Record<string, unknown>
  if (Object.keys(hint).sort().join(',') !== 'actorId,operationId,organizationId,returnPath,slug,version' || hint.version !== 1 ||
    hint.actorId !== actorId || hint.operationId !== operationId || !UUID.test(operationId) ||
    typeof hint.organizationId !== 'string' || !hint.organizationId || hint.organizationId.length > 512 ||
    !validWorkspaceSlug(hint.slug) || hint.returnPath !== '/aishodan') return null
  return hint as unknown as CheckoutOriginHint
}

/** A navigation hint, never a billing authorization or checkout status. */
export function saveCheckoutOriginHint(storage: Pick<Storage, 'getItem' | 'setItem'>, hint: CheckoutOriginHint): boolean {
  if (!parseCheckoutOriginHint(hint, hint.actorId, hint.operationId)) return false
  try {
    const existing = storage.getItem(key(hint.actorId))
    if (existing) {
      const value: unknown = JSON.parse(existing)
      // Resuming an existing handle must not silently replace its origin.
      const parsed = parseCheckoutOriginHint(value, hint.actorId, hint.operationId)
      if (parsed) return parsed.organizationId === hint.organizationId && parsed.slug === hint.slug
    }
    storage.setItem(key(hint.actorId), JSON.stringify(hint))
    return true
  } catch { return false }
}

export function readCheckoutOriginHint(storage: Pick<Storage, 'getItem'>, actorId: string, operationId: string): 'missing' | 'invalid' | CheckoutOriginHint {
  try {
    const raw = storage.getItem(key(actorId))
    if (raw === null) return 'missing'
    const value: unknown = JSON.parse(raw)
    return parseCheckoutOriginHint(value, actorId, operationId) || 'invalid'
  } catch { return 'invalid' }
}

export interface PortalOriginHint {
  version: 1
  actorId: string
  navigationId: string
  organizationId: string
  slug: string
  returnPath: '/aishodan'
}

export function parsePortalOriginHint(value: unknown, actorId: string, navigationId: string): PortalOriginHint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const hint = value as Record<string, unknown>
  if (Object.keys(hint).sort().join(',') !== 'actorId,navigationId,organizationId,returnPath,slug,version' ||
    hint.version !== 1 || hint.actorId !== actorId || hint.navigationId !== navigationId || !UUID.test(navigationId) ||
    typeof hint.organizationId !== 'string' || !hint.organizationId || hint.organizationId.length > 512 ||
    !validWorkspaceSlug(hint.slug) || hint.returnPath !== '/aishodan') return null
  return hint as unknown as PortalOriginHint
}

/** Navigation-only hint. It does not authorize billing, membership, or portal access. */
export function savePortalOriginHint(storage: Pick<Storage, 'setItem'>, hint: PortalOriginHint): boolean {
  if (!parsePortalOriginHint(hint, hint.actorId, hint.navigationId)) return false
  try { storage.setItem(portalKey(hint.actorId, hint.navigationId), JSON.stringify(hint)); return true }
  catch { return false }
}

export function readPortalOriginHint(storage: Pick<Storage, 'getItem'>, actorId: string, navigationId: string): 'missing' | 'invalid' | PortalOriginHint {
  if (!UUID.test(navigationId)) return 'invalid'
  try {
    const raw = storage.getItem(portalKey(actorId, navigationId))
    if (raw === null) return 'missing'
    return parsePortalOriginHint(JSON.parse(raw) as unknown, actorId, navigationId) || 'invalid'
  } catch { return 'invalid' }
}
