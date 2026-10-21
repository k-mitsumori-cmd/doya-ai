export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { STRIPE_PRICE_IDS, findActiveLikeSubscriptions } from '@/lib/stripe'
import { UNIFIED_TRIAL_DAYS } from '@/lib/unified-plan'
import { getActiveServices } from '@/lib/services'
import { isTrialEligible } from '@/lib/trial'
import { prisma } from '@/lib/prisma'
import { parseHrOrganizationSelection } from '@/lib/hr/organization-selection'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { checkoutUrls } from '@/lib/account-lifecycle/checkout-urls'
import { currentCheckoutEpoch, checkoutHttpResult, checkoutIdentity, parseCheckoutHttpAction, resolveCheckoutActor, runCheckoutHttpAction } from '@/lib/account-lifecycle/checkout-http'
import { stripeModeFromSecret } from '@/lib/account-lifecycle/checkout-stripe-provider'
import type { CheckoutRecoveryBinding, CheckoutRequest } from '@/lib/account-lifecycle/checkout-receipt'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })
const fail = (code: string, status: number, error: string) => reply({ code, error }, status)
const publicError = 'アカウント操作の状態を確認できません。操作を繰り返さず、保存状況をご確認ください。'

function safeReturnPath(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > 500 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) throw new LifecycleError('INVALID_CHECKOUT_RETURN', 400)
  const path = raw.split('?')[0]!.split('#')[0]!
  if (!path || path.startsWith('//')) throw new LifecycleError('INVALID_CHECKOUT_RETURN', 400)
  return path
}
function appOrigin(): string {
  const raw = String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').trim().replace(/\/+$/, '')
  try { const url = new URL(raw); if (url.protocol === 'https:' && url.origin === raw && !url.username && !url.password) return raw } catch { /* fail closed */ }
  throw new LifecycleError('CHECKOUT_ORIGIN_UNAVAILABLE', 503)
}

/** B2a accepts explicit UUID actions. B2b will connect all existing callers to this contract. */
export async function POST(request: NextRequest) {
  try {
    const raw: unknown = await request.json()
    const action = parseCheckoutHttpAction(raw, ['planId', 'billingPeriod', 'serviceId', 'returnTo'])
    const body = raw as Record<string, unknown>
    const actor = await resolveCheckoutActor(await getServerSession(authOptions), action.expectedActorId)
    const actorEmail = actor.email
    if (!actorEmail) throw new LifecycleError('CHECKOUT_ACTOR_UNAVAILABLE', 404)
    if (action.action !== 'start' && action.action !== 'start_after_terminal') {
      const result = await runCheckoutHttpAction(action, actor.id, undefined, {
        source: 'generic',
        authorizePlan: async plan => {
          if (!plan || plan.organizationId === null) return
          const selection = parseHrOrganizationSelection(request.headers, actor.id)
          if (selection.kind !== 'selected' || selection.organizationId !== plan.organizationId) throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
          const member = await prisma.hrOrganizationMember.findFirst({ where: { userId: actor.id, organizationId: plan.organizationId, status: 'ACTIVE' }, select: { role: true } })
          if (member?.role !== 'OWNER') throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
        },
      })
      return reply(checkoutHttpResult(result, actor.id))
    }
    const result = await runCheckoutHttpAction(action, actor.id, async (): Promise<CheckoutRequest> => {
      if (typeof body.planId !== 'string' || typeof body.billingPeriod !== 'string' || !['monthly', 'yearly'].includes(body.billingPeriod) || !(body.serviceId === null || typeof body.serviceId === 'string') || !(body.returnTo === null || typeof body.returnTo === 'string')) throw new LifecycleError('INVALID_CHECKOUT_ACTION', 400)
      const planId = body.planId, billingPeriod = body.billingPeriod as 'monthly' | 'yearly'
      const requestedReturnTo = safeReturnPath(body.returnTo)
      const requestedServiceId = String(body.serviceId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40)
      const isHr = requestedServiceId === 'hr' || planId.startsWith('hr-') || requestedReturnTo === '/hr' || requestedReturnTo?.startsWith('/hr/')
      let organizationId: string | null = null
      if (isHr) {
        const selection = parseHrOrganizationSelection(request.headers, actor.id)
        if (selection.kind !== 'selected') throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
        const member = await prisma.hrOrganizationMember.findFirst({ where: { userId: actor.id, organizationId: selection.organizationId, status: 'ACTIVE' }, select: { role: true } })
        if (member?.role !== 'OWNER') throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
        organizationId = selection.organizationId
      }
      const retired = ['copy', 'lp', 'voice', 'movie', 'adsim', 'tenkai', 'interviewx']
      if (retired.includes(planId.split('-')[0])) throw new LifecycleError('CHECKOUT_PLAN_RETIRED', 410)
      const priceId = getPriceId(planId, billingPeriod)
      if (!priceId) throw new LifecycleError('INVALID_CHECKOUT_PLAN', 400)
      const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY)
      const cutoverEpoch = await currentCheckoutEpoch(mode)
      let existing
      try { existing = await findActiveLikeSubscriptions({ userId: actor.id, email: actorEmail, stripeCustomerId: actor.stripeCustomerId }) }
      catch { throw new LifecycleError('SUBSCRIPTION_CHECK_UNAVAILABLE', 503) }
      if (existing.length) throw new LifecycleError(existing.length === 1 && existing[0]?.priceId && existing[0].priceId !== priceId ? 'PLAN_CHANGE_REQUIRED' : 'ALREADY_SUBSCRIBED')
      const service = requestedServiceId || planId.split('-')[0]
      const globalPricing = requestedReturnTo === '/' || requestedReturnTo === '/pricing' || requestedReturnTo === '/all-in-one' || service === 'bundle'
      const active = getActiveServices().find(item => item.id === service)
      if (!globalPricing && !active) throw new LifecycleError('CHECKOUT_PLAN_RETIRED', 410)
      const workingPath = globalPricing ? '/home' : service === 'interview' ? '/interview/projects' : active!.dashboardHref
      const recovery: CheckoutRecoveryBinding = { version: 2, recipe: 'generic_working', origin: appOrigin(), returnPath: requestedReturnTo, workingPath }
      const urls = checkoutUrls(recovery, planId, service)
      const trialable = billingPeriod === 'monthly' && !planId.includes('enterprise') && planId !== 'bundle'
      let trialDays = 0
      if (trialable) {
        try { if (await isTrialEligible({ email: actorEmail, stripeCustomerId: actor.stripeCustomerId })) trialDays = UNIFIED_TRIAL_DAYS }
        catch { throw new LifecycleError('TRIAL_CHECK_UNAVAILABLE', 503) }
      }
      return { cutoverEpoch, identity: checkoutIdentity(actor.id, action.operationId), mode, source: 'generic', organizationId,
        customerMode: 'implicit', customerId: null, recovery,
        terms: { priceId, planId, serviceId: service, trialDays, successUrl: urls.successUrl, cancelUrl: urls.cancelUrl,
          email: actorEmail.trim().toLowerCase(), name: actor.name || '', expiresAt: Math.floor(Date.now() / 1000) + 40 * 60 } }
    })
    return reply(checkoutHttpResult(result, actor.id))
  } catch (error) {
    if (error instanceof LifecycleError) return fail(error.code, error.status, publicError)
    return fail('CHECKOUT_UNAVAILABLE', 503, '決済状態を確認できませんでした。操作を繰り返さず、時間をおいてご確認ください。')
  }
}

