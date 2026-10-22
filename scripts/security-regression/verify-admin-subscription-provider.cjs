// Actual admin adapter with an injected synthetic SDK; no external Stripe calls.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/admin-subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/admin-subscription-fact.ts', { './state': state, './admin-subscription-plan': plans })
const adapter = load('src/lib/account-lifecycle/admin-subscription-stripe-provider.ts', {
  'server-only': {}, './state': state, './admin-subscription-fact': facts,
  '@/lib/stripe': { stripe: {}, findActiveLikeSubscriptions: async () => [],
    isDoyaSubscriptionOwnedByUser: async () => true, ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']),
    planTierFromPlanId: id => id === 'banner-pro' ? 'PRO' : 'FREE',
    resolvePlanIdFromSubscription: raw => ({ planId: raw.metadata.planId, priceId: raw.items.data[0].price.id }) },
})
const id = crypto.randomUUID(), user = { id: 'user1', email: 'user@example.invalid', stripeCustomerId: 'cus_one',
  stripeSubscriptionId: 'sub_one', stripePriceId: 'price_one' }
const target = { id: 'sub_one', customerId: 'cus_one', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const base = { identity: { operator: { kind: 'admin', id: 'admin1' }, targetUserId: user.id, operationId: id, kind: 'cancel' },
  mode: 'test', email: user.email, expectedCustomerId: user.stripeCustomerId,
  expectedSubscriptionId: user.stripeSubscriptionId, expectedPriceId: user.stripePriceId, target }
const raw = { id: target.id, customer: target.customerId, livemode: false, status: target.status,
  cancel_at_period_end: false, current_period_end: target.currentPeriodEnd }
;(async () => {
  let reads = 0, writes = 0, before = 0
  const sdk = { subscriptions: {
    retrieve: async id => { reads++; return { ...raw, id } },
    update: async (id, params, opts) => { writes++; assert.equal(id, raw.id); assert.match(opts.idempotencyKey, /doya-admin-subscription-v1/); return { ...raw, cancel_at_period_end: params.cancel_at_period_end } },
    cancel: async () => { writes++; return { ...raw, status: 'canceled' } },
  } }
  const p = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => [], async () => true)
  await check('exact saved target is discovered without broad cancellation', async () => {
    assert.equal(JSON.stringify(await p.discover(user)), JSON.stringify(target)); assert.equal(reads, 1)
  })
  await check('scheduled write has final DB callback and exact fact', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'period_end_cancel' })
    const fact = await p.mutate(plan, user, async () => { before++ })
    assert.equal(fact.outcome.status, 'scheduled_cancel'); assert.equal(writes, 1); assert.equal(before, 1)
  })
  await check('already desired resume is read only', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'resume',
      identity: { ...base.identity, kind: 'resume' } })
    const fact = await p.mutate(plan, user, async () => { before++ })
    assert.equal(fact.proof, 'already_desired'); assert.equal(writes, 1); assert.equal(before, 1)
  })
  await check('provider drift stops before a second write', async () => {
    const old = sdk.subscriptions.retrieve
    sdk.subscriptions.retrieve = async () => ({ ...raw, customer: 'cus_foreign' })
    try { await assert.rejects(p.mutate(plans.makeAdminSubscriptionPlan({ ...base, intent: 'period_end_cancel' }), user, async () => { before++ })) }
    finally { sdk.subscriptions.retrieve = old }
    assert.equal(writes, 1); assert.equal(before, 1)
  })
  await check('reconcile requires the frozen customer before constructing a terminal fact', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
    const old = sdk.subscriptions.retrieve
    sdk.subscriptions.retrieve = async () => ({ ...raw, customer: 'cus_foreign', status: 'canceled' })
    try { await assert.rejects(p.reconcileImmediate(plan, user), { code: 'ADMIN_SUBSCRIPTION_PROVIDER_UNKNOWN' }) }
    finally { sdk.subscriptions.retrieve = async () => ({ ...raw, status: 'canceled' }) }
    try {
      const recovered = await p.reconcileImmediate(plan, user)
      assert.equal(recovered.customerId, plan.target.customerId)
      assert.equal(recovered.proof, 'irreversible_terminal')
      assert.equal(writes, 1)
    } finally { sdk.subscriptions.retrieve = old }
  })
  await check('post-cancel survivors choose verified highest known tier', async () => {
    const survivor = { ...raw, id: 'sub_survivor', customer: 'cus_other', metadata: { planId: 'banner-pro' },
      items: { data: [{ price: { id: 'price_survivor' } }] } }
    const old = sdk.subscriptions.retrieve
    sdk.subscriptions.retrieve = async id => id === survivor.id ? survivor : old(id)
    const withSurvivor = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => [{ id: survivor.id,
      customerId: 'cus_other', planId: 'banner-pro', priceId: 'price_survivor', status: 'active' }], async () => true)
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
    const projection = await withSurvivor.settlement(plan, user)
    assert.equal(projection.plan, 'PRO'); assert.equal(projection.stripeSubscriptionId, survivor.id)
    assert.equal(writes, 1)
    sdk.subscriptions.retrieve = old
  })
  await check('no surviving live contract projects FREE with no new provider write', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
    const none = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => [], async () => true)
    const result = await none.settlement(plan, user)
    assert.equal(result.plan, 'FREE'); assert.equal(result.stripeSubscriptionId, null)
    assert.equal(result.stripePriceId, null); assert.equal(writes, 1)
  })
  await check('multiple owned survivors across customers select one exact highest tier', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
    const one = { ...raw, id: 'sub_light', customer: 'cus_one', metadata: { planId: 'banner-pro' },
      items: { data: [{ price: { id: 'price_light' } }] } }
    const two = { ...raw, id: 'sub_high', customer: 'cus_two', metadata: { planId: 'banner-pro' },
      items: { data: [{ price: { id: 'price_high' } }] } }
    const old = sdk.subscriptions.retrieve
    sdk.subscriptions.retrieve = async id => id === one.id ? one : id === two.id ? two : old(id)
    try {
      const multiple = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => [
        { id: one.id, customerId: 'cus_one', planId: 'banner-pro', priceId: 'price_light', status: 'active' },
        { id: two.id, customerId: 'cus_two', planId: 'banner-pro', priceId: 'price_high', status: 'active' },
      ], async () => true)
      const result = await multiple.settlement(plan, user)
      assert.equal(result.plan, 'PRO'); assert.equal(result.stripeSubscriptionId, two.id)
      assert.equal(result.stripeCustomerId, 'cus_two'); assert.equal(result.stripePriceId, 'price_high')
      assert.equal(writes, 1)
    } finally { sdk.subscriptions.retrieve = old }
  })
  await check('unknown survivor plan and discovery failure never become FREE', async () => {
    const plan = plans.makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
    const unknown = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => [
      { id: 'sub_unknown', customerId: 'cus_one', planId: 'unmapped', priceId: 'price_unknown', status: 'active' },
    ], async () => true)
    const failed = adapter.adminSubscriptionStripeProvider(sdk, 'test', async () => { throw Error('synthetic discovery unavailable') }, async () => true)
    await assert.rejects(unknown.settlement(plan, user), { code: 'ADMIN_SUBSCRIPTION_PROVIDER_UNKNOWN' })
    await assert.rejects(failed.settlement(plan, user), /synthetic discovery unavailable/)
    assert.equal(writes, 1)
  })
  console.log(JSON.stringify({ passed: results.length, reads, writes, scope: 'actual admin provider with synthetic SDK only' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
