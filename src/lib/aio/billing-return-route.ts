import { validAioSessionId } from './billing-navigation'
import { classifyBillingReturnMarker, correlatedBillingReturnPath, AIO_UNKNOWN_RETURN } from './billing-return-correlation'

type Param = string | string[] | undefined
const one = (value: Param): string | null => typeof value === 'string' ? value : null
const markerKeys = ['success', 'payment', 'portal_return', 'session_id', 'plan'] as const
const markerPresent = (params: Record<string, Param>) => markerKeys.some(key => params[key] !== undefined)
const markerMalformed = (params: Record<string, Param>) => markerKeys.some(key => params[key] !== undefined && typeof params[key] !== 'string')

/** A dedicated return path must never apply cs_A's origin to cs_B's sync marker. */
export function aioDedicatedReturnMarkerValid(kind: 'checkout' | 'portal' | 'cancelled' | 'unknown', referenceId: string | null,
  params: Record<string, Param>): boolean {
  if (!markerPresent(params)) return true // StripeSuccessSync removes the query while the path keeps the session ID.
  if (markerMalformed(params)) return false
  if (kind === 'checkout') return referenceId !== null && params.success === 'true' && params.session_id === referenceId &&
    params.payment === undefined && params.portal_return === undefined &&
    (params.plan === undefined || typeof params.plan === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(params.plan))
  if (kind === 'portal') return params.portal_return === 'plan_change' && params.success === undefined &&
    params.payment === undefined && params.session_id === undefined && params.plan === undefined
  if (kind === 'unknown') {
    const marker = aioReturnRedirect(params)
    return marker !== null && (marker.startsWith('/aio/billing-return/checkout/') ||
      marker === '/aio/billing-return/unknown?portal_return=plan_change')
  }
  return false
}

/** Discard only the untrusted origin path; preserve an independently valid sync marker. */
export function aioUnknownReturnPath(params: Record<string, Param>, pathname = AIO_UNKNOWN_RETURN): string {
  const marker = aioReturnRedirect(params)
  if (marker?.startsWith('/aio/billing-return/checkout/')) {
    const query = marker.indexOf('?')
    if (query !== -1) {
      const payment = classifyBillingReturnMarker(params)
      return `${correlatedBillingReturnPath(pathname, 'checkout', payment.sessionId)}${marker.slice(query)}`
    }
  }
  return marker === '/aio/billing-return/unknown?portal_return=plan_change' ?
    `${correlatedBillingReturnPath(pathname, 'portal', null)}?portal_return=plan_change` : AIO_UNKNOWN_RETURN
}

/** Only recognized return markers enter the AIO barrier; ordinary entry is unchanged. */
export function aioReturnRedirect(params: Record<string, Param>): string | null {
  const marked = markerPresent(params)
  if (!marked) return null
  if (markerMalformed(params)) {
    return '/aio/billing-return/unknown'
  }
  const success = one(params.success)
  const payment = one(params.payment)
  const portal = one(params.portal_return)
  const session = one(params.session_id)
  const plan = one(params.plan)
  if (success === 'true' && params.payment === undefined && params.portal_return === undefined && validAioSessionId(session) &&
    (params.plan === undefined || plan !== null && /^[A-Za-z0-9_-]{1,80}$/.test(plan))) {
    const query = new URLSearchParams({ success: 'true', session_id: session })
    if (plan) query.set('plan', plan)
    return `/aio/billing-return/checkout/${encodeURIComponent(session)}?${query}`
  }
  if (payment === 'cancelled' && params.success === undefined && params.session_id === undefined && params.portal_return === undefined && params.plan === undefined) return '/aio/billing-return/cancelled'
  if (portal === 'plan_change' && params.success === undefined && params.session_id === undefined && params.payment === undefined && params.plan === undefined) return '/aio/billing-return/unknown?portal_return=plan_change'
  return '/aio/billing-return/unknown'
}
