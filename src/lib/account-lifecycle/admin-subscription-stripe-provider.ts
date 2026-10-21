import 'server-only'
import type Stripe from 'stripe'
import { LifecycleError } from './state'
import { verifyAdminSubscriptionFact, type AdminSubscriptionFact } from './admin-subscription-fact'
import type { AdminSubscriptionPlan, AdminSubscriptionTarget } from './admin-subscription-plan'
import { stripe, findActiveLikeSubscriptions, isDoyaSubscriptionOwnedByUser,
  resolvePlanIdFromSubscription, planTierFromPlanId, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
import type { BillingSyncInput } from '@/lib/billing-sync'

export type AdminSubscriptionUser = {
  id: string; email: string; stripeCustomerId: string | null
  stripeSubscriptionId: string; stripePriceId: string | null
}
const unknown = (): never => { throw new LifecycleError('ADMIN_SUBSCRIPTION_PROVIDER_UNKNOWN') }
const customerId = (value: Stripe.Subscription['customer']) => typeof value === 'string' ? value : value?.id || ''
const rank: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

/** SDK and discovery are injected for synthetic tests. No SDK write is possible before the durable dispatch callback. */
export function adminSubscriptionStripeProvider(sdk: Stripe, mode: 'test' | 'live',
  discover = findActiveLikeSubscriptions, owned = isDoyaSubscriptionOwnedByUser) {
  const live = mode === 'live'
  async function exact(id: string, user: AdminSubscriptionUser) {
    const raw = await sdk.subscriptions.retrieve(id)
    if (raw.id !== id || raw.livemode !== live || !customerId(raw.customer) ||
        !await owned(raw, { id: user.id, email: user.email })) return unknown()
    return raw
  }
  function target(raw: Stripe.Subscription): AdminSubscriptionTarget {
    if (!ACTIVE_LIKE_STATUSES.has(String(raw.status)) || !Number.isSafeInteger(raw.current_period_end) || raw.current_period_end <= 0)
      return unknown()
    return { id: raw.id, customerId: customerId(raw.customer), status: raw.status as AdminSubscriptionTarget['status'],
      cancelAtPeriodEnd: raw.cancel_at_period_end, currentPeriodEnd: raw.current_period_end }
  }
  return {
    async discover(user: AdminSubscriptionUser) {
      const raw = await exact(user.stripeSubscriptionId, user)
      return target(raw)
    },
    async readExact(plan: AdminSubscriptionPlan, user: AdminSubscriptionUser) {
      if (plan.mode !== mode || user.id !== plan.identity.targetUserId || user.email !== plan.email) return unknown()
      return exact(plan.target.id, user)
    },
    async mutate(plan: AdminSubscriptionPlan, user: AdminSubscriptionUser, beforeWrite: () => Promise<void>): Promise<AdminSubscriptionFact> {
      if (plan.mode !== mode || plan.identity.targetUserId !== user.id || plan.email !== user.email ||
          plan.expectedCustomerId !== user.stripeCustomerId || plan.expectedSubscriptionId !== user.stripeSubscriptionId ||
          plan.expectedPriceId !== user.stripePriceId) return unknown()
      const before = await exact(plan.target.id, user)
      const snapshot = target(before)
      if (JSON.stringify(snapshot) !== JSON.stringify(plan.target)) return unknown()
      const desired = plan.intent !== 'resume'
      if (plan.intent !== 'immediate_cancel' && before.cancel_at_period_end === desired) {
        return verifyAdminSubscriptionFact(plan, { proof: 'already_desired', status: before.status,
          cancelAtPeriodEnd: before.cancel_at_period_end, currentPeriodEnd: before.current_period_end })
      }
      await beforeWrite()
      const idempotencyKey = `doya-admin-subscription-v1:${plan.identity.operationId}:${plan.inputDigest}`
      const result = plan.intent === 'immediate_cancel'
        ? await sdk.subscriptions.cancel(plan.target.id, {}, { idempotencyKey })
        : await sdk.subscriptions.update(plan.target.id, { cancel_at_period_end: desired }, { idempotencyKey })
      if (result.id !== plan.target.id || result.livemode !== live || customerId(result.customer) !== plan.target.customerId ||
          !await owned(result, { id: user.id, email: user.email })) return unknown()
      return verifyAdminSubscriptionFact(plan, { proof: plan.intent === 'immediate_cancel' ? 'irreversible_terminal' : 'write_ack',
        status: result.status, cancelAtPeriodEnd: result.cancel_at_period_end, currentPeriodEnd: result.current_period_end })
    },
    async reconcileImmediate(plan: AdminSubscriptionPlan, user: AdminSubscriptionUser) {
      if (plan.intent !== 'immediate_cancel' || plan.mode !== mode ||
          plan.identity.targetUserId !== user.id || plan.email !== user.email ||
          plan.expectedCustomerId !== user.stripeCustomerId ||
          plan.expectedSubscriptionId !== user.stripeSubscriptionId ||
          plan.expectedPriceId !== user.stripePriceId) return unknown()
      const raw = await exact(plan.target.id, user)
      if (customerId(raw.customer) !== plan.target.customerId) return unknown()
      return verifyAdminSubscriptionFact(plan, { proof: 'irreversible_terminal', status: raw.status,
        cancelAtPeriodEnd: raw.cancel_at_period_end, currentPeriodEnd: raw.current_period_end })
    },
    /** Read all surviving live contracts after an immutable canceled fact. Failure never means no survivors. */
    async settlement(plan: AdminSubscriptionPlan, user: AdminSubscriptionUser): Promise<BillingSyncInput> {
      if (plan.intent !== 'immediate_cancel' || plan.mode !== mode || plan.email !== user.email) return unknown()
      const remaining = await discover({ userId: user.id, email: user.email, stripeCustomerId: user.stripeCustomerId })
      if (remaining.some(item => item.id === plan.target.id) || remaining.length > 128) return unknown()
      const ranked = remaining.map(item => ({ item, tier: planTierFromPlanId(item.planId) }))
      if (ranked.some(item => item.tier === 'FREE')) return unknown()
      ranked.sort((a, b) => rank[b.tier]! - rank[a.tier]! || (a.item.id < b.item.id ? -1 : 1))
      const best = ranked[0]
      if (!best) return { userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
        stripePriceId: null, stripeCurrentPeriodEnd: null }
      const raw = await exact(best.item.id, user)
      if (!ACTIVE_LIKE_STATUSES.has(raw.status) || customerId(raw.customer) !== best.item.customerId ||
          !Number.isSafeInteger(raw.current_period_end) || raw.current_period_end <= 0) return unknown()
      const resolved = resolvePlanIdFromSubscription(raw)
      const tier = planTierFromPlanId(resolved.planId)
      if (tier === 'FREE' || tier !== best.tier || resolved.priceId !== best.item.priceId) return unknown()
      return { userId: user.id, plan: tier, stripeCustomerId: customerId(raw.customer),
        stripeSubscriptionId: raw.id, stripePriceId: resolved.priceId,
        stripeCurrentPeriodEnd: new Date(raw.current_period_end * 1000) }
    },
  }
}

export const liveAdminSubscriptionStripeProvider = (mode: 'test' | 'live') => adminSubscriptionStripeProvider(stripe, mode)
