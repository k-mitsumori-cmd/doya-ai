// Historical cancellation matrix against the actual C1 adapter. The owned PG
// matrix separately verifies receipt/fence/ledger/outbox atomicity and races.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const adapter = load('src/lib/account-lifecycle/subscription-stripe-provider.ts', {
  'server-only': {}, './state': state, './subscription-provider': facts,
  '@/lib/stripe': { stripe: {}, findActiveLikeSubscriptions: async () => [], isDoyaSubscriptionOwnedByUser: async () => true,
    ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']) },
})
const actor = { id: 'user', email: 'synthetic@example.invalid', stripeCustomerId: null,
  stripeSubscriptionId: null, savedSubscriptionId: 'sub_saved' }
const identity = { operator: { kind: 'user', id: actor.id }, targetUserId: actor.id,
  operationId: '123e4567-e89b-42d3-a456-426614174000', kind: 'cancel' }
function fixture({ fail = [], mode = 'period_end', foreignIds = [], saved = false, outOfSync = false } = {}) {
  const calls = { reads: [], writes: [], before: 0, alert: 0, delivery: 0 }
  const ids = saved ? ['sub_saved'] : ['sub_a', 'sub_b']
  const raw = id => ({ id, customer: `cus_${id.slice(4)}`, livemode: false,
    status: 'active', cancel_at_period_end: false, current_period_end: 2000000000,
    metadata: { userId: foreignIds.includes(id) ? 'other' : actor.id } })
  const sdk = { subscriptions: {
    retrieve: async id => { calls.reads.push(id); return raw(id) },
    update: async (id, payload, options) => {
      calls.writes.push({ id, payload, options }); if (fail.includes(id)) throw Error('synthetic failure')
      return { ...raw(id), cancel_at_period_end: outOfSync ? false : true }
    },
    cancel: async (id, _params, options) => {
      calls.writes.push({ id, options }); if (fail.includes(id)) throw Error('synthetic failure')
      return { ...raw(id), status: outOfSync ? 'active' : 'canceled' }
    },
  } }
  const provider = adapter.subscriptionStripeProvider(sdk, 'test', async () => saved ? [] : ids.map(id => ({
    id, status: 'active', customerId: raw(id).customer, priceId: null, planId: 'banner-pro',
  })), async subscription => subscription.metadata.userId === actor.id)
  const discover = () => provider.discover(actor, 'cancel')
  const execute = async () => {
    const targets = await discover()
    const plan = plans.makeSubscriptionPlan({ identity, mode: 'test', email: actor.email,
      expectedCustomerId: null, expectedSubscriptionId: null, serviceId: 'banner', cancelMode: mode, targets })
    const keys = plans.subscriptionActionKeys(plan), outcomes = []
    for (let i = 0; i < targets.length; i++) {
      try {
        const fact = await provider.mutate(plan, targets[i], keys[i], actor, async () => { calls.before++ })
        facts.assertVerifiedSubscriptionFact(fact); outcomes.push(fact.outcome.status)
      } catch { outcomes.push('unknown') }
    }
    return { targets, outcomes }
  }
  return { calls, discover, execute }
}
;(async () => {
  for (const scenario of ['foreign-app', 'other-user', 'own-legacy']) await check('saved subscription fallback ' + scenario, async () => {
    const f = fixture({ saved: true, foreignIds: scenario === 'own-legacy' ? [] : ['sub_saved'] })
    if (scenario === 'own-legacy') {
      const result = await f.execute(); assert.deepEqual(result.outcomes, ['scheduled_cancel'])
      assert.deepEqual(f.calls.writes.map(x => x.id), ['sub_saved'])
    } else {
      await assert.rejects(f.discover); assert.equal(f.calls.writes.length, 0)
    }
  })
  for (const mode of ['period_end', 'immediate']) for (const fail of [[], ['sub_a'], ['sub_b'], ['sub_a', 'sub_b']])
    await check(mode + ' fails=' + fail.join(','), async () => {
      const f = fixture({ fail, mode }); const result = await f.execute()
      assert.deepEqual(f.calls.writes.map(x => x.id), ['sub_a', 'sub_b'])
      assert.equal(result.outcomes.filter(x => x === 'unknown').length, fail.length)
      assert.equal(result.outcomes.filter(x => x === (mode === 'immediate' ? 'canceled' : 'scheduled_cancel')).length, 2 - fail.length)
      assert.equal(f.calls.before, 2)
      assert.ok(f.calls.writes.every(x => x.options.idempotencyKey.includes(identity.operationId)))
      assert.equal(f.calls.alert + f.calls.delivery, 0)
    })
  await check('provider failure never delivers a notification directly', async () => {
    const f = fixture({ fail: ['sub_a'] }); const result = await f.execute()
    assert.deepEqual(result.outcomes, ['unknown', 'scheduled_cancel'])
    assert.equal(f.calls.alert + f.calls.delivery, 0)
  })
  await check('uncorrelated provider success is unknown, never a false completion', async () => {
    const f = fixture({ outOfSync: true }); const result = await f.execute()
    assert.deepEqual(result.outcomes, ['unknown', 'unknown'])
    assert.equal(f.calls.alert + f.calls.delivery, 0)
  })
  await check('foreign contract in stale discovery is never canceled', async () => {
    const f = fixture({ foreignIds: ['sub_a'] })
    await assert.rejects(f.execute)
    assert.deepEqual(f.calls.writes, [])
  })
  // The three actual screens and durable status-only recovery are mounted in
  // verify-subscription-management-mounted.cjs; this fixture asserts SDK limits.
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual C1 adapter with synthetic SDK; DB outbox tested separately' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
