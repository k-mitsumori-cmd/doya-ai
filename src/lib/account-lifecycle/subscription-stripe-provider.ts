import 'server-only'
import type Stripe from 'stripe'
import { LifecycleError } from './state'
import { verifySubscriptionFact, type VerifiedSubscriptionFact } from './subscription-provider'
import type { SubscriptionPlan, SubscriptionTarget } from './subscription-plan'
import { stripe, findActiveLikeSubscriptions, isDoyaSubscriptionOwnedByUser, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'

export type SubscriptionActor = {
  id: string; email: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null
  savedSubscriptionId: string | null
}
const unknown = (): never => { throw new LifecycleError('SUBSCRIPTION_PROVIDER_RESULT_UNKNOWN') }
const customerId = (value: Stripe.Subscription['customer']) => typeof value === 'string' ? value : value?.id || ''

/** The SDK is injected for isolated synthetic transport tests; no real call is made by construction. */
export function subscriptionStripeProvider(sdk: Stripe, mode: 'test' | 'live', discover = findActiveLikeSubscriptions,
  owned = isDoyaSubscriptionOwnedByUser) {
  const expectedLive = mode === 'live'
  async function exact(subscriptionId: string, actor: SubscriptionActor): Promise<Stripe.Subscription> {
    const raw = await sdk.subscriptions.retrieve(subscriptionId)
    if (raw.id !== subscriptionId || raw.livemode !== expectedLive || !customerId(raw.customer) ||
        !await owned(raw, { id: actor.id, email: actor.email })) return unknown()
    return raw
  }
  return {
    async discover(actor: SubscriptionActor, kind: 'cancel' | 'resume'): Promise<SubscriptionTarget[]> {
      const live = await discover({ userId: actor.id, email: actor.email, stripeCustomerId: actor.stripeCustomerId })
      if (live.length === 0 && kind === 'cancel' && actor.savedSubscriptionId) {
        try {
          const saved = await exact(actor.savedSubscriptionId, actor)
          if (ACTIVE_LIKE_STATUSES.has(saved.status)) live.push({ id: saved.id, status: saved.status, customerId: customerId(saved.customer), priceId: null, planId: '' })
        } catch (error) {
          if ((error as { code?: string })?.code !== 'resource_missing') throw error
        }
      }
      if (live.length === 0) throw new LifecycleError('SUBSCRIPTION_NOT_FOUND', 404)
      if (kind === 'resume' && live.length !== 1) throw new LifecycleError('MULTIPLE_SUBSCRIPTIONS')
      if (live.length > 128) throw new LifecycleError('SUBSCRIPTION_TARGET_SET_TOO_LARGE')
      const targets: SubscriptionTarget[] = []
      for (const item of live) {
        const raw = await exact(item.id, actor)
        if (customerId(raw.customer) !== item.customerId || !ACTIVE_LIKE_STATUSES.has(raw.status) ||
            !Number.isSafeInteger(raw.current_period_end) || raw.current_period_end <= 0) return unknown()
        targets.push({ id: raw.id, customerId: customerId(raw.customer), status: raw.status,
          cancelAtPeriodEnd: raw.cancel_at_period_end, currentPeriodEnd: raw.current_period_end })
      }
      targets.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      if (new Set(targets.map(t => t.id)).size !== targets.length) return unknown()
      return targets
    },
    async mutate(plan: SubscriptionPlan, target: SubscriptionTarget, actionKey: string, actor: SubscriptionActor,
      beforeWrite: () => Promise<void>): Promise<VerifiedSubscriptionFact> {
      if (plan.mode !== mode || plan.identity.targetUserId !== actor.id || actor.email !== plan.email ||
          actor.stripeCustomerId !== plan.expectedCustomerId || actor.stripeSubscriptionId !== plan.expectedSubscriptionId) return unknown()
      const before = await exact(target.id, actor)
      if (customerId(before.customer) !== target.customerId || !ACTIVE_LIKE_STATUSES.has(before.status) ||
          before.status !== target.status || before.cancel_at_period_end !== target.cancelAtPeriodEnd ||
          before.current_period_end !== target.currentPeriodEnd) return unknown()
      // Provider state already satisfies an explicit resume; this is a read-only success.
      if (plan.identity.kind === 'resume' && !before.cancel_at_period_end) {
        return verifySubscriptionFact(plan, target, actionKey, {
          id: before.id, customerId: customerId(before.customer), livemode: before.livemode, status: before.status,
          cancelAtPeriodEnd: before.cancel_at_period_end, currentPeriodEnd: before.current_period_end,
        })
      }
      await beforeWrite()
      const idempotencyKey = `doya-subscription-v1:${plan.identity.operationId}:${actionKey}`
      const updated = plan.identity.kind === 'resume'
        ? await sdk.subscriptions.update(target.id, { cancel_at_period_end: false }, { idempotencyKey })
        : plan.cancelMode === 'period_end'
          ? await sdk.subscriptions.update(target.id, { cancel_at_period_end: true }, { idempotencyKey })
          : await sdk.subscriptions.cancel(target.id, {}, { idempotencyKey })
      if (!await owned(updated, { id: actor.id, email: actor.email })) return unknown()
      return verifySubscriptionFact(plan, target, actionKey, {
        id: updated.id, customerId: customerId(updated.customer), livemode: updated.livemode, status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end, currentPeriodEnd: updated.current_period_end,
      })
    },
    async readExact(id: string, actor: SubscriptionActor) { return exact(id, actor) },
  }
}

export const liveSubscriptionStripeProvider = (mode: 'test' | 'live') => subscriptionStripeProvider(stripe, mode)
