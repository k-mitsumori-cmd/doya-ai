const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ foreign = false, remaining = false, remainingPlan = 'banner-pro', survivorCustomer = 'cus_owner', syncFailure = false, signed = true, cancelStatus = 'canceled' } = {}) {
  const mutations = []
  const syncs = []
  let reads = 0
  const user = { id: 'u1', email: 'owner@example.test', stripeSubscriptionId: 'sub_saved', stripeCustomerId: 'cus_owner', plan: 'PRO' }
  const subscription = (id) => ({ id, customer: id === 'sub_other' ? survivorCustomer : 'cus_owner', status: 'active', cancel_at_period_end: false,
    current_period_end: 1900000000, metadata: { userId: id === 'sub_saved' && foreign ? 'other' : 'u1', planId: 'banner-pro' },
    items: { data: [{ price: { id: 'price_banner_pro_monthly', unit_amount: 9980, recurring: { interval: 'month' } } }] } })
  const stripe = { subscriptions: {
    retrieve: async (id) => { reads++; return subscription(id) },
    update: async (id, data) => { mutations.push({ id, data }); return { ...subscription(id), ...data } },
    cancel: async (id) => { mutations.push({ id, cancel: true }); return { ...subscription(id), status: cancelStatus } },
  } }
  const api = load('src/app/api/admin/stripe/route.ts', {
    'next/server': { NextResponse: Response },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'admin-session' }) }) },
    '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid: signed }) },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => user, update: async () => { throw Error('non-atomic user update') } },
      userServiceSubscription: { update: async () => { throw Error('non-atomic service update') } } } },
    '@/lib/stripe': { stripe, ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']),
      isDoyaSubscriptionOwnedByUser: async (sub, owner) => sub.metadata.userId === owner.id,
      findActiveLikeSubscriptions: async () => remaining ? [{ id: 'sub_other', planId: remainingPlan, customerId: 'cus_owner' }] : [],
      planTierFromPlanId: (id) => id === 'invalid' ? 'FREE' : 'PRO', resolvePlanIdFromSubscription: () => ({ planId: remainingPlan, priceId: 'price_banner_pro_monthly' }) },
    '@/lib/billing-sync': { syncUnifiedBilling: async (input) => { syncs.push(input); if (syncFailure) throw Error('sync failed') } },
  })
  const request = (action) => new Request('https://offline.invalid/api/admin/stripe', { method: 'POST', body: JSON.stringify({ userId: 'u1', action }) })
  return { api, request, mutations, syncs, get reads() { return reads } }
}

;(async () => {
  await check('admin Stripe rejects unauthenticated request before Stripe read', async () => {
    const f = fixture({ signed: false }); assert.equal((await f.api.POST(f.request('cancel'))).status, 401); assert.equal(f.reads, 0)
  })
  await check('admin Stripe GET refuses foreign saved contract', async () => {
    const f = fixture({ foreign: true }); assert.equal((await f.api.GET(new Request('https://offline.invalid/api/admin/stripe?userId=u1'))).status, 409)
  })
  for (const action of ['cancel', 'cancel_immediately', 'resume']) {
    await check('admin Stripe '+action+' refuses foreign saved contract before mutation', async () => {
      const f = fixture({ foreign: true }); assert.equal((await f.api.POST(f.request(action))).status, 409)
      assert.equal(f.mutations.length, 0); assert.equal(f.syncs.length, 0)
    })
  }
  await check('admin Stripe period-end cancellation changes only verified contract', async () => {
    const f = fixture(); assert.equal((await f.api.POST(f.request('cancel'))).status, 200)
    assert.equal(JSON.stringify(f.mutations), JSON.stringify([{ id: 'sub_saved', data: { cancel_at_period_end: true } }])); assert.equal(f.syncs.length, 0)
  })
  await check('admin Stripe immediate cancellation syncs all services atomically to FREE', async () => {
    const f = fixture(); assert.equal((await f.api.POST(f.request('cancel_immediately'))).status, 200)
    assert.equal(JSON.stringify(f.mutations), JSON.stringify([{ id: 'sub_saved', cancel: true }])); assert.equal(f.syncs.length, 1)
    assert.equal(f.syncs[0].plan, 'FREE'); assert.equal(f.syncs[0].stripeSubscriptionId, null)
  })
  await check('admin Stripe immediate cancellation retains another paid contract', async () => {
    const f = fixture({ remaining: true }); assert.equal((await f.api.POST(f.request('cancel_immediately'))).status, 200)
    assert.equal(f.syncs[0].plan, 'PRO'); assert.equal(f.syncs[0].stripeSubscriptionId, 'sub_other')
  })
  for (const options of [{ remainingPlan: 'invalid' }, { survivorCustomer: 'cus_other' }]) {
    await check('admin Stripe refuses uncertain remaining contract before downgrading', async () => {
      const f = fixture({ remaining: true, ...options }); const response = await f.api.POST(f.request('cancel_immediately'))
      assert.equal(response.status, 502); assert.equal((await response.json()).code, 'BILLING_SYNC_INCOMPLETE')
      assert.equal(f.syncs.length, 0)
    })
  }
  await check('admin Stripe does not downgrade when immediate cancellation is unconfirmed', async () => {
    const f = fixture({ cancelStatus: 'active' }); const response = await f.api.POST(f.request('cancel_immediately'))
    assert.equal(response.status, 502); assert.equal((await response.json()).code, 'CANCELLATION_UNCONFIRMED')
    assert.equal(f.syncs.length, 0)
  })
  await check('admin Stripe reports DB sync failure after immediate cancellation', async () => {
    const f = fixture({ syncFailure: true }); const response = await f.api.POST(f.request('cancel_immediately'))
    assert.equal(response.status, 502); assert.equal((await response.json()).code, 'BILLING_SYNC_INCOMPLETE')
    assert.equal(f.mutations.length, 1); assert.equal(f.syncs.length, 1)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
