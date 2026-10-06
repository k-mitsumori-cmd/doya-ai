import { BillingResponseError } from './billing-response-client'
import { parseSubscriptionStatus, type SubscriptionStatusSnapshot } from './subscription-status-client'

export type SubscriptionOperation = 'cancel' | 'resume'
export type ConfirmedSubscription = Extract<SubscriptionStatusSnapshot, { hasSubscription: true }>

/** HTTP success alone does not confirm a billing change. */
export function parseSubscriptionMutation(data: Record<string, unknown>, operation: SubscriptionOperation): ConfirmedSubscription {
  if (data.hasSubscription !== undefined && data.hasSubscription !== true) throw new BillingResponseError()
  const parsed = parseSubscriptionStatus({ ...data, hasSubscription: true })
  if (!parsed.hasSubscription || parsed.cancelAtPeriodEnd !== (operation === 'cancel')) throw new BillingResponseError()
  if (operation === 'resume') return parsed
  if (data.mode !== 'period_end' || !Array.isArray(data.results) || data.results.length === 0
    || data.canceledCount !== data.results.length || data.failedCount !== undefined) throw new BillingResponseError()
  const ids = new Set<string>()
  let primary = false
  for (const result of data.results) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new BillingResponseError()
    if (result.ok !== undefined && result.ok !== true || result.hasSubscription !== undefined && result.hasSubscription !== true) throw new BillingResponseError()
    const item = parseSubscriptionStatus({ ...result, ok: true, hasSubscription: true })
    if (!item.hasSubscription || !item.cancelAtPeriodEnd || ids.has(item.subscriptionId)) throw new BillingResponseError()
    ids.add(item.subscriptionId)
    if (item.subscriptionId === parsed.subscriptionId) {
      if (item.status !== parsed.status || item.currentPeriodEnd !== parsed.currentPeriodEnd) throw new BillingResponseError()
      primary = true
    }
  }
  if (!primary) throw new BillingResponseError()
  return parsed
}
