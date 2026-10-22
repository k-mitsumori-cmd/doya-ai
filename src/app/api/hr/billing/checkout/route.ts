export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { STRIPE_PRICE_IDS, findActiveLikeSubscriptions } from '@/lib/stripe'
import { getHrContext } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { checkoutUrls } from '@/lib/account-lifecycle/checkout-urls'
import { currentCheckoutEpoch, checkoutHttpResult, checkoutIdentity, parseCheckoutHttpAction, resolveCheckoutActor, runCheckoutHttpAction } from '@/lib/account-lifecycle/checkout-http'
import { stripeModeFromSecret } from '@/lib/account-lifecycle/checkout-stripe-provider'
import type { CheckoutRecoveryBinding, CheckoutRequest } from '@/lib/account-lifecycle/checkout-receipt'

const HR_PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: STRIPE_PRICE_IDS.hr.starter,
  pro: STRIPE_PRICE_IDS.hr.pro,
  enterprise: STRIPE_PRICE_IDS.hr.enterprise,
}
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })
const publicError = 'アカウント操作の状態を確認できません。操作を繰り返さず、保存状況をご確認ください。'

function appOrigin(): string {
  const raw = String(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  try { const url = new URL(raw); if (url.protocol === 'https:' && url.origin === raw && !url.username && !url.password) return raw } catch { /* fail closed */ }
  throw new LifecycleError('CHECKOUT_ORIGIN_UNAVAILABLE', 503)
}

/** Dedicated HR pricing remains distinct from generic HR source and trial policy. */
export async function POST(request: NextRequest) {
  try {
    const raw: unknown = await request.json()
    const action = parseCheckoutHttpAction(raw, ['plan', 'interval'])
    const body = raw as Record<string, unknown>
    const actor = await resolveCheckoutActor(await getServerSession(authOptions), action.expectedActorId)
    if (action.action !== 'start' && action.action !== 'start_after_terminal') {
      const result = await runCheckoutHttpAction(action, actor.id, undefined, {
        source: 'hr',
        authorizePlan: async plan => {
          const ctx = await getHrContext()
          if (!ctx || ctx.userId !== actor.id || ctx.role !== HrMemberRole.OWNER || plan && plan.organizationId !== ctx.organizationId) throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
        },
      })
      return reply(checkoutHttpResult(result, actor.id))
    }
    const auditScope: { value: { organizationId: string; plan: string; interval: 'monthly' | 'yearly'; priceId: string } | null } = { value: null }
    const result = await runCheckoutHttpAction(action, actor.id, async (): Promise<CheckoutRequest> => {
      if (typeof body.plan !== 'string' || typeof body.interval !== 'string' || !['monthly', 'yearly'].includes(body.interval)) throw new LifecycleError('INVALID_CHECKOUT_ACTION', 400)
      const plan = body.plan, interval = body.interval as 'monthly' | 'yearly'
      if (!Object.prototype.hasOwnProperty.call(HR_PLAN_PRICES, plan)) throw new LifecycleError('INVALID_CHECKOUT_PLAN', 400)
      const priceId = HR_PLAN_PRICES[plan][interval]
      if (!priceId) throw new LifecycleError('INVALID_CHECKOUT_PLAN', 400)
      const ctx = await getHrContext()
      if (!ctx || ctx.userId !== actor.id || ctx.role !== HrMemberRole.OWNER) throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
      auditScope.value = { organizationId: ctx.organizationId, plan, interval, priceId }
      const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY)
      const cutoverEpoch = await currentCheckoutEpoch(mode)
      if (!actor.email) throw new LifecycleError('CHECKOUT_ACTOR_UNAVAILABLE', 404)
      let existing
      try { existing = await findActiveLikeSubscriptions({ userId: actor.id, email: actor.email, stripeCustomerId: actor.stripeCustomerId }) }
      catch { throw new LifecycleError('SUBSCRIPTION_CHECK_UNAVAILABLE', 503) }
      if (existing.length) throw new LifecycleError(existing.length === 1 && existing[0]?.priceId && existing[0].priceId !== priceId ? 'PLAN_CHANGE_REQUIRED' : 'ALREADY_SUBSCRIBED')
      const recovery: CheckoutRecoveryBinding = { version: 1, recipe: 'hr', origin: appOrigin(), returnPath: null }
      const planId = `hr-${plan}`
      const urls = checkoutUrls(recovery, planId, 'hr')
      return { cutoverEpoch, identity: checkoutIdentity(actor.id, action.operationId), mode, source: 'hr', organizationId: ctx.organizationId,
        customerMode: actor.stripeCustomerId ? 'reuse' : 'create', customerId: actor.stripeCustomerId,
        recovery, terms: { priceId, planId, serviceId: 'hr', trialDays: 0, successUrl: urls.successUrl, cancelUrl: urls.cancelUrl,
          email: actor.email.trim().toLowerCase(), name: actor.name || '', expiresAt: Math.floor(Date.now() / 1000) + 40 * 60 } }
    })
    if (result && typeof result === 'object' && 'id' in result) {
      if (auditScope.value) {
        logAudit({ organizationId: auditScope.value.organizationId, userId: actor.id, userName: actor.name,
          action: 'BILLING_CHECKOUT', target: 'billing', details: { ...auditScope.value, operationId: result.operationId, checkoutSessionId: result.id } }).catch(() => {})
      }
      return reply({ success: true, ...checkoutHttpResult(result, actor.id) })
    }
    return reply(checkoutHttpResult(result, actor.id))
  } catch (error) {
    if (error instanceof LifecycleError) return reply({ code: error.code, error: publicError }, error.status)
    return reply({ code: 'CHECKOUT_UNAVAILABLE', error: '決済状態を確認できませんでした。操作を繰り返さず、時間をおいてご確認ください。' }, 503)
  }
}
