const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
const planModule = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': require('node:crypto'), './state': state })
const facts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const adapter = load('src/lib/account-lifecycle/subscription-stripe-provider.ts', {
  'server-only': {}, './state': state, './subscription-provider': facts,
  '@/lib/stripe': { stripe: {}, findActiveLikeSubscriptions: async () => [], isDoyaSubscriptionOwnedByUser: async () => true,
    ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']) },
}, { console })
const id = '123e4567-e89b-42d3-a456-426614174000'
const actor = { id: 'actor1', email: 'actor@example.invalid', stripeCustomerId: null, stripeSubscriptionId: null, savedSubscriptionId: null }
const identity = { operator: { kind: 'user', id: actor.id }, targetUserId: actor.id, operationId: id, kind: 'cancel' }
const target = { id: 'sub_a', customerId: 'cus_a', status: 'trialing', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const plan = planModule.makeSubscriptionPlan({ identity, mode: 'test', email: actor.email, expectedCustomerId: null,
  expectedSubscriptionId: null, serviceId: 'banner', cancelMode: 'period_end', targets: [target] })
const key = planModule.subscriptionActionKeys(plan)[0]
;(async () => {
  let reads = 0, writes = 0, before = 0
  const original = { id: target.id, customer: target.customerId, livemode: false, status: target.status,
    cancel_at_period_end: false, current_period_end: target.currentPeriodEnd }
  const sdk = { subscriptions: {
    retrieve: async () => { reads++; return original },
    update: async (_id, _params, options) => { writes++; assert.ok(options.idempotencyKey.includes(id)); return { ...original, cancel_at_period_end: true } },
    cancel: async () => { writes++; return { ...original, status: 'canceled' } },
  } }
  const provider = adapter.subscriptionStripeProvider(sdk, 'test', async () => [
    { id: target.id, customerId: target.customerId, status: target.status, priceId: null, planId: 'banner-pro' },
  ], async () => true)
  await check('full discovery freezes exact owned trialing target', async () => {
    assert.equal(JSON.stringify(await provider.discover(actor, 'cancel')), JSON.stringify([target]))
    assert.equal(reads, 1)
  })
  await check('dispatch checks before external write and records verified ack', async () => {
    const fact = await provider.mutate(plan, target, key, actor, async () => { before++ })
    facts.assertVerifiedSubscriptionFact(fact)
    assert.equal(before, 1); assert.equal(writes, 1)
    assert.equal(fact.outcome.status, 'scheduled_cancel')
  })
  await check('changed Customer fails before write', async () => {
    const previous = sdk.subscriptions.retrieve
    sdk.subscriptions.retrieve = async () => ({ ...original, customer: 'cus_foreign' })
    try { await assert.rejects(provider.mutate(plan, target, key, actor, async () => { before++ })) }
    finally { sdk.subscriptions.retrieve = previous }
    assert.equal(writes, 1)
  })
  await check('mismatched provider ack remains unknown', async () => {
    const previous = sdk.subscriptions.update
    sdk.subscriptions.update = async () => { writes++; return { ...original, id: 'sub_other', cancel_at_period_end: true } }
    try { await assert.rejects(provider.mutate(plan, target, key, actor, async () => { before++ })) }
    finally { sdk.subscriptions.update = previous }
  })
  await check('mixed-case IDs discover in the plan canonical order and both targets process once', async () => {
    const ids = ['sub_a', 'sub_Z']
    const multiSdk = { subscriptions: {
      retrieve: async id => ({ ...original, id, customer: 'cus_a' }),
      update: async id => ({ ...original, id, customer: 'cus_a', cancel_at_period_end: true }),
    } }
    const multi = adapter.subscriptionStripeProvider(multiSdk, 'test', async () => ids.map(id => ({
      id, customerId: 'cus_a', status: 'trialing', priceId: null, planId: 'banner-pro',
    })), async () => true)
    const targets = await multi.discover(actor, 'cancel')
    assert.equal(JSON.stringify(targets.map(item => item.id)), JSON.stringify(['sub_Z', 'sub_a']))
    const plan2 = planModule.makeSubscriptionPlan({ identity, mode: 'test', email: actor.email,
      expectedCustomerId: null, expectedSubscriptionId: null, serviceId: 'banner', cancelMode: 'period_end', targets })
    const keys = planModule.subscriptionActionKeys(plan2)
    const processed = []
    for (let index = 0; index < targets.length; index++) {
      const fact = await multi.mutate(plan2, targets[index], keys[index], actor, async () => { processed.push(targets[index].id) })
      facts.assertVerifiedSubscriptionFact(fact)
    }
    assert.deepEqual(processed, ['sub_Z', 'sub_a'])
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'real adapter with synthetic SDK/discovery and no provider network', writes }))
})().catch(error => { console.error(error); process.exitCode = 1 })
