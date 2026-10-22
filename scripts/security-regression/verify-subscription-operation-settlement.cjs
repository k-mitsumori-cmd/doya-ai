const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma: {} },
  './state': state, './subscription-plan': plans, './subscription-provider': facts,
  '@/lib/billing-sync': { projectUnifiedBilling: async (tx, input) => {
    const old = await tx.user.findUnique({ where: { id: input.userId } })
    await tx.user.update({ where: { id: input.userId }, data: { plan: input.plan,
      stripeSubscriptionId: input.stripeSubscriptionId, stripePriceId: input.stripePriceId } })
    return { userPlan: input.plan, servicePlan: input.plan, previousPlan: old.plan || 'PRO' }
  } },
})
const coordinator = load('src/lib/account-lifecycle/subscription.ts', { 'server-only': {}, 'node:crypto': crypto,
  './state': state, './subscription-plan': plans, './subscription-provider': facts, './store': store })
const actor = { id: 'actor1', email: 'actor@example.invalid', stripeCustomerId: null, stripeSubscriptionId: null }
const target = { id: 'sub_one', customerId: 'cus_one', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const receiptPrefix = 'doya-account-operation:v2:'
function fixture() {
  let rows = new Map()
  let user = { id: actor.id, email: actor.email, stripeCustomerId: null, stripeSubscriptionId: null }
  let failCompletionReceiptOnce = false
  const tx = {
    $queryRaw: async strings => String(strings[0]).includes('FROM "User"') ? [{ id: user.id }] : [{ locked: 1 }],
    user: {
      findUnique: async () => ({ ...user }),
      update: async ({ data }) => { user = { ...user, ...data }; return { ...user } },
    },
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      findFirst: async ({ where }) => [...rows.keys()].find(k => k.startsWith(where.key.startsWith)) ? { key: 'found' } : null,
      count: async ({ where }) => where.key.in.filter(k => rows.has(k)).length,
      create: async ({ data }) => { if (rows.has(data.key)) throw Error('duplicate'); rows.set(data.key, data.value) },
      updateMany: async ({ where, data }) => {
        if (!rows.has(where.key) || rows.get(where.key) !== where.value) return { count: 0 }
        if (failCompletionReceiptOnce && where.key.startsWith(receiptPrefix) && JSON.parse(data.value).phase === 'completed') {
          failCompletionReceiptOnce = false
          throw Error('synthetic completion receipt write failure')
        }
        rows.set(where.key, data.value); return { count: 1 }
      },
      deleteMany: async ({ where }) => {
        if (!rows.has(where.key) || rows.get(where.key) !== where.value) return { count: 0 }
        rows.delete(where.key); return { count: 1 }
      },
    },
  }
  return {
    $transaction: async fn => {
      const beforeRows = new Map(rows), beforeUser = { ...user }
      try { return await fn(tx) } catch (error) { rows = beforeRows; user = beforeUser; throw error }
    },
    rows: () => rows, user: () => ({ ...user }), failCompletionReceipt: () => { failCompletionReceiptOnce = true },
  }
}
function provider() {
  const calls = { writes: 0, reads: 0 }
  return { calls, implementation: {
    discover: async () => [{ ...target }],
    readExact: async () => { calls.reads++; throw Error('unexpected provider read') },
    mutate: async (plan, item, key, _actor, beforeWrite) => {
      await beforeWrite(); calls.writes++
      return facts.verifySubscriptionFact(plan, item, key, { id: item.id, customerId: item.customerId,
        livemode: false, status: 'active', cancelAtPeriodEnd: plan.identity.kind === 'cancel',
        currentPeriodEnd: item.currentPeriodEnd })
    },
  } }
}
const action = (kind, operationId) => ({ action: 'start', operationId, expectedActorId: actor.id,
  serviceId: 'banner', ...(kind === 'cancel' ? { mode: 'period_end' } : {}) })
