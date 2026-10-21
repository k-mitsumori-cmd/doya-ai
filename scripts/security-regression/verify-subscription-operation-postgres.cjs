// C1 actual store/coordinator on an owned Unix-socket database. Provider is synthetic.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const repo = path.resolve(__dirname, '../..')
module.paths.unshift(path.join(repo, 'node_modules'))
const { PrismaClient, Prisma } = require('@prisma/client')
const { load } = require('./load-typescript.cjs')
const folder = process.env.DOYA_SUBSCRIPTION_PG_ROOT
const socket = process.env.DOYA_SUBSCRIPTION_PG_SOCKET
const port = Number(process.env.DOYA_SUBSCRIPTION_PG_PORT)
assert(!process.env.DOYA_TEST_BASELINE)
assert.match(folder || '', /^\/tmp\/doya-subscription-[a-f0-9]{8}$/)
assert.equal(socket, folder + '/socket')
assert(port > 1024 && port < 65536)
assert.equal(fs.realpathSync(repo), fs.realpathSync(process.cwd()))
const db = new PrismaClient({ datasources: { db: { url:
  `postgresql://doya_subscription@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=subscription_fixture` } } })
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma },
  './state': state, './subscription-plan': plans, './subscription-provider': facts })
const coordinator = load('src/lib/account-lifecycle/subscription.ts', { 'server-only': {}, 'node:crypto': crypto,
  './state': state, './subscription-plan': plans, './subscription-provider': facts, './store': store })
const actor = { id: 'actor1', email: 'actor@example.invalid', stripeCustomerId: 'cus_one',
  stripeSubscriptionId: 'sub_one', savedSubscriptionId: 'sub_one' }
const target = id => ({ id, customerId: 'cus_one', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 })
const identity = (kind = 'cancel', operationId = crypto.randomUUID(), userId = actor.id) =>
  ({ operator: { kind: 'user', id: userId }, targetUserId: userId, operationId, kind })
const action = (kind, operationId = crypto.randomUUID()) => ({ action: 'start', operationId,
  expectedActorId: actor.id, serviceId: 'banner', ...(kind === 'cancel' ? { mode: 'period_end' } : {}) })
