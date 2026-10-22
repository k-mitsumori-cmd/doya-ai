const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
const planModule = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': require('node:crypto'), './state': state })
const store = load('src/lib/account-lifecycle/store.ts', {
  'node:crypto': require('node:crypto'), '@prisma/client': { Prisma: {} }, './state': state,
  './subscription-plan': planModule, './subscription-provider': {},
})
const operationId = '123e4567-e89b-42d3-a456-426614174000'
const identity = { operator: { kind: 'user', id: 'actor1' }, targetUserId: 'actor1', operationId, kind: 'cancel' }
const plan = planModule.makeSubscriptionPlan({ identity, mode: 'test', email: 'actor@example.invalid',
  expectedCustomerId: null, expectedSubscriptionId: null, serviceId: 'banner', cancelMode: 'period_end',
  targets: [{ id: 'sub_one', customerId: 'cus_one', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }] })
function db(initial = {}, failKey = null) {
  let rows = new Map(Object.entries(initial))
  const tx = {
    $queryRaw: async strings => String(strings[0]).includes('FROM "User"') ? [{ id: 'actor1' }] : [{ locked: 1 }],
    user: { findUnique: async () => ({ email: 'actor@example.invalid', stripeCustomerId: null, stripeSubscriptionId: null }) },
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      count: async ({ where }) => where.key.in.filter(k => rows.has(k)).length,
      findFirst: async ({ where }) => [...rows.keys()].some(k => k.startsWith(where.key.startsWith)) ? { key: 'fact' } : null,
      create: async ({ data }) => {
        if (data.key === failKey) throw Error('synthetic insert failure')
        if (rows.has(data.key)) throw Error('duplicate key')
        rows.set(data.key, data.value)
      },
    },
  }
  return { $transaction: async fn => { const before = new Map(rows); try { return await fn(tx) } catch (error) { rows = before; throw error } },
    keys: () => [...rows.keys()].sort(), rows: () => rows }
}
;(async () => {
  await check('atomic receipt/fence/typed-plan/ledger admission and exact duplicate', async () => {
    const fixture = db()
    const fresh = await store.admitSubscriptionLifecycle(fixture, plan)
    assert.equal(fresh.created, true)
    assert.equal(fixture.keys().length, 4)
    assert.ok(fixture.keys().includes(planModule.subscriptionPlanKey(operationId)))
    const duplicate = await store.admitSubscriptionLifecycle(fixture, plan)
    assert.equal(duplicate.created, false)
    assert.equal(fixture.keys().length, 4)
  })
  await check('plan insert failure rolls back every authority row', async () => {
    const fixture = db({}, planModule.subscriptionPlanKey(operationId))
    await assert.rejects(store.admitSubscriptionLifecycle(fixture, plan))
    assert.equal(fixture.keys().length, 0)
  })
  await check('orphan subscription plan reserves UUID globally', async () => {
    const fixture = db({ [planModule.subscriptionPlanKey(operationId)]: '{malformed' })
    await assert.rejects(store.admitSubscriptionLifecycle(fixture, plan))
    assert.equal(fixture.keys().length, 1)
  })
  const completeFact = JSON.stringify({ operationId, actionKey: 'a'.repeat(64), subscriptionId: 'sub_one',
    customerId: 'cus_one', mode: 'test', status: 'active', cancelAtPeriodEnd: true,
    currentPeriodEnd: 1900000000, outcome: { proof: 'ack', resourceId: 'sub_one', status: 'scheduled_cancel' } })
  for (const value of [completeFact, '{malformed']) await check('orphan subscription fact cannot appear missing or reserve UUID ' + value, async () => {
    const fixture = db({ [`doya-subscription-fact:v1:${operationId}:orphan`]: value })
    const before = fixture.keys()
    await assert.rejects(store.readSubscriptionLifecycle(fixture, identity))
    await assert.rejects(store.readSubscriptionServerState(fixture, identity))
    await assert.rejects(store.abortUnstartedLifecycleOperation(fixture, identity, plan.inputDigest))
    for (const kind of ['retirement', 'checkout', 'cancel', 'resume', 'change', 'portal']) {
      const foreign = { ...identity, kind, operator: kind === 'retirement' ? { kind: 'admin', id: 'admin1' } : identity.operator }
      await assert.rejects(store.reserveLifecycleOperation(fixture, foreign, plan.inputDigest))
    }
    assert.deepEqual(fixture.keys(), before)
  })
  await check('aborted tombstone with orphan fact never reports a safe terminal state', async () => {
    const fixture = db()
    await store.abortUnstartedLifecycleOperation(fixture, identity, plan.inputDigest)
    fixture.rows().set(`doya-subscription-fact:v1:${operationId}:orphan`, '{malformed')
    await assert.rejects(store.readSubscriptionLifecycle(fixture, identity))
    await assert.rejects(store.readSubscriptionServerState(fixture, identity))
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual admission against transactional synthetic store; no PostgreSQL concurrency claim' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
