import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { stripe, isDoyaSubscriptionOwnedByUser } from '@/lib/stripe'
import { privateApiJson } from '@/lib/private-api-response'
import { LifecycleError, validLifecycleUser, validLifecycleUuid } from '@/lib/account-lifecycle/state'
import { adminSubscriptionCoordinator, type AdminSubscriptionAction } from '@/lib/account-lifecycle/admin-subscription'
import { liveAdminSubscriptionStripeProvider } from '@/lib/account-lifecycle/admin-subscription-stripe-provider'
import { stripeModeFromSecret } from '@/lib/account-lifecycle/checkout-stripe-provider'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const invalid = (): never => { throw new LifecycleError('INVALID_ADMIN_SUBSCRIPTION_ACTION', 400) }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const sameKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',')

export function parseAdminSubscriptionHttpAction(value: unknown): AdminSubscriptionAction {
  if (!object(value) || !validLifecycleUuid(value.operationId) || !validLifecycleUser(value.expectedAdminId) ||
      !validLifecycleUser(value.targetUserId) ||
      !['period_end_cancel', 'immediate_cancel', 'resume'].includes(String(value.intent)) ||
      !['start', 'status', 'continue', 'reconcile', 'abort'].includes(String(value.action)) ||
      !sameKeys(value, ['action', 'operationId', 'expectedAdminId', 'targetUserId', 'intent'])) return invalid()
  return value as AdminSubscriptionAction
}

async function principal() {
  const token = (await cookies()).get(COOKIE_NAME)?.value || null
  const session = await verifyAdminSession(token)
  if (!token || !session.valid || !session.adminUser) throw new LifecycleError('ADMIN_AUTH_REQUIRED', 401)
  return { adminId: session.adminUser.id, sessionToken: token }
}

// Existing read-only account information is not an operation completion signal.
export async function GET(request: NextRequest) {
  try {
    const ctx = await principal()
    const userId = new URL(request.url).searchParams.get('userId')
    if (!validLifecycleUser(userId)) return privateApiJson({ code: 'INVALID_TARGET_USER' }, { status: 400 })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: {
      id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, plan: true,
    } })
    if (!user) return privateApiJson({ code: 'USER_UNAVAILABLE' }, { status: 404 })
    let subscription = null
    if (user.stripeSubscriptionId) {
      const raw = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      if (raw.id !== user.stripeSubscriptionId || !await isDoyaSubscriptionOwnedByUser(raw, user))
        return privateApiJson({ code: 'SUBSCRIPTION_OWNERSHIP_UNAVAILABLE' }, { status: 409 })
      subscription = { id: raw.id, status: raw.status,
        currentPeriodEnd: new Date(raw.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: raw.cancel_at_period_end, priceId: raw.items.data[0]?.price?.id,
        amount: raw.items.data[0]?.price?.unit_amount, interval: raw.items.data[0]?.price?.recurring?.interval }
    }
    return privateApiJson({ actorId: ctx.adminId, user, subscription })
  } catch (error) {
    const code = error instanceof LifecycleError ? error.code : 'ADMIN_STRIPE_READ_UNAVAILABLE'
    const status = error instanceof LifecycleError ? error.status : 503
    return privateApiJson({ code }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await principal()
    let body: unknown
    try { body = await request.json() } catch { return privateApiJson({ code: 'INVALID_ADMIN_SUBSCRIPTION_ACTION' }, { status: 400 }) }
    const action = parseAdminSubscriptionHttpAction(body)
    if (action.expectedAdminId !== ctx.adminId) throw new LifecycleError('ADMIN_SUBSCRIPTION_ACTOR_MISMATCH', 403)
    const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY)
    return privateApiJson(await adminSubscriptionCoordinator(prisma, liveAdminSubscriptionStripeProvider(mode), mode).handle(ctx, action))
  } catch (error) {
    const code = error instanceof LifecycleError ? error.code : 'ADMIN_SUBSCRIPTION_UNAVAILABLE'
    const status = error instanceof LifecycleError ? error.status : 503
    return privateApiJson({ code, phase: 'unknown' }, { status })
  }
}
