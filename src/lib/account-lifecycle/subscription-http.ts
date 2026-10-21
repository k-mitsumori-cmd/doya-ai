import 'server-only'
import type { Session } from 'next-auth'
import { LifecycleError, validLifecycleUuid } from './state'
import { subscriptionCoordinator, type SubscriptionAction } from './subscription'
import { liveSubscriptionStripeProvider } from './subscription-stripe-provider'
import { stripeModeFromSecret } from './checkout-stripe-provider'
import { prisma } from '@/lib/prisma'

const invalid = (): never => { throw new LifecycleError('INVALID_SUBSCRIPTION_ACTION', 400) }
const plain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(',') === keys.sort().join(',')

export function parseSubscriptionHttpAction(value: unknown, kind: 'cancel' | 'resume'): SubscriptionAction {
  if (!plain(value) || !validLifecycleUuid(value.operationId) || typeof value.expectedActorId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(value.expectedActorId)) return invalid()
  if (value.action === 'start') {
    if (!['banner', 'seo', 'kantan'].includes(value.serviceId as string) ||
        kind === 'cancel' && !(value.mode === undefined || value.mode === 'period_end' || value.mode === 'immediate') ||
        kind === 'resume' && value.mode !== undefined ||
        !exact(value, ['action', 'operationId', 'expectedActorId', 'serviceId', ...(value.mode === undefined ? [] : ['mode'])])) return invalid()
    return value as SubscriptionAction
  }
  if (!['status', 'continue', 'reconcile', 'abort'].includes(value.action as string) ||
      !exact(value, ['action', 'operationId', 'expectedActorId'])) return invalid()
  return value as SubscriptionAction
}

/** Session ID and email must resolve to the same current User; expectedActorId adds a match only. */
export async function resolveSubscriptionActor(session: Session | null, action: SubscriptionAction) {
  const sessionUser = session?.user as { id?: string; email?: string } | undefined
  const sessionId = typeof sessionUser?.id === 'string' ? sessionUser.id : null
  const email = typeof sessionUser?.email === 'string' ? sessionUser.email.trim().toLowerCase() : null
  if (!sessionId && !email) throw new LifecycleError('SUBSCRIPTION_AUTH_REQUIRED', 401)
  const byEmail = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }) : null
  if (sessionId && email && byEmail?.id !== sessionId) throw new LifecycleError('SUBSCRIPTION_ACTOR_MISMATCH', 403)
  const user = await prisma.user.findUnique({ where: { id: byEmail?.id ?? sessionId ?? '' }, select: {
    id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true,
    serviceSubscriptions: { where: { serviceId: action.action === 'start' ? action.serviceId : 'banner' }, select: { stripeSubscriptionId: true }, take: 1 },
  } })
  if (!user || !user.email || user.id !== action.expectedActorId || email && user.email.trim().toLowerCase() !== email) throw new LifecycleError('SUBSCRIPTION_ACTOR_MISMATCH', 403)
  return { id: user.id, email: user.email.trim().toLowerCase(), stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    savedSubscriptionId: action.action === 'start' ? user.serviceSubscriptions[0]?.stripeSubscriptionId ?? user.stripeSubscriptionId : null }
}

export async function runSubscriptionHttpAction(kind: 'cancel' | 'resume', action: SubscriptionAction, session: Session | null) {
  const actor = await resolveSubscriptionActor(session, action)
  const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY)
  const coordinator = subscriptionCoordinator(prisma, liveSubscriptionStripeProvider(mode), mode)
  return coordinator.handle(kind, actor, action)
}