const handle = (op, operationId) => ({ action: op, operationId, expectedActorId: actor.id })
const phase = (db, operationId) => JSON.parse(db.rows().get(receiptPrefix + operationId)).phase
const factCount = db => [...db.rows().keys()].filter(k => k.startsWith('doya-subscription-fact:v1:')).length
const fenceCount = db => [...db.rows().keys()].filter(k => k.startsWith('doya-account-fence:v2:')).length
;(async () => {
  for (const kind of ['cancel', 'resume']) await check('actual ' + kind + ' coordinator settles verified fact, User and fence atomically', async () => {
    const db = fixture(), p = provider(), c = coordinator.subscriptionCoordinator(db, p.implementation, 'test')
    const operationId = crypto.randomUUID()
    const view = await c.handle(kind, actor, action(kind, operationId))
    assert.equal(p.calls.writes, 1); assert.equal(factCount(db), 1)
    if (process.env.DOYA_C1_EXPECT_BEFORE === '1') {
      assert.equal(view.phase, 'executing'); assert.equal(phase(db, operationId), 'executing'); assert.equal(fenceCount(db), 1)
      return
    }
    assert.equal(view.phase, 'completed'); assert.equal(phase(db, operationId), 'completed')
    assert.equal(fenceCount(db), 0); assert.equal(db.user().stripeCustomerId, 'cus_one')
    assert.equal(db.user().stripeSubscriptionId, 'sub_one')
    assert.equal((await c.handle(kind, actor, handle('status', operationId))).phase, 'completed')
    assert.equal(p.calls.writes, 1)
  })
  await check('receipt failure rolls back User and terminal, same handle settles confirmed action without replay', async () => {
    const db = fixture(), p = provider(), c = coordinator.subscriptionCoordinator(db, p.implementation, 'test')
    const operationId = crypto.randomUUID(); db.failCompletionReceipt()
    const first = await c.handle('cancel', actor, action('cancel', operationId))
    assert.equal(first.phase, 'executing'); assert.equal(fenceCount(db), 1); assert.equal(factCount(db), 1)
    assert.equal(db.user().stripeCustomerId, null); assert.equal(db.user().stripeSubscriptionId, null)
    const settled = await c.handle('cancel', actor, handle('continue', operationId))
    if (process.env.DOYA_C1_EXPECT_BEFORE === '1') {
      assert.equal(settled.phase, 'executing'); assert.equal(fenceCount(db), 1)
      return
    }
    assert.equal(settled.phase, 'completed'); assert.equal(fenceCount(db), 0)
    assert.equal(db.user().stripeCustomerId, 'cus_one'); assert.equal(p.calls.writes, 1)
  })
  await check('reserved abort lost response replays same terminal without plan mutation or provider I/O', async () => {
    const db = fixture(), p = provider(), c = coordinator.subscriptionCoordinator(db, p.implementation, 'test')
    const operationId = crypto.randomUUID(), id = { operator: { kind: 'user', id: actor.id }, targetUserId: actor.id,
      operationId, kind: 'cancel' }
    const plan = plans.makeSubscriptionPlan({ identity: id, mode: 'test', email: actor.email,
      expectedCustomerId: null, expectedSubscriptionId: null, serviceId: 'banner', cancelMode: 'period_end', targets: [{ ...target }] })
    await store.admitSubscriptionLifecycle(db, plan)
    const first = await c.handle('cancel', actor, handle('abort', operationId))
    assert.equal(first.phase, 'aborted'); assert.equal(fenceCount(db), 0)
    const before = [...db.rows()].sort()
    if (process.env.DOYA_C1_EXPECT_BEFORE === '1') {
      await assert.rejects(c.handle('cancel', actor, handle('abort', operationId)), e => e.code === 'LIFECYCLE_INPUT_CONFLICT')
      assert.deepEqual([...db.rows()].sort(), before); return
    }
    const second = await c.handle('cancel', actor, handle('abort', operationId))
    assert.equal(second.phase, 'aborted'); assert.deepEqual([...db.rows()].sort(), before)
    assert.equal(p.calls.writes, 0); assert.equal(p.calls.reads, 0)
    await assert.rejects(c.handle('resume', actor, handle('abort', operationId)))
    assert.deepEqual([...db.rows()].sort(), before)
  })
  await check('missing handle abort creates one tombstone and same-handle replay only observes it', async () => {
    const db = fixture(), p = provider(), c = coordinator.subscriptionCoordinator(db, p.implementation, 'test')
    const operationId = crypto.randomUUID()
    assert.equal((await c.handle('cancel', actor, handle('abort', operationId))).phase, 'aborted')
    const before = [...db.rows()].sort(); assert.equal(before.length, 1)
    assert.equal((await c.handle('cancel', actor, handle('abort', operationId))).phase, 'aborted')
    assert.deepEqual([...db.rows()].sort(), before)
    await assert.rejects(c.handle('resume', actor, handle('abort', operationId)))
    assert.deepEqual([...db.rows()].sort(), before)
    assert.equal(p.calls.writes, 0); assert.equal(p.calls.reads, 0)
  })
  await check('new self immediate cancel requires atomic projected coverage; lost final receipt retries fact only', async () => {
    const db = fixture(); let writes = 0, reads = 0
    const implementation = {
      discover: async () => [{ ...target }],
      mutate: async (plan, item, key, _actor, beforeWrite) => {
        await beforeWrite(); writes++
        return facts.verifySubscriptionFact(plan, item, key, { id: item.id, customerId: item.customerId,
          livemode: false, status: 'canceled', cancelAtPeriodEnd: false, currentPeriodEnd: item.currentPeriodEnd })
      },
      readExact: async () => { reads++; return { id: target.id, customer: target.customerId,
        livemode: false, status: 'canceled', cancel_at_period_end: false, current_period_end: target.currentPeriodEnd } },
      settlement: async () => ({ userId: actor.id, plan: 'FREE', stripeSubscriptionId: null,
        stripePriceId: null, stripeCurrentPeriodEnd: null }),
    }
    const c = coordinator.subscriptionCoordinator(db, implementation, 'test'), operationId = crypto.randomUUID()
    db.failCompletionReceipt()
    const pending = await c.handle('cancel', actor, { ...action('cancel', operationId), mode: 'immediate' })
    assert.equal(pending.phase, 'executing'); assert.equal(writes, 1); assert.equal(fenceCount(db), 1)
    assert.ok(db.rows().has('doya-subscription-settlement-required:v1:' + operationId))
    assert.equal(db.rows().has('doya-subscription-settlement-applied:v1:' + operationId), false)
    const done = await c.handle('cancel', actor, handle('reconcile', operationId))
    assert.equal(done.phase, 'completed'); assert.equal(db.user().plan, 'FREE')
    assert.ok(db.rows().has('doya-subscription-settlement-applied:v1:' + operationId))
    assert.equal(fenceCount(db), 0); assert.equal(writes, 1); assert.equal(reads, 1)
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual coordinator/store with transactional synthetic DB; no PostgreSQL concurrency claim' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
