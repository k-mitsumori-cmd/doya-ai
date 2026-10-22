import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { LifecycleError, type LifecycleIdentity } from './state'
import { makeAdminSubscriptionPlan, type AdminSubscriptionIntent } from './admin-subscription-plan'
import type { AdminSubscriptionUser, adminSubscriptionStripeProvider } from './admin-subscription-stripe-provider'
import {
  abortAdminSubscriptionLifecycle, admitAdminSubscriptionLifecycle, assertAdminSubscriptionDispatchBound,
  completeAdminSubscriptionLifecycle, confirmAdminSubscriptionAction, continueAdminSubscriptionLifecycle,
  dispatchAdminSubscriptionAction, markAdminSubscriptionUnknown, readAdminSubscriptionServerState,
  startAdminSubscriptionLifecycle,
} from './store'

export type AdminSubscriptionProvider = ReturnType<typeof adminSubscriptionStripeProvider>
export type AdminSubscriptionAction =
  | { action: 'start'; operationId: string; expectedAdminId: string; targetUserId: string; intent: AdminSubscriptionIntent }
  | { action: 'status' | 'continue' | 'reconcile' | 'abort'; operationId: string; expectedAdminId: string; targetUserId: string; intent: AdminSubscriptionIntent }

type Context = { adminId: string; sessionToken: string }
const identity = (ctx: Context, action: AdminSubscriptionAction): LifecycleIdentity => ({
  operator: { kind: 'admin', id: ctx.adminId }, targetUserId: action.targetUserId,
  operationId: action.operationId, kind: action.intent === 'resume' ? 'resume' : 'cancel',
})
const unconfirmed = () => { throw new LifecycleError('ADMIN_SUBSCRIPTION_RESULT_UNCONFIRMED') }

