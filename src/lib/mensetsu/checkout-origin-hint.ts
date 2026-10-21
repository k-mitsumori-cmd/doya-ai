import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const checkoutKey = (actor: string) => `mensetsu-checkout-origin:v1:${encodeURIComponent(actor)}`
const portalKey = (actor: string, id: string) => `mensetsu-portal-origin:v1:${encodeURIComponent(actor)}:${id}`
type Base = { version: 1; actorId: string; organizationId: string; slug: string; returnPath: '/mensetsu' }
export type MensetsuCheckoutOriginHint = Base & { operationId: string }
export type MensetsuPortalOriginHint = Base & { navigationId: string }

const base = (value: unknown, actor: string): value is Base => !!value && typeof value === 'object' && !Array.isArray(value) &&
  (value as Base).version === 1 && (value as Base).actorId === actor &&
  typeof (value as Base).organizationId === 'string' && (value as Base).organizationId.length > 0 && (value as Base).organizationId.length <= 512 &&
  validWorkspaceSlug((value as Base).slug) && (value as Base).returnPath === '/mensetsu'

export function parseMensetsuCheckoutHint(value: unknown, actor: string, operationId: string): MensetsuCheckoutOriginHint | null {
  if (!base(value, actor) || !UUID.test(operationId) || (value as MensetsuCheckoutOriginHint).operationId !== operationId ||
    Object.keys(value).sort().join(',') !== 'actorId,operationId,organizationId,returnPath,slug,version') return null
  return value as MensetsuCheckoutOriginHint
}
export function readMensetsuCheckoutHint(storage: Pick<Storage, 'getItem'>, actor: string, operationId: string): MensetsuCheckoutOriginHint | 'missing' | 'invalid' {
  try { const raw = storage.getItem(checkoutKey(actor)); return raw === null ? 'missing' : parseMensetsuCheckoutHint(JSON.parse(raw) as unknown, actor, operationId) || 'invalid' }
  catch { return 'invalid' }
}
export function saveMensetsuCheckoutHint(storage: Pick<Storage, 'getItem' | 'setItem'>, hint: MensetsuCheckoutOriginHint): boolean {
  if (!parseMensetsuCheckoutHint(hint, hint.actorId, hint.operationId)) return false
  try {
    const old = storage.getItem(checkoutKey(hint.actorId))
    if (old) {
      const same = parseMensetsuCheckoutHint(JSON.parse(old) as unknown, hint.actorId, hint.operationId)
      if (same) return same.organizationId === hint.organizationId && same.slug === hint.slug
    }
    storage.setItem(checkoutKey(hint.actorId), JSON.stringify(hint)); return true
  } catch { return false }
}
export function parseMensetsuPortalHint(value: unknown, actor: string, navigationId: string): MensetsuPortalOriginHint | null {
  if (!base(value, actor) || !UUID.test(navigationId) || (value as MensetsuPortalOriginHint).navigationId !== navigationId ||
    Object.keys(value).sort().join(',') !== 'actorId,navigationId,organizationId,returnPath,slug,version') return null
  return value as MensetsuPortalOriginHint
}
export function readMensetsuPortalHint(storage: Pick<Storage, 'getItem'>, actor: string, navigationId: string): MensetsuPortalOriginHint | 'missing' | 'invalid' {
  if (!UUID.test(navigationId)) return 'invalid'
  try { const raw = storage.getItem(portalKey(actor, navigationId)); return raw === null ? 'missing' : parseMensetsuPortalHint(JSON.parse(raw) as unknown, actor, navigationId) || 'invalid' }
  catch { return 'invalid' }
}
export function saveMensetsuPortalHint(storage: Pick<Storage, 'setItem'>, hint: MensetsuPortalOriginHint): boolean {
  if (!parseMensetsuPortalHint(hint, hint.actorId, hint.navigationId)) return false
  try { storage.setItem(portalKey(hint.actorId, hint.navigationId), JSON.stringify(hint)); return true }
  catch { return false }
}
