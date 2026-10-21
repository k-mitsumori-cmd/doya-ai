import { LifecycleError, type LifecycleOutcome } from './state'
import { adminSubscriptionActionKey, type AdminSubscriptionPlan } from './admin-subscription-plan'

export type AdminSubscriptionFact = {
  version: 1; source: 'admin'; operationId: string; actionKey: string
  subscriptionId: string; customerId: string; mode: 'test' | 'live'
  proof: 'write_ack' | 'already_desired' | 'irreversible_terminal'
  status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number
  outcome: LifecycleOutcome
}

const fail = (): never => { throw new LifecycleError('ADMIN_SUBSCRIPTION_FACT_UNAVAILABLE') }
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',')

export function verifyAdminSubscriptionFact(plan: AdminSubscriptionPlan, value: Omit<AdminSubscriptionFact, 'version' | 'source' | 'operationId' | 'actionKey' | 'subscriptionId' | 'customerId' | 'mode' | 'outcome'>): AdminSubscriptionFact {
  const outcome: LifecycleOutcome = {
    proof: plan.intent === 'immediate_cancel' ? 'irreversible_terminal' : 'ack',
    resourceId: plan.target.id,
    status: plan.intent === 'resume' ? 'resumed' : plan.intent === 'period_end_cancel' ? 'scheduled_cancel' : 'canceled',
  }
  const fact: AdminSubscriptionFact = {
    version: 1, source: 'admin', operationId: plan.identity.operationId,
    actionKey: adminSubscriptionActionKey(plan), subscriptionId: plan.target.id,
    customerId: plan.target.customerId, mode: plan.mode, ...value, outcome,
  }
  assertAdminSubscriptionFact(plan, JSON.stringify(fact))
  return fact
}

export function assertAdminSubscriptionFact(plan: AdminSubscriptionPlan, raw: string): AdminSubscriptionFact {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) return fail()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return fail() }
  if (!exact(value, ['version', 'source', 'operationId', 'actionKey', 'subscriptionId', 'customerId', 'mode',
    'proof', 'status', 'cancelAtPeriodEnd', 'currentPeriodEnd', 'outcome'])) return fail()
  const fact = value as AdminSubscriptionFact
  if (fact.version !== 1 || fact.source !== 'admin' || fact.operationId !== plan.identity.operationId ||
      fact.actionKey !== adminSubscriptionActionKey(plan) || fact.subscriptionId !== plan.target.id ||
      fact.customerId !== plan.target.customerId || fact.mode !== plan.mode ||
      !['write_ack', 'already_desired', 'irreversible_terminal'].includes(fact.proof) ||
      typeof fact.cancelAtPeriodEnd !== 'boolean' || !Number.isSafeInteger(fact.currentPeriodEnd) ||
      fact.currentPeriodEnd <= 0 || !exact(fact.outcome, ['proof', 'resourceId', 'status']) ||
      fact.outcome.resourceId !== plan.target.id ||
      fact.outcome.proof !== (plan.intent === 'immediate_cancel' ? 'irreversible_terminal' : 'ack') ||
      fact.outcome.status !== (plan.intent === 'resume' ? 'resumed' : plan.intent === 'period_end_cancel' ? 'scheduled_cancel' : 'canceled') ||
      (plan.intent === 'immediate_cancel' ? fact.status !== 'canceled' || fact.proof !== 'irreversible_terminal'
        : !['active', 'trialing', 'past_due'].includes(fact.status) ||
          fact.cancelAtPeriodEnd !== (plan.intent === 'period_end_cancel') || fact.proof === 'irreversible_terminal') ||
      fact.proof === 'already_desired' && plan.target.cancelAtPeriodEnd !== fact.cancelAtPeriodEnd) return fail()
  return fact
}
