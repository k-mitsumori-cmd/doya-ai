// Actual admin POST -> coordinator -> store -> SDK adapter, with synthetic transactional rows and SDK.
// This checks the composed handler. Native PostgreSQL races and real Stripe remain separate gates.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/admin-subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/admin-subscription-fact.ts', { './state': state, './admin-subscription-plan': plans })
const id = 'admin1', userId = 'user1'
let admin, session, token, current, rows, raw, writes, reads, mutateOnRead, mutateAtRead, mutateAfterWrite, wrongAck
const stripe = { subscriptions: {
  retrieve: async subscriptionId => {
    reads++
    if (mutateOnRead && (!mutateAtRead || reads === mutateAtRead)) {
      const work = mutateOnRead; mutateOnRead = null; work()
    }
    return { ...raw, id: subscriptionId }
  },
  update: async (subscriptionId, params, opts) => {
    assert.equal(subscriptionId, 'sub_one'); assert.match(opts.idempotencyKey, /doya-admin-subscription-v1/)
    writes++; raw = { ...raw, cancel_at_period_end: params.cancel_at_period_end }
    if (mutateAfterWrite) { const work = mutateAfterWrite; mutateAfterWrite = null; work() }
    return { ...raw, ...(wrongAck ? { customer: 'cus_wrong' } : {}) }
  },
  cancel: async (subscriptionId, _params, opts) => {
    assert.equal(subscriptionId, 'sub_one'); assert.match(opts.idempotencyKey, /doya-admin-subscription-v1/)
    writes++; raw = { ...raw, status: 'canceled', cancel_at_period_end: false }
    if (mutateAfterWrite) { const work = mutateAfterWrite; mutateAfterWrite = null; work() }
    return { ...raw, ...(wrongAck ? { customer: 'cus_wrong' } : {}) }
  },
} }
const tx = {
  $queryRaw: async (strings, ...values) => {
    const sql = String(strings[0])
    if (sql.includes('FROM "User"')) return current ? [{ id: current.id }] : []
    if (sql.includes('FROM "AdminUser"')) return admin?.isActive ? [{ id: admin.id }] : []
    if (sql.includes('FROM "AdminSession"')) return session?.active && session.token === values[0] ? [{ id: session.id }] : []
    if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }]
    throw Error('Unexpected SQL ' + sql)
  },
  user: {
    findUnique: async ({ where }) => where.id === current?.id ? { ...current } : null,
    update: async ({ data }) => { current = { ...current, ...data }; return { ...current } },
  },
  adminUser: { findUnique: async ({ where }) => where.id === admin?.id ? { ...admin } : null },
  adminSession: { findFirst: async ({ where }) => session?.active && session.token === where.token &&
    session.adminUserId === where.adminUserId ? { ...session } : null },
  systemSetting: {
    findUnique: async ({ where }) => rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null,
    findFirst: async ({ where }) => [...rows.keys()].find(key => key.startsWith(where.key.startsWith)) ? { key: 'found' } : null,
    count: async ({ where }) => where.key.in.filter(key => rows.has(key)).length,
    create: async ({ data }) => { if (rows.has(data.key)) throw Error('duplicate'); rows.set(data.key, data.value) },
    updateMany: async ({ where, data }) => {
      if (!rows.has(where.key) || rows.get(where.key) !== where.value) return { count: 0 }
      rows.set(where.key, data.value); return { count: 1 }
    },
    deleteMany: async ({ where }) => {
      if (!rows.has(where.key) || rows.get(where.key) !== where.value) return { count: 0 }
      rows.delete(where.key); return { count: 1 }
    },
  },
}
const db = { ...tx, $transaction: async fn => {
  const beforeRows = new Map(rows), beforeUser = { ...current }
  try { return await fn(tx) } catch (error) { rows = beforeRows; current = beforeUser; throw error }
} }
const auth = load('src/lib/admin-auth.ts', { bcryptjs: require('bcryptjs'), jsonwebtoken: require('jsonwebtoken'),
  './prisma': { prisma: db }, '@prisma/client': { Prisma: {} } })
const billing = { projectUnifiedBilling: async (inner, input) => {
  await inner.user.update({ where: { id: input.userId }, data: { plan: input.plan,
    stripeSubscriptionId: input.stripeSubscriptionId, stripePriceId: input.stripePriceId } })
  return { userPlan: input.plan, servicePlan: input.plan, previousPlan: 'PRO' }
} }
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma: {} },
  './state': state, './admin-subscription-plan': plans, './admin-subscription-fact': facts,
  '@/lib/admin-auth': auth, '@/lib/billing-sync': billing })
const coordinator = load('src/lib/account-lifecycle/admin-subscription.ts', { 'server-only': {},
  './state': state, './admin-subscription-plan': plans, './store': store })
const adapter = load('src/lib/account-lifecycle/admin-subscription-stripe-provider.ts', { 'server-only': {},
  './state': state, './admin-subscription-fact': facts, '@/lib/stripe': {
    stripe, findActiveLikeSubscriptions: async () => [], isDoyaSubscriptionOwnedByUser: async () => true,
    ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']), planTierFromPlanId: () => 'FREE',
    resolvePlanIdFromSubscription: () => ({ planId: null, priceId: null }),
  } })