const snapshot = async () => db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } })
const quote = value => '"' + value.replaceAll('"', '""') + '"'
async function setup() {
  const info = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder")
  assert.equal(info[0].address, null)
  assert.equal(info[0].role, 'doya_subscription')
  assert.equal(info[0].folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA subscription_fixture')
  for (const name of ['User', 'UserServiceSubscription', 'SystemSetting', 'StripeWebhookNotification']) {
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === name)
    const columns = model.fields.filter(f => f.kind !== 'object').map(f => {
      let type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)',
        Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[f.type] || 'TEXT'
      if (f.isList) type += '[]'
      let def = ''
      if (f.type === 'DateTime' && (f.isUpdatedAt || f.default?.name === 'now')) def = ' DEFAULT CURRENT_TIMESTAMP'
      else if (f.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof f.default))
        def = ' DEFAULT ' + (typeof f.default === 'string' ? "'" + f.default.replaceAll("'", "''") + "'" : String(f.default))
      return quote(f.dbName || f.name) + ' ' + type + (f.isRequired ? ' NOT NULL' : '') + def + (f.isId ? ' PRIMARY KEY' : '') + (f.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + columns.join(',') + ')')
  }
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User","UserServiceSubscription","SystemSetting","StripeWebhookNotification" CASCADE')
  await db.user.create({ data: { id: actor.id, email: actor.email, plan: 'PRO',
    stripeCustomerId: actor.stripeCustomerId, stripeSubscriptionId: actor.stripeSubscriptionId } })
  await db.user.create({ data: { id: 'actor2', email: 'other@example.invalid', plan: 'PRO' } })
}
const cases = []
async function check(name, fn) { await reset(); await fn(); cases.push(name); console.log('PASS ' + name) }
function provider(options = {}) {
  const calls = { discover: 0, reads: 0, writes: [], before: 0 }
  const targets = options.targets || [target('sub_one')]
  return { calls, implementation: {
    discover: async () => { calls.discover++; return targets },
    readExact: async id => { calls.reads++; return { id, customer: 'cus_one', livemode: false,
      status: 'active', cancel_at_period_end: false, current_period_end: 1900000000 } },
    mutate: async (plan, item, key, _actor, beforeWrite) => {
      if (options.before) await options.before({ plan, item, key, calls })
      calls.before++; await beforeWrite()
      calls.writes.push(item.id)
      if (options.fail?.includes(item.id)) throw Error('synthetic lost response')
      return facts.verifySubscriptionFact(plan, item, key, { id: item.id, customerId: item.customerId,
        livemode: false, status: plan.cancelMode === 'immediate' ? 'canceled' : 'active',
        cancelAtPeriodEnd: plan.identity.kind === 'cancel', currentPeriodEnd: item.currentPeriodEnd })
    },
  } }
}
const client = fixture => coordinator.subscriptionCoordinator(db, fixture.implementation, 'test')
;(async () => { try {
  await setup()
  await check('single cancel authority, verified fact and terminal User reference commit', async () => {
    const p = provider(), start = action('cancel'), c = client(p)
    const done = await c.handle('cancel', actor, start)
    assert.equal(done.phase, 'completed'); assert.equal(done.actions[0].status, 'scheduled_cancel')
    assert.deepEqual(p.calls.writes, ['sub_one'])
    // Receipt, typed plan, ledger and verified fact remain; the active fence is removed.
    assert.equal(await db.systemSetting.count(), 4)
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeSubscriptionId, 'sub_one')
    assert.equal((await c.handle('cancel', actor, { action: 'status', operationId: start.operationId,
      expectedActorId: actor.id })).phase, 'completed')
    assert.deepEqual(p.calls.writes, ['sub_one'])
  })
  await check('single resume settles verified fact and terminal User reference without replay', async () => {
    const p = provider(), c = client(p), start = action('resume')
    const done = await c.handle('resume', actor, start)
    assert.equal(done.phase, 'completed'); assert.equal(done.actions[0].status, 'resumed')
    assert.deepEqual(p.calls.writes, ['sub_one'])
    assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-account-fence:v2:' } } }), 0)
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeSubscriptionId, 'sub_one')
    assert.equal((await c.handle('resume', actor, { action: 'status', operationId: start.operationId,
      expectedActorId: actor.id })).phase, 'completed')
    assert.deepEqual(p.calls.writes, ['sub_one'])
  })
  await check('two confirmed targets settle one User pointer and release one fence', async () => {
    const p = provider({ targets: [target('sub_two'), target('sub_one')] }), c = client(p)
    const start = action('cancel'), done = await c.handle('cancel', actor, start)
    assert.equal(done.phase, 'completed')
    assert.equal(done.actions.filter(item => item.phase === 'confirmed').length, 2)
    assert.deepEqual(p.calls.writes, ['sub_one', 'sub_two'])
    assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-subscription-fact:v1:' } } }), 2)
    assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-account-fence:v2:' } } }), 0)
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeSubscriptionId, 'sub_one')
  })
  await check('actual cancel POST resolves principal, uses actual coordinator/store/SDK adapter and private response', async () => {
    const writes = []
    const raw = { id: 'sub_one', customer: 'cus_one', livemode: false, status: 'active',
      cancel_at_period_end: false, current_period_end: 1900000000, metadata: { userId: actor.id } }
    const sdk = { subscriptions: {
      retrieve: async id => { assert.equal(id, 'sub_one'); return raw },
      update: async (id, body, options) => {
        writes.push({ id, body, options }); return { ...raw, cancel_at_period_end: true }
      },
    } }
    const adapter = load('src/lib/account-lifecycle/subscription-stripe-provider.ts', {
      'server-only': {}, './state': state, './subscription-provider': facts,
      '@/lib/stripe': { stripe: sdk, ACTIVE_LIKE_STATUSES: new Set(['active', 'trialing', 'past_due']),
        findActiveLikeSubscriptions: async () => [{ id: 'sub_one', customerId: 'cus_one', status: 'active', priceId: null, planId: 'banner-pro' }],
        isDoyaSubscriptionOwnedByUser: async (subscription, user) => subscription.metadata.userId === user.id },
    })
    const http = load('src/lib/account-lifecycle/subscription-http.ts', {
      'server-only': {}, './state': state, './subscription': coordinator,
      './subscription-stripe-provider': adapter,
      './checkout-stripe-provider': { stripeModeFromSecret: () => 'test' }, '@/lib/prisma': { prisma: db },
    })
    const route = load('src/app/api/stripe/subscription/cancel/route.ts', {
      'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: actor.id, email: actor.email } }) },
      '@/lib/auth': {}, '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/subscription-http': http,
    })
    const start = action('cancel')
    const response = await route.POST({ json: async () => start })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('vary'), 'Cookie')
    const body = await response.json()
    assert.equal(body.actorId, actor.id); assert.equal(body.operationId, start.operationId)
    assert.equal(body.phase, 'completed'); assert.equal(writes.length, 1)
    assert.equal(writes[0].id, 'sub_one'); assert.equal(writes[0].body.cancel_at_period_end, true)
    const observed = await route.POST({ json: async () => ({ action: 'status', operationId: start.operationId,
      expectedActorId: actor.id }) })
    assert.equal(observed.status, 200); assert.equal((await observed.json()).phase, 'completed')
    assert.equal(writes.length, 1)
  })
  await check('admission rolls back receipt fence plan ledger when plan insert fails', async () => {
    const start = action('cancel'), id = identity('cancel', start.operationId)
    const plan = plans.makeSubscriptionPlan({ identity: id, mode: 'test', email: actor.email,
      expectedCustomerId: actor.stripeCustomerId, expectedSubscriptionId: actor.stripeSubscriptionId,
      serviceId: 'banner', cancelMode: 'period_end', targets: [target('sub_one')] })
    await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION deny_subscription_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE \'doya-subscription-plan:v1:%\' THEN RAISE EXCEPTION \'synthetic plan failure\'; END IF; RETURN NEW; END $$')
    await db.$executeRawUnsafe('CREATE TRIGGER deny_subscription_plan BEFORE INSERT ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION deny_subscription_plan()')
    try { await assert.rejects(store.admitSubscriptionLifecycle(db, plan)); assert.equal((await snapshot()).length, 0) }
    finally { await db.$executeRawUnsafe('DROP TRIGGER deny_subscription_plan ON "SystemSetting"') }
  })
  await check('terminal receipt failure rolls back User update and same handle settles confirmed fact once', async () => {
    await db.$executeRawUnsafe("CREATE OR REPLACE FUNCTION deny_subscription_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE 'doya-account-operation:v2:%' AND NEW.value::jsonb ->> 'phase' = 'completed' THEN RAISE EXCEPTION 'synthetic completion failure'; END IF; RETURN NEW; END $$")
    await db.$executeRawUnsafe('CREATE TRIGGER deny_subscription_completion BEFORE UPDATE ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION deny_subscription_completion()')
    const p = provider(), c = client(p), start = { ...action('cancel'), mode: 'immediate' }
    try {
      const pending = await c.handle('cancel', actor, start)
      assert.equal(pending.phase, 'executing'); assert.equal(pending.actions[0].phase, 'confirmed')
      assert.deepEqual(p.calls.writes, ['sub_one'])
      assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeCustomerId, 'cus_one')
      assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeSubscriptionId, 'sub_one')
      assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-account-fence:v2:' } } }), 1)
    } finally { await db.$executeRawUnsafe('DROP TRIGGER deny_subscription_completion ON "SystemSetting"') }
    const settled = await c.handle('cancel', actor, { action: 'continue', operationId: start.operationId,
      expectedActorId: actor.id })
    assert.equal(settled.phase, 'completed'); assert.deepEqual(p.calls.writes, ['sub_one'])
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).stripeSubscriptionId, null)
    assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-account-fence:v2:' } } }), 0)
  })
  await check('reserved abort preserves typed plan/ledger join and rejects orphaned aborted state', async () => {
    const id = identity(), plan = plans.makeSubscriptionPlan({ identity: id, mode: 'test', email: actor.email,
      expectedCustomerId: actor.stripeCustomerId, expectedSubscriptionId: actor.stripeSubscriptionId,
      serviceId: 'banner', cancelMode: 'period_end', targets: [target('sub_one')] })
    await store.admitSubscriptionLifecycle(db, plan)
    const p = provider(), c = client(p)
    assert.equal((await c.handle('cancel', actor, { action: 'abort', operationId: id.operationId,
      expectedActorId: actor.id })).phase, 'aborted')
    const before = await snapshot()
    assert.equal((await c.handle('cancel', actor, { action: 'abort', operationId: id.operationId,
      expectedActorId: actor.id })).phase, 'aborted')
    assert.deepEqual(await snapshot(), before)
    assert.equal(p.calls.discover, 0); assert.equal(p.calls.reads, 0); assert.deepEqual(p.calls.writes, [])
    assert.equal((await store.readSubscriptionLifecycle(db, id)).phase, 'aborted')
    await db.systemSetting.delete({ where: { key: plans.subscriptionPlanKey(id.operationId) } })
    await assert.rejects(store.readSubscriptionLifecycle(db, id))
    await assert.rejects(store.readSubscriptionServerState(db, id))
  })
  await check('orphan plan blocks every generic receipt creator without mutation', async () => {
    const id = crypto.randomUUID(), key = plans.subscriptionPlanKey(id)
    await db.systemSetting.create({ data: { key, value: '{malformed' } }); const before = await snapshot()
    for (const kind of ['retirement', 'checkout', 'cancel', 'resume', 'change', 'portal']) {
      const i = { operator: kind === 'retirement' ? { kind: 'admin', id: 'admin1' } : { kind: 'user', id: actor.id },
        targetUserId: actor.id, operationId: id, kind }
      await assert.rejects(store.reserveLifecycleOperation(db, i, crypto.createHash('sha256').update('input').digest('hex')))
    }
    assert.deepEqual(await snapshot(), before)
  })
  for (const factShape of ['complete', 'malformed']) await check('fact-only UUID blocks status abort and generic reserve ' + factShape, async () => {
    const id = crypto.randomUUID(), key = `doya-subscription-fact:v1:${id}:orphan`
    const value = factShape === 'complete' ? JSON.stringify({ operationId: id, actionKey: 'a'.repeat(64),
      subscriptionId: 'sub_one', customerId: 'cus_one', mode: 'test', status: 'active',
      cancelAtPeriodEnd: true, currentPeriodEnd: 1900000000,
      outcome: { proof: 'ack', resourceId: 'sub_one', status: 'scheduled_cancel' } }) : '{malformed'
    await db.systemSetting.create({ data: { key, value } }); const before = await snapshot()
    const own = identity('cancel', id)
    await assert.rejects(store.readSubscriptionLifecycle(db, own))
    await assert.rejects(store.readSubscriptionServerState(db, own))
    await assert.rejects(store.abortUnstartedLifecycleOperation(db, own, crypto.createHash('sha256').update('abort').digest('hex')))
    for (const kind of ['retirement', 'checkout', 'cancel', 'resume', 'change', 'portal']) {
      const i = { operator: kind === 'retirement' ? { kind: 'admin', id: 'admin1' } : { kind: 'user', id: actor.id },
        targetUserId: actor.id, operationId: id, kind }
      await assert.rejects(store.reserveLifecycleOperation(db, i, crypto.createHash('sha256').update('input').digest('hex')))
    }
    assert.deepEqual(await snapshot(), before)
  })
  await check('two concurrent UUID claims against one User yield one fenced operation', async () => {
    const p = provider({ fail: ['sub_one'] }), c = client(p)
    const attempts = await Promise.allSettled([c.handle('cancel', actor, action('cancel')),
      c.handle('cancel', actor, action('cancel'))])
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1)
    assert.equal(p.calls.writes.length, 1)
    assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'doya-subscription-plan:v1:' } } }), 1)
  })
  await check('partial two target result stays unknown, fences new UUID, queues one alert without delivery', async () => {
    const p = provider({ targets: [target('sub_one'), target('sub_two')], fail: ['sub_two'] }), c = client(p)
    const start = action('cancel'); const partial = await c.handle('cancel', actor, start)
    assert.equal(partial.phase, 'executing'); assert.equal(partial.reason, 'EXTERNAL_UNKNOWN')
    assert.equal(partial.actions.filter(x => x.phase === 'confirmed').length, 1)
    assert.equal(partial.actions.filter(x => x.phase === 'dispatched').length, 1)
    assert.deepEqual(p.calls.writes, ['sub_one', 'sub_two'])
    const queued = await db.stripeWebhookNotification.findMany()
    assert.equal(queued.length, 1)
    assert.equal(queued[0].status, 'pending')
    assert.equal(queued[0].sentAt, null)
    await assert.rejects(c.handle('cancel', actor, action('cancel')))
    await assert.rejects(c.handle('cancel', actor, { action: 'continue', operationId: start.operationId,
      expectedActorId: actor.id }))
    await assert.rejects(store.reserveLifecycleOperation(db, { operator: { kind: 'admin', id: 'admin1' },
      targetUserId: actor.id, operationId: crypto.randomUUID(), kind: 'retirement' },
    crypto.createHash('sha256').update('retire-after-unknown').digest('hex')))
    assert.deepEqual(p.calls.writes, ['sub_one', 'sub_two'])
  })
  await check('lost reversible response remains unknown after read-only reconcile', async () => {
    const p = provider({ fail: ['sub_one'] }), c = client(p), start = action('resume')
    const uncertain = await c.handle('resume', actor, start)
    assert.equal(uncertain.reason, 'EXTERNAL_UNKNOWN')
    const writes = p.calls.writes.length
    const inspected = await c.handle('resume', actor, { action: 'reconcile', operationId: start.operationId,
      expectedActorId: actor.id })
    assert.equal(inspected.reason, 'EXTERNAL_UNKNOWN')
    assert.equal(p.calls.writes.length, writes)
  })
  await check('current User Customer reference changes before provider write, URL and write zero', async () => {
    const p = provider({ before: async () => { await db.user.update({ where: { id: actor.id },
      data: { stripeCustomerId: 'cus_changed' } }) } }), c = client(p)
    const outcome = await c.handle('cancel', actor, action('cancel'))
    assert.equal(outcome.reason, 'EXTERNAL_UNKNOWN')
    assert.equal(p.calls.writes.length, 0)
  })
  await check('retirement fence first rejects new subscription without provider writes', async () => {
    const retiring = { operator: { kind: 'admin', id: 'admin1' }, targetUserId: actor.id,
      operationId: crypto.randomUUID(), kind: 'retirement' }
    await store.reserveLifecycleOperation(db, retiring, crypto.createHash('sha256').update('retire').digest('hex'))
    const p = provider()
    await assert.rejects(client(p).handle('cancel', actor, action('cancel')))
    assert.equal(p.calls.writes.length, 0)
  })
  console.log(JSON.stringify({ passed: cases.length, scope: 'Actual User/SystemSetting/outbox on owned private PG; synthetic provider; no Stripe network', cases }))
} catch (error) { console.error(error); process.exitCode = 1 }
finally { await db.$disconnect() } })()
