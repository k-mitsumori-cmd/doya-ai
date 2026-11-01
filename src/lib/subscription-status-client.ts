import { BillingResponseError } from './billing-response-client'

export type SubscriptionStatusSnapshot = { hasSubscription: false } | {
  hasSubscription: true
  subscriptionId: string
  status: 'active' | 'trialing' | 'past_due' | 'unpaid'
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number
}

/** Parse only a confirmed, coherent status; malformed data never means no contract. */
export function parseSubscriptionStatus(data: Record<string, unknown>): SubscriptionStatusSnapshot {
  if (data.ok !== true || data.error !== undefined || data.code !== undefined) throw new BillingResponseError()
  if (data.hasSubscription === false) {
    if (data.subscriptionId !== undefined || data.status !== undefined || data.cancelAtPeriodEnd !== undefined || data.currentPeriodEnd !== undefined) throw new BillingResponseError()
    return { hasSubscription: false }
  }
  if (data.hasSubscription !== true || typeof data.subscriptionId !== 'string' || !/^[A-Za-z0-9_]{1,255}$/.test(data.subscriptionId)
    || typeof data.status !== 'string' || !['active', 'trialing', 'past_due', 'unpaid'].includes(data.status)
    || typeof data.cancelAtPeriodEnd !== 'boolean' || typeof data.currentPeriodEnd !== 'number'
    || !Number.isSafeInteger(data.currentPeriodEnd) || data.currentPeriodEnd <= 0
    || !Number.isFinite(new Date(data.currentPeriodEnd * 1000).getTime())) throw new BillingResponseError()
  return { hasSubscription: true, subscriptionId: data.subscriptionId,
    status: data.status as 'active' | 'trialing' | 'past_due' | 'unpaid',
    cancelAtPeriodEnd: data.cancelAtPeriodEnd, currentPeriodEnd: data.currentPeriodEnd }
}