export function adminSubscriptionCoordinator(db: PrismaClient, provider: AdminSubscriptionProvider, mode: 'test' | 'live') {
  async function read(id: LifecycleIdentity, ctx: Context, intent: AdminSubscriptionIntent) {
    const state = await readAdminSubscriptionServerState(db, id, ctx.sessionToken)
    if (state.plan && state.plan.intent !== intent) throw new LifecycleError('ADMIN_SUBSCRIPTION_IDENTITY_CHANGED')
    return state
  }
  async function view(id: LifecycleIdentity, ctx: Context, intent: AdminSubscriptionIntent) {
    const state = await read(id, ctx, intent)
    return { source: 'admin' as const, actorId: ctx.adminId, targetUserId: id.targetUserId,
      operationId: id.operationId, intent, phase: state.phase, reason: state.reason,
      canAbort: state.canAbort, canContinue: state.canContinue,
      actionPhase: state.action?.phase ?? null,
      result: state.phase === 'completed' ? 'confirmed' as const : null }
  }
  async function targetUser(id: LifecycleIdentity): Promise<AdminSubscriptionUser> {
    const user = await db.user.findUnique({ where: { id: id.targetUserId }, select: {
      id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, stripePriceId: true,
    } })
    if (!user || !user.email || !user.stripeSubscriptionId) throw new LifecycleError('ADMIN_SUBSCRIPTION_TARGET_UNAVAILABLE')
    return { ...user, email: user.email.trim().toLowerCase(), stripeSubscriptionId: user.stripeSubscriptionId }
  }
  async function settle(id: LifecycleIdentity, ctx: Context, intent: AdminSubscriptionIntent) {
    const state = await read(id, ctx, intent)
    if (!state.plan || !state.claim || state.phase !== 'executing' || state.action?.phase !== 'confirmed') return
    if (state.plan.mode !== mode) throw new LifecycleError('ADMIN_SUBSCRIPTION_MODE_MISMATCH')
    // Provider discovery is outside the final transaction. The final transaction rechecks all saved refs/authority.
    const input = intent === 'immediate_cancel'
      ? await provider.settlement(state.plan, await targetUser(id)) : null
    await completeAdminSubscriptionLifecycle(db, state.claim, ctx.sessionToken, input)
  }
  async function execute(id: LifecycleIdentity, ctx: Context, intent: AdminSubscriptionIntent,
    claim: NonNullable<Awaited<ReturnType<typeof readAdminSubscriptionServerState>>>['claim']) {
    if (!claim) return unconfirmed()
    const dispatch = await dispatchAdminSubscriptionAction(db, claim, ctx.sessionToken)
    try {
      await assertAdminSubscriptionDispatchBound(db, claim, ctx.sessionToken, dispatch.dispatchToken)
      const user = await targetUser(id)
      const fact = await provider.mutate(dispatch.plan, user,
        () => assertAdminSubscriptionDispatchBound(db, claim, ctx.sessionToken, dispatch.dispatchToken).then(() => undefined))
      await confirmAdminSubscriptionAction(db, claim, dispatch.dispatchToken, fact)
    } catch {
      // The provider may have received the request. Never retry an already dispatched action.
      await markAdminSubscriptionUnknown(db, claim, dispatch.dispatchToken).catch(() => undefined)
      return view(id, ctx, intent)
    }
    try { await settle(id, ctx, intent) } catch { /* Confirmed fact and fence remain for explicit same-ID recovery. */ }
    return view(id, ctx, intent)
  }
  return {
    async handle(ctx: Context, action: AdminSubscriptionAction) {
      if (ctx.adminId !== action.expectedAdminId) throw new LifecycleError('ADMIN_SUBSCRIPTION_ACTOR_MISMATCH', 403)
      const id = identity(ctx, action)
      const current = await read(id, ctx, action.intent)
      if (action.action === 'status') return view(id, ctx, action.intent)
      if (action.action === 'abort') {
        if (current.phase === 'aborted') return view(id, ctx, action.intent)
        if (current.phase !== 'missing' && current.phase !== 'reserved') throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
        await abortAdminSubscriptionLifecycle(db, id, ctx.sessionToken)
        return view(id, ctx, action.intent)
      }
      if (action.action === 'reconcile') {
        if (!current.plan || current.plan.mode !== mode) return view(id, ctx, action.intent)
        if (current.action?.phase === 'dispatched' && current.action.dispatchToken && current.claim &&
            action.intent === 'immediate_cancel') {
          try {
            const fact = await provider.reconcileImmediate(current.plan, await targetUser(id))
            await confirmAdminSubscriptionAction(db, current.claim, current.action.dispatchToken, fact)
          } catch { /* The unknown fence remains; provider reads never authorize a second write. */ }
        }
        try { await settle(id, ctx, action.intent) } catch { /* Keep durable fact pending. */ }
        return view(id, ctx, action.intent)
      }
      if (action.action === 'continue') {
        if (!current.plan || current.plan.mode !== mode || !current.claim || !current.canContinue ||
            current.action?.phase !== 'planned') return unconfirmed()
        const claim = await continueAdminSubscriptionLifecycle(db, id, ctx.sessionToken)
        if (current.phase === 'reserved') await startAdminSubscriptionLifecycle(db, claim, ctx.sessionToken)
        return execute(id, ctx, action.intent, claim)
      }
      if (action.action !== 'start') throw new LifecycleError('INVALID_ADMIN_SUBSCRIPTION_ACTION', 400)
      // Duplicate starts are observations only. A new request cannot rediscover a different provider target for the same UUID.
      if (current.phase !== 'missing') return view(id, ctx, action.intent)
      if (!current.canAbort) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
      const user = await targetUser(id)
      const target = await provider.discover(user)
      const plan = makeAdminSubscriptionPlan({ identity: id, intent: action.intent, mode,
        email: user.email, expectedCustomerId: user.stripeCustomerId,
        expectedSubscriptionId: user.stripeSubscriptionId, expectedPriceId: user.stripePriceId, target })
      const admitted = await admitAdminSubscriptionLifecycle(db, plan, ctx.sessionToken)
      if (!admitted.created || !admitted.claim || admitted.phase !== 'reserved') return view(id, ctx, action.intent)
      await startAdminSubscriptionLifecycle(db, admitted.claim, ctx.sessionToken)
      return execute(id, ctx, action.intent, admitted.claim)
    },
  }
}
