// R2-C3a actual store/coordinator/authority/projection on an owned Unix socket.
// The provider is synthetic. Never connects to Stripe or a configured application database.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const crypto = require('node:crypto')
const repo = path.resolve(__dirname, '../..')
module.paths.unshift(path.join(repo, 'node_modules'))
const { PrismaClient, Prisma } = require('@prisma/client')
const { load } = require('./load-typescript.cjs')
const folder = process.env.DOYA_ADMIN_SUBSCRIPTION_PG_ROOT
const socket = process.env.DOYA_ADMIN_SUBSCRIPTION_PG_SOCKET
const port = Number(process.env.DOYA_ADMIN_SUBSCRIPTION_PG_PORT)
assert(!process.env.DOYA_TEST_BASELINE)
assert.match(folder || '', /^\/tmp\/doya-admin-subscription-[a-f0-9]{8}$/)
assert.equal(socket, folder + '/socket')
assert(port > 1024 && port < 65536)
assert.equal(fs.realpathSync(repo), fs.realpathSync(process.cwd()))
const db = new PrismaClient({ datasources: { db: { url:
  `postgresql://doya_admin_subscription@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=admin_subscription_fixture` } } })
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const plans = load('src/lib/account-lifecycle/admin-subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const facts = load('src/lib/account-lifecycle/admin-subscription-fact.ts', { './state': state, './admin-subscription-plan': plans })
const grants = load('src/lib/billing-manual-grants.ts', { '@/lib/prisma': { prisma: db } })
const stripeModule = load('src/lib/stripe.ts', { stripe: class Stripe { }, 'node:crypto': crypto,
  './checkout-legacy-guard': { rejectLegacyCheckout: () => { throw Error('unexpected legacy checkout') } } })
const billing = load('src/lib/billing-sync.ts', { '@/lib/prisma': { prisma: db, withRetry: fn => fn() },
  '@prisma/client': { Prisma }, '@/lib/stripe': { ALL_SERVICE_IDS: stripeModule.ALL_SERVICE_IDS },
  '@/lib/billing-manual-grants': grants })
const adminAuth = load('src/lib/admin-auth.ts', { bcryptjs: require('bcryptjs'),
  jsonwebtoken: require('jsonwebtoken'), './prisma': { prisma: db }, '@prisma/client': { Prisma } })
const store = load('src/lib/account-lifecycle/store.ts', {
  'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state,
  './admin-subscription-plan': plans, './admin-subscription-fact': facts,
  '@/lib/admin-auth': adminAuth, '@/lib/billing-sync': billing,
})
const coordinator = load('src/lib/account-lifecycle/admin-subscription.ts', {
  'server-only': {}, './state': state, './admin-subscription-plan': plans, './store': store,
})
const selfPlans = load('src/lib/account-lifecycle/subscription-plan.ts', { 'node:crypto': crypto, './state': state })
const selfFacts = load('src/lib/account-lifecycle/subscription-provider.ts', { './state': state })
const selfSettlement = load('src/lib/account-lifecycle/self-subscription-settlement.ts', { './state': state })
const selfCoordinator = load('src/lib/account-lifecycle/subscription.ts', {
  'server-only': {}, 'node:crypto': crypto, './state': state,
  './subscription-plan': selfPlans, './subscription-provider': selfFacts, './store': store,
})
const userId = 'user1', adminId = 'admin1', target = { id: 'sub_one', customerId: 'cus_one',
  status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const action = (operationId, intent, verb = 'start') => ({ action: verb, operationId,
  expectedAdminId: adminId, targetUserId: userId, intent })
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const models = ['User', 'AdminUser', 'AdminSession', 'UserServiceSubscription', 'HrOrganization',
  'HrOrganizationMember', 'SystemSetting', 'StripeWebhookNotification']
async function setup() {
  const info = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder")
  assert.equal(info[0].address, null); assert.equal(info[0].role, 'doya_admin_subscription')
  assert.equal(info[0].folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA admin_subscription_fixture')
  for (const name of models) {
    const model = Prisma.dmmf.datamodel.models.find(item => item.name === name)
    assert(model, name)
    const cols = model.fields.filter(field => field.kind !== 'object').map(field => {
      let type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)',
        Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      if (field.isList) type += '[]'
      let def = ''
      if (field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now')) def = ' DEFAULT CURRENT_TIMESTAMP'
      else if (field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default))
        def = ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default))
      return quote(field.dbName || field.name) + ' ' + type + (field.isRequired ? ' NOT NULL' : '') + def +
        (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) cols.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + cols.join(',') + ')')
  }
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE ' + models.map(name => quote(Prisma.dmmf.datamodel.models.find(m => m.name === name).dbName || name)).join(',') + ' CASCADE')
  await db.user.create({ data: { id: userId, email: 'user@example.invalid', plan: 'PRO',
    stripeCustomerId: 'cus_one', stripeSubscriptionId: 'sub_one', stripePriceId: 'price_one' } })
  await db.user.create({ data: { id: 'user2', email: 'other@example.invalid', plan: 'PRO',
    stripeCustomerId: 'cus_two', stripeSubscriptionId: 'sub_two', stripePriceId: 'price_two' } })
  await db.adminUser.create({ data: { id: adminId, username: 'synthetic_admin', passwordHash: 'synthetic_hash' } })
  const token = adminAuth.generateToken(adminId, 'synthetic_admin')
  await db.adminSession.create({ data: { adminUserId: adminId, token, expiresAt: new Date(Date.now() + 3600_000) } })
  return { adminId, sessionToken: token }
}
const cases = []
async function check(name, fn) { const ctx = await reset(); await fn(ctx); cases.push(name); console.log('PASS ' + name) }
function provider(options = {}) {
  const calls = { writes: 0, reads: 0, discovery: 0, settlement: 0 }
  return { calls, implementation: {
    discover: async () => { calls.discovery++; return { ...target } },
    mutate: async (plan, _user, beforeWrite) => {
      await beforeWrite(); calls.writes++
      if (options.lost) throw Error('synthetic lost provider ack')
      return facts.verifyAdminSubscriptionFact(plan, { proof: plan.intent === 'immediate_cancel' ? 'irreversible_terminal' : 'write_ack',
        status: plan.intent === 'immediate_cancel' ? 'canceled' : 'active',
        cancelAtPeriodEnd: plan.intent === 'period_end_cancel', currentPeriodEnd: target.currentPeriodEnd })
    },
    reconcileImmediate: async plan => { calls.reads++; return facts.verifyAdminSubscriptionFact(plan, {
      proof: 'irreversible_terminal', status: 'canceled', cancelAtPeriodEnd: false,
      currentPeriodEnd: target.currentPeriodEnd }) },
    settlement: async () => { calls.settlement++; return { userId, plan: 'FREE',
      stripeSubscriptionId: null, stripePriceId: null, stripeCurrentPeriodEnd: null } },
  } }
}
const count = key => db.systemSetting.count({ where: { key: { startsWith: key } } })
const snapshot = () => db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } })
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const adminPlan = operationId => plans.makeAdminSubscriptionPlan({ identity: { operator: { kind: 'admin', id: adminId },
  targetUserId: userId, operationId, kind: 'cancel' }, intent: 'period_end_cancel', mode: 'test',
  email: 'user@example.invalid', expectedCustomerId: 'cus_one', expectedSubscriptionId: 'sub_one',
  expectedPriceId: 'price_one', target })
