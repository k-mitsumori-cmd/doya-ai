const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const env = {
  STRIPE_PRICE_BANNER_LIGHT_MONTHLY: 'price_light',
  STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_pro',
  STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY: 'price_enterprise',
}
const productByPrice = {
  price_light: 'prod_light',
  price_pro: 'prod_pro',
  price_enterprise: 'prod_enterprise',
}
const configurations = []
let createdInput
let created = 0
let opened = 0
let checkoutCreated = 0
let requestedPlanChange = false
let portalReturnUrl = ''
const stripe = {
  prices: { retrieve: async id => ({ id, active: true, recurring: { interval: 'month' }, product: productByPrice[id] }) },
  billingPortal: {
    configurations: {
      list: async () => ({ data: configurations, has_more: false }),
      retrieve: async id => configurations.find(c => c.id === id),
      create: async (input, options) => {
        created++
        createdInput = input
        assert.match(options.idempotencyKey, /^doya-portal-v2-trial:/)
        const config = { id: 'bpc_test', active: true, ...input,
          features: { ...input.features, subscription_update: { enabled: true, default_allowed_updates: ['price'], trial_update_behavior: input.features.subscription_update.trial_update_behavior } } }
        configurations.push(config)
        return config
      },
    },
    sessions: { create: async input => { opened++; return { url: 'https://offline.invalid/portal', ...input } } },
  },
}
const stripeModule = load('src/lib/stripe.ts', {
  stripe: function () { return stripe },
  'node:crypto': require('node:crypto'),
}, { process: { env } })
const response = (data, init = {}) => Response.json(data, init)
const checkout = load('src/app/api/stripe/checkout/route.ts', {
  'next/server': { NextResponse: { json: response } },
  'next-auth': { getServerSession: async () => ({ user: { email: 'owner@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'owner', stripeCustomerId: 'cus_owner' }) } } },
  '@/lib/stripe': {
    STRIPE_PRICE_IDS: stripeModule.STRIPE_PRICE_IDS,
    findActiveLikeSubscriptions: async () => [{ id: 'sub_light', status: 'active', priceId: 'price_light' }],
    createCheckoutSession: async () => { checkoutCreated++; throw Error('second subscription') },
  },
  '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 30 },
  '@/lib/trial': { isTrialEligible: async () => true },
  '@/lib/checkout-reservation': { CheckoutReservationError: class extends Error {}, createReservedCheckoutSession: async () => { throw Error('unexpected reservation') } },
})
const portal = load('src/app/api/stripe/portal/route.ts', {
  'next/server': { NextResponse: { json: response } },
  'next-auth': { getServerSession: async () => ({ user: { email: 'owner@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'owner', stripeCustomerId: 'cus_owner' }) } } },
  '@/lib/stripe': {
    resolveBillingCustomerId: async () => 'cus_owner',
    createCustomerPortalSession: async input => {
      requestedPlanChange = input.requirePlanChange
      portalReturnUrl = input.returnUrl
      return { url: 'https://offline.invalid/portal' }
    },
  },
})

;(async () => {
  const live = { metadata: { userId: 'owner', planId: 'banner-light' }, items: { data: [{ price: { id: 'price_pro' } }] } }
  assert.equal(stripeModule.resolvePlanIdFromSubscription(live).planId, 'seo-pro', 'current Stripe price overrides stale metadata')
  const legacy = { ...live, items: { data: [{ price: { id: 'price_legacy' } }] } }
  assert.equal(stripeModule.resolvePlanIdFromSubscription(legacy).planId, 'banner-light', 'unknown legacy price still uses metadata')

  const upgrade = await checkout.POST(new Request('https://offline.invalid/api/stripe/checkout', {
    method: 'POST', body: JSON.stringify({ planId: 'banner-pro' }),
  }))
  assert.equal(upgrade.status, 409)
  assert.equal((await upgrade.json()).code, 'PLAN_CHANGE_REQUIRED')
  assert.equal(checkoutCreated, 0)
  const link = await portal.POST(new Request('https://offline.invalid/api/stripe/portal', {
    method: 'POST', body: JSON.stringify({ purpose: 'plan_change', returnTo: '/banner/pricing' }),
  }))
  assert.equal(link.status, 200)
  assert.equal(requestedPlanChange, true)
  assert.equal(new URL(portalReturnUrl).searchParams.get('portal_return'), 'plan_change')
  assert.equal(new URL(portalReturnUrl).pathname, '/banner/pricing')
  assert.equal((await link.json()).url, 'https://offline.invalid/portal')

  const first = await stripeModule.createCustomerPortalSession({ customerId: 'cus_owner', returnUrl: 'https://offline.invalid/', requirePlanChange: true })
  assert.equal(first.configuration, 'bpc_test')
  assert.equal(configurations[0].features.subscription_update.enabled, true)
  assert.equal(configurations[0].features.subscription_update.trial_update_behavior, 'continue_trial')
  assert.equal(createdInput.features.subscription_cancel.cancellation_reason.options.length, 5)
  assert.deepEqual(JSON.parse(JSON.stringify(createdInput.features.subscription_update.products)), [
    { product: 'prod_enterprise', prices: ['price_enterprise'] },
    { product: 'prod_light', prices: ['price_light'] },
    { product: 'prod_pro', prices: ['price_pro'] },
  ])
  await stripeModule.createCustomerPortalSession({ customerId: 'cus_owner', returnUrl: 'https://offline.invalid/', requirePlanChange: true })
  assert.equal(created, 1, 'matching configuration is reused')
  assert.equal(opened, 2)

  configurations[0].features.subscription_update.enabled = false
  await stripeModule.createCustomerPortalSession({ customerId: 'cus_owner', returnUrl: 'https://offline.invalid/', requirePlanChange: true })
  assert.equal(created, 2, 'disabled configuration is not reused for plan changes')
  console.log('PASS plan change: no duplicate checkout, grouped portal prices, reusable configuration, current price sync')
})().catch(error => { console.error(error); process.exitCode = 1 })
