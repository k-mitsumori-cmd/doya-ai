// Preserve the fourteen historical resume outcomes against the actual C1 adapter.
// Discovery and the Stripe SDK are synthetic; no customer or subscription is live.
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const crypto = require('node:crypto')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const adapter = load('src/lib/account-lifecycle/subscription-stripe-provider.ts', {
  'server-only': {}, './state': state, './subscription-provider': facts,
  '@/lib/stripe': { stripe: {}, findActiveLikeSubscriptions: async () => [], isDoyaSubscriptionOwnedByUser: async () => true,
    ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']) },
})
const actor = { id: 'u', email: 'synthetic@example.invalid', stripeCustomerId: 'cus_split',
  stripeSubscriptionId: 'sub_new', savedSubscriptionId: 'sub_stale' }
const operationId = '123e4567-e89b-42d3-a456-426614174000'
const identity = { operator: { kind: 'user', id: actor.id }, targetUserId: actor.id, operationId, kind: 'resume' }
const cases = ['active', 'trialing', 'past_due', 'already-resumed', 'none', 'multiple', 'lookup-error',
  'ended', 'wrong-customer', 'foreign-app', 'other-user', 'legacy-foreign-email', 'update-failure', 'unchanged']
;(async () => {
  for (const scenario of cases) await check('resume ' + scenario, async () => {
    const status = scenario === 'ended' ? 'canceled' : ['trialing', 'past_due'].includes(scenario) ? scenario : 'active'
    const raw = { id: 'sub_new', customer: scenario === 'wrong-customer' ? 'cus_foreign' : 'cus_split',
      livemode: false, status, cancel_at_period_end: scenario !== 'already-resumed', current_period_end: 2000000000,
      metadata: { userId: scenario === 'other-user' ? 'other' : actor.id } }
    const discovery = async () => {
      if (scenario === 'lookup-error') throw Error('synthetic offline')
      if (scenario === 'none') return []
      return scenario === 'multiple'
        ? [{ id: 'sub_a', customerId: 'cus_split' }, { id: 'sub_b', customerId: 'cus_split' }]
        : [{ id: 'sub_new', customerId: 'cus_split' }]
    }
    const calls = { reads: [], writes: [], beforeWrite: 0 }
    const sdk = { subscriptions: {
      retrieve: async id => { calls.reads.push(id); return raw },
      update: async (id, payload, options) => {
        calls.writes.push({ id, payload, options })
        if (scenario === 'update-failure') throw Error('synthetic offline')
        return { ...raw, cancel_at_period_end: scenario === 'unchanged' }
      },
    } }
    const provider = adapter.subscriptionStripeProvider(sdk, 'test', discovery,
      async subscription => !['foreign-app', 'legacy-foreign-email'].includes(scenario) && subscription.metadata.userId === actor.id)
    const eligible = ['active', 'trialing', 'past_due', 'already-resumed', 'update-failure', 'unchanged'].includes(scenario)
    let targets
    try { targets = await provider.discover(actor, 'resume') }
    catch (error) { assert.equal(eligible, false, `unexpected discovery failure: ${error}`) }
    if (!eligible) {
      assert.equal(calls.writes.length, 0)
      assert.ok(!calls.reads.includes('sub_stale'))
      return
    }
    assert.equal(targets.length, 1)
    const plan = plans.makeSubscriptionPlan({ identity, mode: 'test', email: actor.email,
      expectedCustomerId: actor.stripeCustomerId, expectedSubscriptionId: actor.stripeSubscriptionId,
      serviceId: 'banner', cancelMode: null, targets })
    const key = plans.subscriptionActionKeys(plan)[0]
    const mutate = () => provider.mutate(plan, targets[0], key, actor, async () => { calls.beforeWrite++ })
    if (['update-failure', 'unchanged'].includes(scenario)) await assert.rejects(mutate)
    else {
      const fact = await mutate(); facts.assertVerifiedSubscriptionFact(fact)
      assert.equal(fact.outcome.status, 'resumed')
    }
    assert.equal(calls.writes.length, scenario === 'already-resumed' ? 0 : 1)
    assert.equal(calls.beforeWrite, scenario === 'already-resumed' ? 0 : 1)
    assert.ok(!calls.reads.includes('sub_stale'))
    if (calls.writes.length) {
      assert.equal(calls.writes[0].id, 'sub_new')
      assert.equal(calls.writes[0].payload.cancel_at_period_end, false)
      assert.match(calls.writes[0].options.idempotencyKey, /doya-subscription-v1:/)
    }
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual C1 provider, synthetic discovery and SDK; no DB or Stripe network' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
