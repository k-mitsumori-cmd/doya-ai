import 'server-only'
import type { Session } from 'next-auth'
import type { PrismaClient } from '@prisma/client'
import { LifecycleError, validLifecycleDigest, validLifecycleUuid, type LifecycleIdentity } from './state'
import { checkoutKeys, exactCheckoutObject, type CheckoutPlan, type CheckoutRequest } from './checkout-receipt'
import { checkoutCoordinator } from './checkout'
import { readCheckoutBoundOperation } from './checkout-store'
import { checkoutProviderAdapter } from './checkout-provider'
import { checkoutStripeProvider, stripeModeFromSecret } from './checkout-stripe-provider'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export type CheckoutHttpAction =
  | { action: 'start' | 'start_after_terminal'; operationId: string; previousOperationId?: string; expectedActorId?: string }
  | { action: 'status' | 'resume' | 'ready' | 'abort'; operationId: string; expectedActorId?: string }

export type CheckoutEndpointScope = {
  source: 'generic' | 'hr'
  authorizePlan: (plan: CheckoutPlan | null) => Promise<void>
}

const invalid = (): never => { throw new LifecycleError('INVALID_CHECKOUT_ACTION', 400) }
const plain = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** The caller-specific route validates its own plan fields; unknown HTTP action fields fail closed here. */
export function parseCheckoutHttpAction(value: unknown, planKeys: string[]): CheckoutHttpAction {
  if (!plain(value) || !validLifecycleUuid(value.operationId) || typeof value.action !== 'string') return invalid()
  const action = value.action
  const common = ['action', 'operationId', ...(value.expectedActorId === undefined ? [] : ['expectedActorId'])]
  if (value.expectedActorId !== undefined && (typeof value.expectedActorId !== 'string' || value.expectedActorId.length < 1 || value.expectedActorId.length > 128)) return invalid()
  if (['status', 'resume', 'ready', 'abort'].includes(action)) {
    if (Object.keys(value).sort().join(',') !== common.sort().join(',')) return invalid()
    return value as CheckoutHttpAction
  }
  if (action !== 'start' && action !== 'start_after_terminal') return invalid()
  const keys = [...common, ...planKeys, ...(action === 'start_after_terminal' ? ['previousOperationId'] : [])]
  if (Object.keys(value).sort().join(',') !== keys.sort().join(',') || action === 'start_after_terminal' && (!validLifecycleUuid(value.previousOperationId) || value.previousOperationId === value.operationId)) return invalid()
  return value as CheckoutHttpAction
}

/** Session ID and email resolution must agree before any operation/HR/provider read. */
export async function resolveCheckoutActor(session: Session | null, expectedActorId?: string, db: PrismaClient = prisma) {
  const sessionId = typeof session?.user?.id === 'string' ? session.user.id : null
  const email = typeof session?.user?.email === 'string' ? session.user.email.trim().toLowerCase() : null
  if (!sessionId && !email) throw new LifecycleError('CHECKOUT_AUTH_REQUIRED', 401)
  const byEmail = email ? await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, stripeCustomerId: true } }) : null
  if (sessionId && email && (!byEmail || byEmail.id !== sessionId)) throw new LifecycleError('CHECKOUT_ACTOR_MISMATCH', 403)
  const user = byEmail ?? (sessionId ? await db.user.findUnique({ where: { id: sessionId }, select: { id: true, email: true, name: true, stripeCustomerId: true } }) : null)
  if (!user) throw new LifecycleError('CHECKOUT_ACTOR_UNAVAILABLE', 404)
  if (expectedActorId && expectedActorId !== user.id) throw new LifecycleError('CHECKOUT_ACTOR_MISMATCH', 403)
  return user
}

export function checkoutIdentity(actorId: string, operationId: string): LifecycleIdentity {
  return { operator: { kind: 'user', id: actorId }, targetUserId: actorId, operationId, kind: 'checkout' }
}

export async function currentCheckoutEpoch(mode: 'test' | 'live', db: PrismaClient = prisma): Promise<string> {
  const row = await db.systemSetting.findUnique({ where: { key: checkoutKeys.cutover(mode) }, select: { value: true } })
  if (!row) throw new LifecycleError('CHECKOUT_CUTOVER_NOT_VERIFIED', 503)
  let marker: unknown
  try { marker = JSON.parse(row.value) } catch { throw new LifecycleError('CHECKOUT_CUTOVER_NOT_VERIFIED', 503) }
  if (!exactCheckoutObject(marker, 'version,mode,epoch,coverage,evidenceDigest') || marker.version !== 1 || marker.mode !== mode || !validLifecycleUuid(marker.epoch) || marker.coverage !== 'old_ingress_stopped_and_workers_reconciled' || !validLifecycleDigest(marker.evidenceDigest)) throw new LifecycleError('CHECKOUT_CUTOVER_NOT_VERIFIED', 503)
  return marker.epoch as string
}

/** The actual server principal is returned on every successful action. */
export function checkoutHttpResult<T extends object>(result: T, actorId: string) {
  if ('id' in result) {
    const ready = result as T & { id: string; operationId: string; url: string }
    return { actorId, operationId: ready.operationId, sessionId: ready.id, url: ready.url }
  }
  return { ...result, actorId }
}

export async function runCheckoutHttpAction(action: CheckoutHttpAction, actorId: string, start?: () => Promise<CheckoutRequest>, scope?: CheckoutEndpointScope) {
  const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY)
  const coordinator = checkoutCoordinator(prisma, checkoutProviderAdapter(checkoutStripeProvider(stripe, mode)))
  const identity = checkoutIdentity(actorId, action.operationId)
  if (action.action !== 'start' && action.action !== 'start_after_terminal') {
    if (!scope) return invalid()
    const bound = await readCheckoutBoundOperation(prisma, identity)
    if (bound.plan && bound.plan.mode !== mode) throw new LifecycleError('CHECKOUT_STRIPE_MODE_MISMATCH')
    if (bound.plan && bound.plan.source !== scope.source) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
    await scope.authorizePlan(bound.plan)
  }
  if (action.action === 'status') return coordinator.statusByHandle(identity)
  if (action.action === 'resume') return coordinator.resumeByHandle(identity)
  if (action.action === 'ready') return coordinator.readyByHandle(identity)
  if (action.action === 'abort') return coordinator.abortByHandle(identity)
  if (!start) return invalid()
  const request = await start()
  if (request.identity.operationId !== action.operationId || request.identity.targetUserId !== actorId || request.mode !== mode) return invalid()
  if (action.action === 'start_after_terminal') {
    if (!action.previousOperationId) return invalid()
    return coordinator.advanceAfterTerminalByHandle(checkoutIdentity(actorId, action.previousOperationId), request)
  }
  return coordinator.create(request)
}
