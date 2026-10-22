import { LifecycleError, type LifecycleOutcome } from './state'
import type { SubscriptionPlan, SubscriptionTarget } from './subscription-plan'

export type VerifiedSubscriptionFact = {
  operationId: string; actionKey: string; subscriptionId: string; customerId: string
  mode: 'test' | 'live'; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number
  outcome: LifecycleOutcome
}
const verified = new WeakSet<VerifiedSubscriptionFact>()
const unknown = (): never => { throw new LifecycleError('SUBSCRIPTION_PROVIDER_RESULT_UNKNOWN') }

/** Called only after an exact SDK response and ownership check. This is not a receipt for later reconciliation. */
export function verifySubscriptionFact(plan: SubscriptionPlan, target: SubscriptionTarget, actionKey: string,
  response: { id: string; customerId: string; livemode: boolean; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number }): VerifiedSubscriptionFact {
  if (response.id !== target.id || response.customerId !== target.customerId || response.livemode !== (plan.mode === 'live') ||
      !Number.isSafeInteger(response.currentPeriodEnd) || response.currentPeriodEnd <= 0) return unknown()
  const immediate = plan.identity.kind === 'cancel' && plan.cancelMode === 'immediate'
  if (immediate ? response.status !== 'canceled' : !['active', 'trialing', 'past_due'].includes(response.status) ||
      response.cancelAtPeriodEnd !== (plan.identity.kind === 'cancel')) return unknown()
  const fact: VerifiedSubscriptionFact = {
    operationId: plan.identity.operationId, actionKey, subscriptionId: target.id, customerId: target.customerId,
    mode: plan.mode, status: response.status, cancelAtPeriodEnd: response.cancelAtPeriodEnd,
    currentPeriodEnd: response.currentPeriodEnd,
    outcome: { proof: immediate ? 'irreversible_terminal' : 'ack', resourceId: target.id,
      status: immediate ? 'canceled' : plan.identity.kind === 'cancel' ? 'scheduled_cancel' : 'resumed' },
  }
  verified.add(fact)
  return Object.freeze(fact)
}

export function assertVerifiedSubscriptionFact(value: VerifiedSubscriptionFact): void {
  if (!verified.has(value)) return unknown()
}
