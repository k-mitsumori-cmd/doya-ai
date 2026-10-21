import 'server-only'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { LifecycleError, type LifecycleIdentity } from './state'
import { makeSubscriptionPlan, subscriptionActionKeys, type SubscriptionPlan } from './subscription-plan'
import { verifySubscriptionFact } from './subscription-provider'
import {
  abortUnstartedLifecycleOperation, admitSubscriptionLifecycle, assertSubscriptionDispatchBound,
  completeSubscriptionLifecycle, confirmSubscriptionAction, dispatchSubscriptionAction,
  markSubscriptionUnknown, readSubscriptionLifecycle, readSubscriptionServerState,
  resumeLifecycleOperation, startLifecycleOperation,
} from './store'
import type { SubscriptionActor } from './subscription-stripe-provider'

export type SubscriptionProvider = {
  discover(actor: SubscriptionActor, kind: 'cancel' | 'resume'): Promise<SubscriptionPlan['targets']>
  mutate(plan: SubscriptionPlan, target: SubscriptionPlan['targets'][number], actionKey: string,
    actor: SubscriptionActor, beforeWrite: () => Promise<void>): Promise<import('./subscription-provider').VerifiedSubscriptionFact>
  readExact(id: string, actor: SubscriptionActor): Promise<Stripe.Subscription>
}

export type SubscriptionAction =
  | { action: 'start'; operationId: string; expectedActorId: string; serviceId: 'banner' | 'seo' | 'kantan'; mode?: 'period_end' | 'immediate' }
  | { action: 'status' | 'continue' | 'reconcile' | 'abort'; operationId: string; expectedActorId: string }

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const identity = (actorId: string, operationId: string, kind: 'cancel' | 'resume'): LifecycleIdentity =>
  ({ operator: { kind: 'user', id: actorId }, targetUserId: actorId, operationId, kind })

