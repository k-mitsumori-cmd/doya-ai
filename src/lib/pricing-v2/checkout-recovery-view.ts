import { billingRedirectUrl } from '@/lib/billing-response-client'

export type CheckoutRecoveryState = 'none' | 'creating' | 'ready' | 'open' | 'complete' | 'expired' | 'reconcile' | 'active'
export type CheckoutRecoveryView = { state: CheckoutRecoveryState; seats: number | null; url?: string }
const STATES = new Set(['none', 'creating', 'ready', 'open', 'complete', 'expired', 'reconcile', 'active'])
export function parseCheckoutRecovery(raw: unknown): CheckoutRecoveryView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (typeof value.state !== 'string' || !STATES.has(value.state)) return null
  if (value.seats !== null && (!Number.isInteger(value.seats) || Number(value.seats) < 1 || Number(value.seats) > 49)) return null
  if (value.state === 'none' && value.seats !== null) return null
  if (value.state === 'open') {
    const url = billingRedirectUrl(value.url)
    if (!url || value.seats === null) return null
    return { state: 'open', seats: Number(value.seats), url }
  }
  if (value.url !== undefined) return null
  return { state: value.state as CheckoutRecoveryState, seats: value.seats as number | null }
}
export function recoveryBlocksNewPurchase(view: CheckoutRecoveryView) { return view.state !== 'none' && view.state !== 'expired' }