const route = load('src/app/api/admin/stripe/route.ts', { 'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
  '@/lib/admin-auth': auth, '@/lib/prisma': { prisma: db },
  '@/lib/stripe': { stripe, isDoyaSubscriptionOwnedByUser: async () => true },
  '@/lib/private-api-response': { privateApiJson: (body, init) => Response.json(body, init) },
  '@/lib/account-lifecycle/state': state,
  '@/lib/account-lifecycle/admin-subscription': coordinator,
  '@/lib/account-lifecycle/admin-subscription-stripe-provider': adapter,
  '@/lib/account-lifecycle/checkout-stripe-provider': { stripeModeFromSecret: () => 'test' },
}, { Request, Response, Headers, URL })
function reset(scheduled = false) {
  rows = new Map(); writes = 0; reads = 0; mutateOnRead = null; mutateAtRead = 0; mutateAfterWrite = null; wrongAck = false
  admin = { id, username: 'synthetic_admin', email: null, name: null, isActive: true }
  token = auth.generateToken(id, admin.username)
  session = { id: 'session1', adminUserId: id, token, active: true }
  current = { id: userId, email: 'user@example.invalid', plan: 'PRO', stripeCustomerId: 'cus_one',
    stripeSubscriptionId: 'sub_one', stripePriceId: 'price_one' }
  raw = { id: 'sub_one', customer: 'cus_one', livemode: false, status: 'active',
    cancel_at_period_end: scheduled, current_period_end: 1900000000 }
}
const action = (intent, operationId = crypto.randomUUID(), verb = 'start') => ({ action: verb,
  expectedAdminId: id, targetUserId: userId, operationId, intent })
async function post(body) {
  const request = new Request('https://admin.invalid/api/admin/stripe', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const response = await route.POST(request)
  return { status: response.status, body: await response.json() }
}
;(async () => {
  for (const [intent, scheduled] of [['period_end_cancel', false], ['resume', true], ['immediate_cancel', false]]) {
    await check('actual HTTP/' + intent + ' -> current principal/store/SDK adapter', async () => {
      reset(scheduled)
      const request = action(intent), result = await post(request)
      assert.equal(result.status, 200); assert.equal(result.body.phase, 'completed')
      assert.equal(result.body.actorId, id); assert.equal(result.body.operationId, request.operationId)
      assert.equal(writes, 1); assert.equal(rows.has(plans.adminSubscriptionPlanKey(request.operationId)), true)
      assert.equal(rows.has(plans.adminSubscriptionFactKey(request.operationId)), true)
      assert.equal(rows.has(plans.adminSubscriptionSettlementKey(request.operationId)), true)
      assert.equal([...rows.keys()].some(key => key.startsWith('doya-account-fence:v2:')), false)
      assert.equal((await post(request)).body.phase, 'completed'); assert.equal(writes, 1)
    })
  }
  await check('actual HTTP current admin revocation blocks before provider write', async () => {
    reset(); mutateOnRead = () => { admin.isActive = false }
    const result = await post(action('period_end_cancel'))
    assert.equal(result.status, 403); assert.equal(writes, 0)
  })
  await check('actual HTTP User ref drift before admission blocks write', async () => {
    reset(); mutateOnRead = () => { current.stripePriceId = 'price_other' }
    const result = await post(action('period_end_cancel'))
    assert.equal(result.status, 409); assert.equal(result.body.code, 'ADMIN_SUBSCRIPTION_REFERENCE_CHANGED'); assert.equal(writes, 0)
  })
  await check('actual HTTP User ref drift during exact provider retrieve blocks the final write', async () => {
    reset(); mutateAtRead = 2; mutateOnRead = () => { current.stripeCustomerId = 'cus_changed' }
    const result = await post(action('period_end_cancel'))
    assert.equal(result.status, 200); assert.equal(result.body.reason, 'EXTERNAL_UNKNOWN'); assert.equal(writes, 0)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-account-fence:v2:')), true)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-admin-subscription-settlement:v1:')), false)
  })
  await check('actual HTTP current session expiry during provider retrieve blocks write', async () => {
    reset(); mutateAtRead = 2; mutateOnRead = () => { session.active = false }
    const result = await post(action('period_end_cancel'))
    assert.equal(result.status, 403); assert.equal(writes, 0)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-account-fence:v2:')), true)
  })
  await check('actual HTTP ref change after SDK write retains confirmed fence and cannot settle', async () => {
    reset(); mutateAfterWrite = () => { current.stripePriceId = 'price_changed' }
    const request = action('period_end_cancel'), result = await post(request)
    assert.equal(result.status, 200); assert.equal(result.body.phase, 'executing')
    assert.equal(result.body.actionPhase, 'confirmed'); assert.equal(writes, 1)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-account-fence:v2:')), true)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-admin-subscription-settlement:v1:')), false)
    await post(request)
    assert.equal(writes, 1)
  })
  await check('actual HTTP wrong provider ack preserves fence and never resends', async () => {
    reset(); wrongAck = true
    const request = action('period_end_cancel'), first = await post(request)
    assert.equal(first.status, 200); assert.equal(first.body.reason, 'EXTERNAL_UNKNOWN'); assert.equal(writes, 1)
    assert.equal([...rows.keys()].some(key => key.startsWith('doya-account-fence:v2:')), true)
    assert.equal((await post(request)).body.phase, 'executing'); assert.equal(writes, 1)
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual HTTP/coordinator/store/SDK adapter with synthetic transactional rows only' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
