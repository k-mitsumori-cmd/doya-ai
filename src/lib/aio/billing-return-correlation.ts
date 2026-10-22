type MarkerSource = { getAll(key: string): string[] } | Record<string, unknown>
type Mode = 'checkout' | 'portal' | null
const recognized = ['success', 'session_id', 'portal_return', 'payment', 'plan'] as const
const session = /^cs_[A-Za-z0-9_]{1,250}$/
const plan = /^[A-Za-z0-9_-]{1,80}$/
const portalPath = /^\/aio\/billing-return\/portal\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
export const AIO_UNKNOWN_RETURN = '/aio/billing-return/unknown'

function values(source: MarkerSource, key: string): unknown[] {
  if ('getAll' in source && typeof source.getAll === 'function') return source.getAll(key)
  const value = (source as Record<string, unknown>)[key]
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

/** Keep cardinality and raw values in the operation epoch; never choose get(first) from an ambiguous return. */
export function classifyBillingReturnMarker(source: MarkerSource): {
  mode: Mode; sessionId: string | null; automatic: boolean; fingerprint: string; marked: boolean
} {
  const [success, sessionId, portal, payment, tiers] = recognized.map(key => values(source, key))
  const marked = [success, sessionId, portal, payment, tiers].some(group => group.length > 0)
  const checkout = success.length === 1 && success[0] === 'true' && sessionId.length === 1 &&
    typeof sessionId[0] === 'string' && session.test(sessionId[0]) && portal.length === 0 && payment.length === 0 &&
    (tiers.length === 0 || tiers.length === 1 && typeof tiers[0] === 'string' && plan.test(tiers[0]))
  const portalValid = portal.length === 1 && portal[0] === 'plan_change' && success.length === 0 &&
    sessionId.length === 0 && payment.length === 0 && tiers.length === 0
  const mode: Mode = portal[0] === 'plan_change' ? 'portal' : success[0] === 'true' ? 'checkout' : null
  return { mode, sessionId: checkout ? sessionId[0] as string : null, automatic: checkout || portalValid,
    fingerprint: JSON.stringify([success, sessionId, portal, payment, tiers]), marked }
}

/** A valid payment may be synced while the organization origin in an AIO path is unknown. */
export function correlatedBillingReturnPath(pathname: string, mode: Exclude<Mode, null>, sessionId: string | null): string {
  if (!pathname.startsWith('/aio/billing-return/')) return pathname
  if (pathname === AIO_UNKNOWN_RETURN) return pathname
  if (mode === 'checkout' && sessionId && pathname === `/aio/billing-return/checkout/${sessionId}`) return pathname
  if (mode === 'portal' && portalPath.test(pathname)) return pathname
  return AIO_UNKNOWN_RETURN
}