const selfPlan = operationId => selfPlans.makeSubscriptionPlan({ identity: { operator: { kind: 'user', id: 'user2' },
  targetUserId: 'user2', operationId, kind: 'cancel' }, mode: 'test', email: 'other@example.invalid',
  expectedCustomerId: 'cus_two', expectedSubscriptionId: 'sub_two', serviceId: 'banner', cancelMode: 'immediate',
  targets: [{ id: 'sub_two', customerId: 'cus_two', status: 'active', cancelAtPeriodEnd: false,
    currentPeriodEnd: 1900000000 }] })
;(async () => { try {
  await setup()
  await check('actual current admin authority and exact period-end action', async ctx => {
    const p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test'), id = crypto.randomUUID()
    const done = await c.handle(ctx, action(id, 'period_end_cancel'))
    assert.equal(done.phase, 'completed'); assert.equal(done.actorId, adminId)
    assert.equal(p.calls.writes, 1); assert.equal(await count('doya-account-fence:v2:'), 0)
    assert.equal((await db.user.findUnique({ where: { id: userId } })).plan, 'PRO')
    assert.equal((await c.handle(ctx, action(id, 'period_end_cancel', 'start'))).phase, 'completed')
    assert.equal(p.calls.writes, 1)
  })
  await check('current admin revocation blocks dispatch with zero provider write', async ctx => {
    const p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test'), id = crypto.randomUUID()
    const admissionPlan = plans.makeAdminSubscriptionPlan({ identity: { operator: { kind: 'admin', id: adminId },
      targetUserId: userId, operationId: id, kind: 'cancel' }, intent: 'period_end_cancel', mode: 'test',
      email: 'user@example.invalid', expectedCustomerId: 'cus_one', expectedSubscriptionId: 'sub_one',
      expectedPriceId: 'price_one', target })
    await store.admitAdminSubscriptionLifecycle(db, admissionPlan, ctx.sessionToken)
    await db.adminUser.update({ where: { id: adminId }, data: { isActive: false } })
    await assert.rejects(c.handle(ctx, action(id, 'period_end_cancel', 'continue')), { code: 'ADMIN_AUTHORITY_CHANGED' })
    assert.equal(p.calls.writes, 0); assert.equal(await count('doya-account-fence:v2:'), 1)
  })
  await check('immediate fact is durable; projection/receipt/service/HR are one final transaction', async ctx => {
    const org = await db.hrOrganization.create({ data: { id: 'org1', name: 'Synthetic', slug: 'synthetic-org', plan: 'PRO' } })
    await db.hrOrganizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' } })
    await db.userServiceSubscription.create({ data: { userId, serviceId: 'banner', plan: 'PRO', stripeSubscriptionId: 'sub_one' } })
    const p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test'), id = crypto.randomUUID()
    const done = await c.handle(ctx, action(id, 'immediate_cancel'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls.writes, 1)
    assert.equal((await db.user.findUnique({ where: { id: userId } })).plan, 'FREE')
    assert.equal((await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } } })).plan, 'FREE')
    assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'FREE')
    assert.equal(await count('doya-account-fence:v2:'), 0)
    assert.ok(await db.systemSetting.findUnique({ where: { key: plans.adminSubscriptionSettlementKey(id) } }))
  })
  await check('unknown immediate result does not resend; exact read recovers same ID', async ctx => {
    const p = provider({ lost: true }), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test'), id = crypto.randomUUID()
    const pending = await c.handle(ctx, action(id, 'immediate_cancel'))
    assert.equal(pending.reason, 'EXTERNAL_UNKNOWN'); assert.equal(p.calls.writes, 1)
    const done = await c.handle(ctx, action(id, 'immediate_cancel', 'reconcile'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls.writes, 1); assert.equal(p.calls.reads, 1)
  })
  for (const failure of [
    { name: 'User', table: 'User', event: 'UPDATE', condition: "NEW.id = 'user1'" },
    { name: 'existing service', table: 'UserServiceSubscription', event: 'UPDATE', condition: "NEW.\"userId\" = 'user1'" },
    { name: 'last new service', table: 'UserServiceSubscription', event: 'INSERT', condition: "NEW.\"userId\" = 'user1' AND NEW.\"serviceId\" = 'expense'" },
    { name: 'current HR owner', table: 'HrOrganization', event: 'UPDATE', condition: "NEW.id = 'org1'" },
    { name: 'completed receipt', table: 'SystemSetting', event: 'UPDATE', condition: "NEW.key LIKE 'doya-account-operation:v2:%' AND NEW.value::jsonb ->> 'phase' = 'completed'" },
  ]) {
    await check('projection rollback at ' + failure.name + ' retains confirmed fact and same-ID recovery', async ctx => {
      const org = await db.hrOrganization.create({ data: { id: 'org1', name: 'Synthetic', slug: 'synthetic-org', plan: 'PRO' } })
      await db.hrOrganizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' } })
      await db.userServiceSubscription.create({ data: { userId, serviceId: 'banner', plan: 'PRO', stripeSubscriptionId: 'sub_one', dailyUsage: 7, monthlyUsage: 11 } })
      const p = provider(); let beforeFinal
      const c = coordinator.adminSubscriptionCoordinator(db, {
        ...p.implementation,
        settlement: async (...args) => {
          const input = await p.implementation.settlement(...args)
          beforeFinal = await snapshot()
          return input
        },
      }, 'test'), id = crypto.randomUUID()
      await db.$executeRawUnsafe(`CREATE FUNCTION deny_admin_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${failure.condition} THEN RAISE EXCEPTION 'synthetic projection rollback'; END IF; RETURN NEW; END $$`)
      await db.$executeRawUnsafe(`CREATE TRIGGER deny_admin_projection BEFORE ${failure.event} ON ${quote(failure.table)} FOR EACH ROW EXECUTE FUNCTION deny_admin_projection()`)
      try {
        const pending = await c.handle(ctx, action(id, 'immediate_cancel'))
        assert.equal(pending.phase, 'executing'); assert.equal(pending.actionPhase, 'confirmed')
        assert.equal(p.calls.writes, 1)
        assert.equal((await db.user.findUnique({ where: { id: userId } })).plan, 'PRO')
        const service = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } } })
        assert.equal(service.plan, 'PRO'); assert.equal(service.dailyUsage, 7); assert.equal(service.monthlyUsage, 11)
        assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'PRO')
        assert.equal(await count('doya-account-fence:v2:'), 1)
        assert.equal(await count('doya-admin-subscription-fact:v1:'), 1)
        assert.equal(await count('doya-admin-subscription-settlement:v1:'), 0)
        assert.equal(await db.userServiceSubscription.count({ where: { userId } }), 1)
        assert(beforeFinal, 'provider fact was confirmed before the injected final transaction')
        assert.deepEqual(await snapshot(), beforeFinal, 'receipt, fence, fact and coverage were not partially changed')
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER deny_admin_projection ON ${quote(failure.table)}`)
        await db.$executeRawUnsafe('DROP FUNCTION deny_admin_projection()')
      }
      const done = await c.handle(ctx, action(id, 'immediate_cancel', 'reconcile'))
      assert.equal(done.phase, 'completed'); assert.equal(p.calls.writes, 1)
      assert.equal((await db.user.findUnique({ where: { id: userId } })).plan, 'FREE')
      assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'FREE')
      assert.equal((await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } } })).dailyUsage, 7)
      assert.equal(await count('doya-admin-subscription-settlement:v1:'), 1)
      assert.equal(await count('doya-account-fence:v2:'), 0)
    })
  }
  await check('manual grant and service usage survive an immediate terminal projection', async ctx => {
    const org = await db.hrOrganization.create({ data: { id: 'org1', name: 'Synthetic', slug: 'synthetic-org', plan: 'PRO' } })
    await db.hrOrganizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' } })
    await db.userServiceSubscription.create({ data: { userId, serviceId: 'banner', plan: 'PRO', stripeSubscriptionId: 'sub_one',
      dailyUsage: 7, monthlyUsage: 11 } })
    await db.systemSetting.create({ data: { key: grants.MANUAL_GRANTS_SETTING_KEY, value: 'user@example.invalid' } })
    const p = provider(), c = coordinator.adminSubscriptionCoordinator(db, p.implementation, 'test'), id = crypto.randomUUID()
    const done = await c.handle(ctx, action(id, 'immediate_cancel'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls.writes, 1)
    const user = await db.user.findUnique({ where: { id: userId } })
    assert.equal(user.plan, 'PRO'); assert.equal(user.stripeSubscriptionId, null); assert.equal(user.stripeCustomerId, 'cus_one')
    const service = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } } })
    assert.equal(service.plan, 'PRO'); assert.equal(service.dailyUsage, 7); assert.equal(service.monthlyUsage, 11)
    assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'PRO')
    assert.equal(await count('doya-admin-subscription-settlement:v1:'), 1)
    assert.equal(await count('doya-account-fence:v2:'), 0)
  })
  await check('new current HR ownership discovered after provider write joins final projection', async ctx => {
    const org = await db.hrOrganization.create({ data: { id: 'org1', name: 'Synthetic', slug: 'synthetic-org', plan: 'PRO' } })
    const p = provider(), c = coordinator.adminSubscriptionCoordinator(db, {
      ...p.implementation,
      settlement: async (...args) => {
        await db.hrOrganizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' } })
        return p.implementation.settlement(...args)
      },
    }, 'test')
    const done = await c.handle(ctx, action(crypto.randomUUID(), 'immediate_cancel'))
    assert.equal(done.phase, 'completed'); assert.equal(p.calls.writes, 1)
    assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'FREE')
  })
  await check('self-service immediate cancel shares the final User/service/HR projection transaction', async () => {
    const org = await db.hrOrganization.create({ data: { id: 'org1', name: 'Synthetic', slug: 'synthetic-org', plan: 'PRO' } })
    await db.hrOrganizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' } })
    await db.userServiceSubscription.create({ data: { userId, serviceId: 'banner', plan: 'PRO', stripeSubscriptionId: 'sub_one' } })
    const actor = { id: userId, email: 'user@example.invalid', stripeCustomerId: 'cus_one',
      stripeSubscriptionId: 'sub_one', savedSubscriptionId: 'sub_one' }
    const calls = { writes: 0, settlement: 0 }
    const provider = {
      discover: async () => [target],
      readExact: async id => ({ id, customer: 'cus_one', livemode: false, status: 'canceled',
        cancel_at_period_end: false, current_period_end: target.currentPeriodEnd }),
      mutate: async (plan, item, key, _actor, beforeWrite) => {
        await beforeWrite(); calls.writes++
        return selfFacts.verifySubscriptionFact(plan, item, key, { id: item.id,
          customerId: item.customerId, livemode: false, status: 'canceled',
          cancelAtPeriodEnd: false, currentPeriodEnd: item.currentPeriodEnd })
      },
      settlement: async () => { calls.settlement++; return { userId, plan: 'FREE',
        stripeSubscriptionId: null, stripePriceId: null, stripeCurrentPeriodEnd: null } },
    }
    const c = selfCoordinator.subscriptionCoordinator(db, provider, 'test'), id = crypto.randomUUID()
    const done = await c.handle('cancel', actor, { action: 'start', operationId: id,
      expectedActorId: userId, serviceId: 'banner', mode: 'immediate' })
    assert.equal(done.phase, 'completed'); assert.equal(calls.writes, 1); assert.equal(calls.settlement, 1)
    assert.equal((await db.user.findUnique({ where: { id: userId } })).plan, 'FREE')
    assert.equal((await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } } })).plan, 'FREE')
    assert.equal((await db.hrOrganization.findUnique({ where: { id: org.id } })).plan, 'FREE')
    assert.equal(await count('doya-account-fence:v2:'), 0)
    assert.equal(await count('doya-subscription-settlement-required:v1:'), 1)
    assert.equal(await count('doya-subscription-settlement-applied:v1:'), 1)
  })
  for (const shape of ['complete-plan', 'malformed-plan', 'complete-fact', 'malformed-fact', 'complete-settlement', 'malformed-settlement']) {
    await check('admin orphan ' + shape + ' refuses actual generic, C1, admin creators without mutation', async ctx => {
      const id = crypto.randomUUID(), plan = adminPlan(id)
      const key = shape.includes('plan') ? plans.adminSubscriptionPlanKey(id) :
        shape.includes('fact') ? plans.adminSubscriptionFactKey(id) : plans.adminSubscriptionSettlementKey(id)
      const value = shape === 'complete-plan' ? JSON.stringify(plan) :
        shape === 'complete-fact' ? JSON.stringify(facts.verifyAdminSubscriptionFact(plan, {
          proof: 'write_ack', status: 'active', cancelAtPeriodEnd: true,
          currentPeriodEnd: target.currentPeriodEnd })) :
        shape === 'complete-settlement' ? JSON.stringify({ version: 1, source: 'admin', settlementPolicyVersion: 1,
          operationId: id, targetHash: plan.targetHash, planDigest: plan.inputDigest,
          projected: false, userPlan: null, appliedAt: new Date().toISOString() }) : '{malformed'
      await db.systemSetting.create({ data: { key, value } })
      const before = await snapshot()
      const generic = { operator: { kind: 'admin', id: adminId }, targetUserId: 'user2', operationId: id, kind: 'retirement' }
      const digest = 'a'.repeat(64)
      for (const creator of [
        () => store.reserveLifecycleOperation(db, generic, digest),
        () => store.abortUnstartedLifecycleOperation(db, generic, digest),
        () => store.admitSubscriptionLifecycle(db, selfPlan(id)),
        () => store.admitAdminSubscriptionLifecycle(db, plan, ctx.sessionToken),
        () => store.abortAdminSubscriptionLifecycle(db, plan.identity, ctx.sessionToken),
      ]) {
        await assert.rejects(creator, error => error.code === 'LIFECYCLE_IDENTITY_CONFLICT')
        assert.deepEqual(await snapshot(), before)
      }
      await assert.rejects(() => store.readAdminSubscriptionServerState(db, plan.identity, ctx.sessionToken), { code: 'LIFECYCLE_STATE_UNAVAILABLE' })
      await assert.rejects(() => store.readSubscriptionServerState(db, selfPlan(id).identity), { code: 'LIFECYCLE_STATE_UNAVAILABLE' })
      assert.deepEqual(await snapshot(), before)
    })
  }
  for (const shape of ['complete-requirement', 'malformed-requirement', 'complete-coverage', 'malformed-coverage']) {
    await check('self settlement orphan ' + shape + ' refuses creators/status/abort without mutation', async ctx => {
      const id = crypto.randomUUID(), plan = selfPlan(id)
      const key = shape.includes('requirement') ? selfSettlement.selfSettlementRequirementKey(id) :
        selfSettlement.selfSettlementCoverageKey(id)
      const value = shape === 'complete-requirement' ? JSON.stringify(selfSettlement.makeSelfSettlementRequirement(plan)) :
        shape === 'complete-coverage' ? JSON.stringify({ version: 1, source: 'self_service', policyVersion: 1,
          operationId: id, targetHash: plan.targetHash, planDigest: plan.inputDigest,
          userPlan: 'FREE', appliedAt: new Date().toISOString() }) : '{malformed'
      await db.systemSetting.create({ data: { key, value } })
      const before = await snapshot()
      const generic = { operator: { kind: 'admin', id: adminId }, targetUserId: userId, operationId: id, kind: 'retirement' }
      for (const creator of [
        () => store.reserveLifecycleOperation(db, generic, 'a'.repeat(64)),
        () => store.abortUnstartedLifecycleOperation(db, generic, 'a'.repeat(64)),
        () => store.admitSubscriptionLifecycle(db, plan),
        () => store.admitAdminSubscriptionLifecycle(db, adminPlan(id), ctx.sessionToken),
        () => store.abortAdminSubscriptionLifecycle(db, adminPlan(id).identity, ctx.sessionToken),
      ]) {
        await assert.rejects(creator, error => error.code === 'LIFECYCLE_IDENTITY_CONFLICT')
        assert.deepEqual(await snapshot(), before)
      }
      await assert.rejects(() => store.readSubscriptionServerState(db, plan.identity), { code: 'LIFECYCLE_STATE_UNAVAILABLE' })
      await assert.rejects(() => store.readSubscriptionLifecycle(db, plan.identity), { code: 'LIFECYCLE_STATE_UNAVAILABLE' })
      await assert.rejects(() => store.readAdminSubscriptionServerState(db, adminPlan(id).identity, ctx.sessionToken), { code: 'LIFECYCLE_STATE_UNAVAILABLE' })
      assert.deepEqual(await snapshot(), before)
    })
  }
  await check('admin and C1 actual creators wait on one global UUID and admit only one authority', async ctx => {
    const id = crypto.randomUUID(), held = defer(), release = defer()
    const blocker = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${id})::bigint)`
      held.resolve(); await release.promise
    }, { timeout: 10000 })
    await held.promise
    const pending = Promise.allSettled([
      store.admitAdminSubscriptionLifecycle(db, adminPlan(id), ctx.sessionToken),
      store.admitSubscriptionLifecycle(db, selfPlan(id)),
    ])
    let waiting = 0
    try {
      for (let n = 0; n < 200; n++) {
        const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.usename='doya_admin_subscription' AND a.query LIKE '%pg_advisory_xact_lock%'")
        waiting = rows[0].count
        if (waiting >= 2) break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.equal(waiting, 2, 'both actual creators reached the same advisory lock')
    } finally { release.resolve(); await blocker }
    const outcome = await pending
    assert.equal(outcome.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(outcome.find(result => result.status === 'rejected').reason.code, 'LIFECYCLE_IDENTITY_CONFLICT')
    assert.equal(await count(`doya-account-operation:v2:${id}`), 1)
    const admin = await db.systemSetting.findUnique({ where: { key: plans.adminSubscriptionPlanKey(id) } })
    const self = await db.systemSetting.findUnique({ where: { key: selfPlans.subscriptionPlanKey(id) } })
    assert.equal(Number(Boolean(admin)) + Number(Boolean(self)), 1)
  })
  await check('same target different admin UUIDs wait on User lock and leave one coherent fence', async ctx => {
    const first = crypto.randomUUID(), second = crypto.randomUUID(), held = defer(), release = defer()
    const blocker = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      held.resolve(); await release.promise
    }, { timeout: 10000 })
    await held.promise
    const pending = Promise.allSettled([
      store.admitAdminSubscriptionLifecycle(db, adminPlan(first), ctx.sessionToken),
      store.admitAdminSubscriptionLifecycle(db, adminPlan(second), ctx.sessionToken),
    ])
    let waiting = 0
    try {
      for (let n = 0; n < 200; n++) {
        const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE usename='doya_admin_subscription' AND wait_event_type='Lock' AND query LIKE '%FROM \"User\"%FOR UPDATE%'")
        waiting = rows[0].count
        if (waiting >= 2) break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.equal(waiting, 2, 'both actual admissions reached the target User lock')
    } finally { release.resolve(); await blocker }
    const outcome = await pending
    assert.equal(outcome.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(outcome.find(result => result.status === 'rejected').reason.code, 'ACCOUNT_OPERATION_IN_PROGRESS')
    assert.equal(await count('doya-account-fence:v2:'), 1)
    assert.equal(await count('doya-admin-subscription-plan:v1:'), 1)
    assert.equal(await count('doya-account-operation:v2:'), 1)
    assert.equal(await count('doya-account-action:v2:'), 1)
  })
  await check('admin and retirement actual creators wait on one UUID with different Users', async ctx => {
    const id = crypto.randomUUID(), held = defer(), release = defer()
    const blocker = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${id})::bigint)`
      held.resolve(); await release.promise
    }, { timeout: 10000 })
    await held.promise
    const pending = Promise.allSettled([
      store.admitAdminSubscriptionLifecycle(db, adminPlan(id), ctx.sessionToken),
      store.reserveLifecycleOperation(db, { operator: { kind: 'admin', id: adminId },
        targetUserId: 'user2', operationId: id, kind: 'retirement' }, 'a'.repeat(64)),
    ])
    let waiting = 0
    try {
      for (let n = 0; n < 200; n++) {
        const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.usename='doya_admin_subscription' AND a.query LIKE '%pg_advisory_xact_lock%'")
        waiting = rows[0].count
        if (waiting >= 2) break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.equal(waiting, 2)
    } finally { release.resolve(); await blocker }
    const outcome = await pending
    assert.equal(outcome.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(outcome.find(result => result.status === 'rejected').reason.code, 'LIFECYCLE_IDENTITY_CONFLICT')
    assert.equal(await count(`doya-account-operation:v2:${id}`), 1)
    assert.equal(await count('doya-account-fence:v2:'), 1)
    assert.equal(await count('doya-admin-subscription-plan:v1:'), outcome[0].status === 'fulfilled' ? 1 : 0)
  })
  console.log(JSON.stringify({ passed: cases.length, scope: 'owned PostgreSQL, actual authority/store/projection, synthetic provider only', cases }))
} finally { await db.$disconnect() } })().catch(error => { console.error(error); process.exitCode = 1 })
