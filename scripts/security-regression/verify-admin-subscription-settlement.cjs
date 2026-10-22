// Actual admin coordinator/store against transactional synthetic rows. Not a PostgreSQL concurrency proof.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/admin-subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/admin-subscription-fact.ts', { './state': state, './admin-subscription-plan': plans })
let authority = true, failReceipt = false
const projection = async (tx, input) => {
  await tx.user.update({ where: { id: input.userId }, data: { plan: input.plan,
    stripeSubscriptionId: input.stripeSubscriptionId, stripePriceId: input.stripePriceId } })
  return { userPlan: input.plan, servicePlan: input.plan, previousPlan: 'PRO' }
}
const store = load('src/lib/account-lifecycle/store.ts', {
  'node:crypto': crypto, '@prisma/client': { Prisma: {} }, './state': state,
  './admin-subscription-plan': plans, './admin-subscription-fact': facts,
  '@/lib/admin-auth': { verifyAdminAuthorityTx: async () => authority },
  '@/lib/billing-sync': { projectUnifiedBilling: projection },
})
const coordinator = load('src/lib/account-lifecycle/admin-subscription.ts', { 'server-only': {},
  './state': state, './admin-subscription-plan': plans, './store': store })
const user = { id: 'user1', email: 'user@example.invalid', stripeCustomerId: 'cus_one',
  stripeSubscriptionId: 'sub_one', stripePriceId: 'price_one', plan: 'PRO' }
const target = { id: 'sub_one', customerId: 'cus_one', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const ctx = { adminId: 'admin1', sessionToken: 'synthetic-admin-token' }
function fixture() {
  let rows = new Map(), current = { ...user }
  const tx = {
    $queryRaw: async strings => String(strings[0]).includes('FROM "User"') ? [{ id: current.id }] : [{ locked: 1 }],
    user: {
      findUnique: async ({ where }) => where.id === current.id ? { ...current } : null,
      update: async ({ data }) => { current = { ...current, ...data }; return { ...current } },
    },
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null,
      findFirst: async ({ where }) => [...rows.keys()].find(k => k.startsWith(where.key.startsWith)) ? { key: 'found' } : null,
      count: async ({ where }) => where.key.in.filter(k => rows.has(k)).length,
      create: async ({ data }) => { if (rows.has(data.key)) throw Error('duplicate'); rows.set(data.key, data.value) },
      updateMany: async ({ where, data }) => {
        if (!rows.has(where.key) || rows.get(where.key) !== where.value) return { count: 0 }
        if (failReceipt && where.key.startsWith('doya-account-operation:v2:') && JSON.parse(data.value).phase === 'completed') {
          failReceipt = false; throw Error('synthetic terminal receipt failure')
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
    user: tx.user,
    $transaction: async fn => {
      const previous = new Map(rows), before = { ...current }
      try { return await fn(tx) } catch (error) { rows = previous; current = before; throw error }
    },
    rows: () => rows, current: () => ({ ...current }),
  }
}
function provider(options = {}) {
  let writes = 0, reads = 0
  return { calls: () => ({ writes, reads }), implementation: {
    discover: async () => ({ ...target }),
    mutate: async (plan, _user, beforeWrite) => {
      await beforeWrite(); writes++
      if (options.loseAck) throw Error('synthetic lost response')
      return facts.verifyAdminSubscriptionFact(plan, { proof: plan.intent === 'immediate_cancel' ? 'irreversible_terminal' : 'write_ack',
        status: plan.intent === 'immediate_cancel' ? 'canceled' : 'active',
        cancelAtPeriodEnd: plan.intent === 'period_end_cancel', currentPeriodEnd: target.currentPeriodEnd })
    },
    reconcileImmediate: async plan => { reads++; return facts.verifyAdminSubscriptionFact(plan, {
      proof: 'irreversible_terminal', status: 'canceled', cancelAtPeriodEnd: false,
      currentPeriodEnd: target.currentPeriodEnd }) },
    settlement: async () => ({ userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
      stripePriceId: null, stripeCurrentPeriodEnd: null }),
  } }
}
const action = (id, intent, verb = 'start') => ({ action: verb, operationId: id, expectedAdminId: ctx.adminId,
  targetUserId: user.id, intent })
;(async () => {
  await check('scheduled exact admin action commits fact/coverage/receipt without projecting tier', async () => {
    authority = true; const db = fixture(), p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test')
    const id = crypto.randomUUID(); const done = await c.handle(ctx, action(id, 'period_end_cancel'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls().writes, 1)
    assert.equal(db.current().plan, 'PRO')
    assert.ok(db.rows().has(plans.adminSubscriptionSettlementKey(id)))
    assert.equal((await c.handle(ctx, action(id, 'period_end_cancel', 'start'))).phase, 'completed')
    assert.equal(p.calls().writes, 1)
  })
  await check('immediate projection and completed receipt rollback together, then same-ID fact settles without a second write', async () => {
    authority = true; const db = fixture(), p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test')
    const id = crypto.randomUUID(); failReceipt = true
    const pending = await c.handle(ctx, action(id, 'immediate_cancel'))
    assert.equal(pending.phase, 'executing'); assert.equal(db.current().plan, 'PRO')
    assert.equal(db.current().stripeSubscriptionId, 'sub_one')
    assert.ok(db.rows().has(plans.adminSubscriptionFactKey(id)))
    assert.equal(db.rows().has(plans.adminSubscriptionSettlementKey(id)), false)
    const done = await c.handle(ctx, action(id, 'immediate_cancel', 'reconcile'))
    assert.equal(done.phase, 'completed'); assert.equal(db.current().plan, 'FREE')
    assert.equal(db.current().stripeSubscriptionId, null); assert.equal(p.calls().writes, 1)
  })
  await check('lost provider response keeps unknown fence and never replays the write', async () => {
    authority = true; const db = fixture(), p = provider({ loseAck: true }), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test')
    const id = crypto.randomUUID(); const pending = await c.handle(ctx, action(id, 'immediate_cancel'))
    assert.equal(pending.phase, 'executing'); assert.equal(pending.reason, 'EXTERNAL_UNKNOWN')
    assert.equal(p.calls().writes, 1)
    assert.equal((await c.handle(ctx, action(id, 'immediate_cancel', 'start'))).phase, 'executing')
    assert.equal(p.calls().writes, 1)
    const done = await c.handle(ctx, action(id, 'immediate_cancel', 'reconcile'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls().writes, 1); assert.equal(p.calls().reads, 1)
  })
  await check('admin revocation after send stores fact but does not expose or settle it', async () => {
    authority = true; const db = fixture(), p = provider(), c = coordinator.adminSubscriptionCoordinator(db, {
      ...p.implementation, mutate: async (...args) => { const fact = await p.implementation.mutate(...args); authority = false; return fact },
    }, 'test')
    const id = crypto.randomUUID()
    await assert.rejects(c.handle(ctx, action(id, 'immediate_cancel')), { code: 'ADMIN_AUTHORITY_CHANGED' })
    assert.ok(db.rows().has(plans.adminSubscriptionFactKey(id)))
    assert.equal(db.rows().has(plans.adminSubscriptionSettlementKey(id)), false)
    assert.equal(db.current().plan, 'PRO')
    authority = true
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual admin coordinator/store synthetic transactional DB; no PostgreSQL/provider network' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