// プランIDからStripe価格IDを取得
function getPriceId(planId: string, billingPeriod: 'monthly' | 'yearly'): string | null {
  const priceMap: Record<string, { monthly: string; yearly: string }> = {
    // --- ライトプラン（全サービス共通 ¥2,980/月） ---
    'seo-light': STRIPE_PRICE_IDS.seo.light,
    'banner-light': STRIPE_PRICE_IDS.banner.light,
    'interview-light': STRIPE_PRICE_IDS.interview.light,
    'copy-light': STRIPE_PRICE_IDS.copy.light,
    'lp-light': STRIPE_PRICE_IDS.lp.light,
    'voice-light': STRIPE_PRICE_IDS.voice.light,
    'movie-light': STRIPE_PRICE_IDS.movie.light,
    'adsim-light': STRIPE_PRICE_IDS.adsim.light,
    // --- プロプラン ---
    // ドヤSEO
    'seo-pro': STRIPE_PRICE_IDS.seo.pro,
    'seo-enterprise': STRIPE_PRICE_IDS.seo.enterprise,
    // ドヤバナーAI
    'banner-basic': STRIPE_PRICE_IDS.banner.basic,
    'banner-pro': STRIPE_PRICE_IDS.banner.pro,
    'banner-enterprise': STRIPE_PRICE_IDS.banner.enterprise,
    // ドヤインタビューAI（統一課金）
    'interview-pro': STRIPE_PRICE_IDS.interview.pro,
    'interview-enterprise': STRIPE_PRICE_IDS.interview.enterprise,
    // ドヤコピーAI（統一課金）
    'copy-pro': STRIPE_PRICE_IDS.copy.pro,
    'copy-enterprise': STRIPE_PRICE_IDS.copy.enterprise,
    // ドヤLP AI（統一課金）
    'lp-pro': STRIPE_PRICE_IDS.lp.pro,
    'lp-enterprise': STRIPE_PRICE_IDS.lp.enterprise,
    // ドヤボイスAI（統一課金）
    'voice-pro': STRIPE_PRICE_IDS.voice.pro,
    'voice-enterprise': STRIPE_PRICE_IDS.voice.enterprise,
    // ドヤムービーAI（統一課金）
    'movie-pro': STRIPE_PRICE_IDS.movie.pro,
    'movie-enterprise': STRIPE_PRICE_IDS.movie.enterprise,
    // ドヤ広告シミュレーションAI（統一課金）
    'adsim-pro': STRIPE_PRICE_IDS.adsim.pro,
    'adsim-enterprise': STRIPE_PRICE_IDS.adsim.enterprise,
    // セットプラン
    'bundle': STRIPE_PRICE_IDS.bundle,
  }

  const prices = priceMap[planId]
  if (!prices) return null

  return prices[billingPeriod]
}