/** A planned action may be retried explicitly; a dispatched or unknown action never is. */
export function subscriptionCoordinator(db: PrismaClient, provider: SubscriptionProvider, mode: 'test' | 'live') {
  async function view(id: LifecycleIdentity, actorId: string) {
    return { ...(await readSubscriptionLifecycle(db, id)), actorId }
  }
  async function execute(id: LifecycleIdentity, actor: SubscriptionActor, plan: SubscriptionPlan,
    claim: NonNullable<Awaited<ReturnType<typeof readSubscriptionServerState>>>['claim']) {
    if (!claim) throw new LifecycleError('LIFECYCLE_CLAIM_CHANGED')
    const keys = subscriptionActionKeys(plan)
    for (let n = 0; n < keys.length; n++) {
      const current = await readSubscriptionServerState(db, id)
      if (!current || current.reason || !current.claim || current.claim.generation !== claim.generation || current.claim.token !== claim.token) break
      if (current.actions.some(a => a.phase === 'dispatched')) break
      if (current.actions.find(a => a.key === keys[n])?.phase === 'confirmed') continue
      const key = keys[n]!
      const dispatch = await dispatchSubscriptionAction(db, claim, key)
      try {
        await assertSubscriptionDispatchBound(db, claim, key, dispatch.dispatchToken)
        const fact = await provider.mutate(plan, plan.targets[n]!, key, actor,
          () => assertSubscriptionDispatchBound(db, claim, key, dispatch.dispatchToken).then(() => undefined))
        await confirmSubscriptionAction(db, claim, key, dispatch.dispatchToken, fact)
      } catch {
        await markSubscriptionUnknown(db, claim, key, dispatch.dispatchToken).catch(() => undefined)
        break
      }
    }
    const current = await readSubscriptionServerState(db, id)
    if (current?.claim && current.phase === 'executing' && current.reason === null && current.actions.length === plan.targets.length && current.actions.every(a => a.phase === 'confirmed')) {
      try { await completeSubscriptionLifecycle(db, current.claim) } catch { /* Persistent facts remain for explicit settlement. */ }
    }
    return view(id, actor.id)
  }
  return {
    async handle(kind: 'cancel' | 'resume', actor: SubscriptionActor, action: SubscriptionAction) {
      if (actor.id !== action.expectedActorId) throw new LifecycleError('SUBSCRIPTION_ACTOR_MISMATCH', 403)
      const id = identity(actor.id, action.operationId, kind)
      if (action.action === 'status') return view(id, actor.id)
      if (action.action === 'abort') {
        const current = await readSubscriptionServerState(db, id)
        // A lost abort response must observe the authoritative terminal without inventing the old plan digest.
        if (current?.phase === 'aborted') return view(id, actor.id)
        if (current && current.phase !== 'reserved' && current.phase !== 'aborted') throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
        await abortUnstartedLifecycleOperation(db, id, current?.plan?.inputDigest ?? digest([id, 'aborted-without-dispatch']))
        return view(id, actor.id)
      }
      if (action.action === 'reconcile') {
        const current = await readSubscriptionServerState(db, id)
        if (!current?.plan || !current.claim || current.plan.mode !== mode) return view(id, actor.id)
        // A reversible boolean cannot correlate a lost response to this operation.
        // Only an irreversible terminal cancel may settle from an exact provider read.
        if (kind === 'cancel' && current.plan.cancelMode === 'immediate') {
          for (const dispatched of current.actions.filter(a => a.phase === 'dispatched' && a.dispatchToken)) {
            const target = current.plan.targets.find(t => t.id === dispatched.resourceId)
            if (!target) continue
            try {
              const raw = await provider.readExact(target.id, actor)
              const customerId = typeof raw.customer === 'string' ? raw.customer : raw.customer?.id || ''
              const fact = verifySubscriptionFact(current.plan, target, dispatched.key, {
                id: raw.id, customerId, livemode: raw.livemode, status: raw.status,
                cancelAtPeriodEnd: raw.cancel_at_period_end, currentPeriodEnd: raw.current_period_end,
              })
              await confirmSubscriptionAction(db, current.claim, dispatched.key, dispatched.dispatchToken!, fact)
            } catch { /* Preserve the unknown fence and never send a second write. */ }
          }
          const updated = await readSubscriptionServerState(db, id)
          if (updated?.claim && updated.actions.length > 0 && updated.actions.every(a => a.phase === 'confirmed')) {
            try { await completeSubscriptionLifecycle(db, updated.claim) } catch { /* Keep local settlement pending. */ }
          }
        }
        return view(id, actor.id)
      }
      if (action.action === 'continue') {
        const current = await readSubscriptionServerState(db, id)
        if (!current?.plan || !current.claim || current.reason !== null || current.actions.some(a => a.phase === 'dispatched')) throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
        if (current.plan.mode !== mode) throw new LifecycleError('SUBSCRIPTION_STRIPE_MODE_MISMATCH')
        const claim = await resumeLifecycleOperation(db, id)
        if (current.phase === 'reserved') await startLifecycleOperation(db, claim)
        return execute(id, actor, current.plan, claim)
      }
      const targets = await provider.discover(actor, kind)
      const plan = makeSubscriptionPlan({ identity: id, mode, email: actor.email,
        expectedCustomerId: actor.stripeCustomerId, expectedSubscriptionId: actor.stripeSubscriptionId,
        serviceId: action.serviceId, cancelMode: kind === 'cancel' ? action.mode ?? 'period_end' : null, targets })
      const admitted = await admitSubscriptionLifecycle(db, plan)
      // A duplicate start observes the existing authority; it never replays a provider write.
      if (!admitted.created || admitted.phase !== 'reserved' || !admitted.claim) return view(id, actor.id)
      const current = await readSubscriptionServerState(db, id)
      if (!current?.claim || current.claim.generation !== admitted.claim.generation || current.phase !== 'reserved') return view(id, actor.id)
      await startLifecycleOperation(db, admitted.claim)
      return execute(id, actor, plan, admitted.claim)
    },
  }
}
