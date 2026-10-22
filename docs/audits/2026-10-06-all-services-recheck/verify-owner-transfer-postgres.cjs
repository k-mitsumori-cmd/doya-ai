process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const { Prisma, PrismaClient } = require('@prisma/client')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const { retirementModels } = require('../../../scripts/security-regression/retirement-fixture.cjs')

const socket = process.env.DOYA_OWNER_T1_PG_SOCKET
const port = Number(process.env.DOYA_OWNER_T1_PG_PORT)
assert.match(socket || '', /^\/tmp\/doya-owner-t1-[a-f0-9]{8}\/socket$/)
assert(port > 1024 && port < 65536)
const db = new PrismaClient({ datasources: { db: { url: `postgresql://doya_owner@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=owner_transfer_fixture` } } })
const services = [
  ['shodan', 'ShodanOrganization', 'ShodanMember'],
  ['aio', 'AioOrganization', 'AioMember'],
  ['quote', 'QuoteOrganization', 'QuoteMember'],
  ['mensetsu', 'MensetsuOrganization', 'MensetsuMember'],
  ['aishodan', 'AishodanOrganization', 'AishodanMember'],
]
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const model = name => {
  const found = Prisma.dmmf.datamodel.models.find(row => row.name === name)
  assert(found, name)
  return found
}
async function createModel(name) {
  const m = model(name)
  const columns = m.fields.filter(field => field.kind !== 'object').map(field => {
    const type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION' })[field.type] || 'TEXT'
    const defaultValue = field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now') ? ' DEFAULT CURRENT_TIMESTAMP'
      : field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default) ? ' DEFAULT ' +
        (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default)) : ''
    return quote(field.dbName || field.name) + ' ' + type + (field.isList ? '[]' : '') + (field.isRequired ? ' NOT NULL' : '') +
      defaultValue + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
  })
  for (const fields of m.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
  await db.$executeRawUnsafe('CREATE TABLE ' + quote(m.dbName || name) + ' (' + columns.join(',') + ')')
}
async function setup() {
  const server = await db.$queryRawUnsafe('SELECT inet_server_addr() AS address, current_user AS role')
  assert.equal(server[0].address, null)
  assert.equal(server[0].role, 'doya_owner')
  await db.$executeRawUnsafe('CREATE SCHEMA owner_transfer_fixture')
  await db.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY, plan TEXT NOT NULL, "stripeCustomerId" TEXT, "stripeSubscriptionId" TEXT)')
  await createModel('SystemSetting')
  await createModel('UserServiceSubscription')
  for (const name of retirementModels) await createModel(name)
}
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const lifecycle = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const types = load('src/lib/owner-transfer/types.ts', { 'node:crypto': crypto, '@/lib/account-lifecycle/state': state })
const receipt = load('src/lib/owner-transfer/receipt.ts', { '@/lib/account-lifecycle/state': state, './types': types })
const store = load('src/lib/owner-transfer/store.ts', {
  '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db }, '@/lib/account-lifecycle/store': lifecycle,
  './types': types, './receipt': receipt,
})
const retirement = load('src/lib/account-retirement.ts', { '@prisma/client': { Prisma } })
const cases = []
// The first result can retain the host input object; persisted receipts are parsed in the TS loader's VM.
// Clone into this realm before comparing every DTO field across those two equivalent boundaries.
const dtoValue = value => structuredClone(value)
const setting = () => db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } })
const row = async (service, suffix = '') => {
  const spec = services.find(item => item[0] === service)
  const org = model(spec[1]), member = model(spec[2])
  const id = `org_${service}${suffix}`
  await db.$executeRawUnsafe(`INSERT INTO ${quote(org.dbName)} (id,name,slug) VALUES ($1,$2,$3)`, id, `Synthetic ${service}`, id)
  for (const [memberId, userId, role] of [[`old_${service}${suffix}`, 'old', 'owner'], [`new_${service}${suffix}`, 'new', 'member']]) {
    await db.$executeRawUnsafe(`INSERT INTO ${quote(member.dbName)} (id,"organizationId","userId",role,status) VALUES ($1,$2,$3,$4,'ACTIVE')`, memberId, id, userId, role)
  }
  return { id, oldId: `old_${service}${suffix}`, newId: `new_${service}${suffix}`, table: member.dbName }
}
const reset = async () => {
  const names = ['"User"', '"SystemSetting"', quote(model('UserServiceSubscription').dbName || 'UserServiceSubscription'), ...retirementModels.map(name => quote(model(name).dbName || name))]
  await db.$executeRawUnsafe('TRUNCATE ' + names.join(',') + ' CASCADE')
  await db.$executeRawUnsafe('INSERT INTO "User" (id,plan,"stripeCustomerId","stripeSubscriptionId") VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12),($13,$14,$15,$16),($17,$18,$19,$20)',
    'old', 'PRO', 'cus_old', 'sub_old', 'new', 'LIGHT', 'cus_new', 'sub_new', 'observer', 'BUSINESS', 'cus_observer', 'sub_observer',
    'otherOld', 'PRO', 'cus_other_old', 'sub_other_old', 'otherNew', 'LIGHT', 'cus_other_new', 'sub_other_new')
  for (const [service] of services) for (const [userId, monthlyUsage] of [['old', 7], ['new', 11], ['observer', 13]])
    await db.userServiceSubscription.create({ data: { id: `usage_${service}_${userId}`, userId, serviceId: service,
      plan: 'PRO', dailyUsage: 3, monthlyUsage } })
}
const identity = (service, orgId, operationId = crypto.randomUUID()) => ({ service, organizationId: orgId, actorUserId: 'old', operationId })
const input = item => ({ expectedOwnerMemberId: item.oldId, targetMemberId: item.newId, targetUserId: 'new', targetRole: 'member', targetPlan: 'LIGHT' })
const individualState = async () => ({
  users: await db.$queryRawUnsafe('SELECT id,plan,"stripeCustomerId","stripeSubscriptionId" FROM "User" ORDER BY id'),
  subscriptions: await db.userServiceSubscription.findMany({ orderBy: { id: 'asc' } }),
})
const retire = userId => lifecycle.reserveLifecycleOperation(db, {
  operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId,
  operationId: crypto.randomUUID(), kind: 'retirement',
}, crypto.createHash('sha256').update('synthetic owner-transfer retirement').digest('hex'))
async function roles(item) {
  const rows = await db.$queryRawUnsafe(`SELECT id,role FROM ${quote(item.table)} WHERE "organizationId"=$1 ORDER BY id`, item.id)
  return Object.fromEntries(rows.map(row => [row.id, row.role]))
}
async function test(name, run) { await reset(); await run(); cases.push(name); console.log('PASS', name) }
async function expectCode(promise, code) {
  await assert.rejects(promise, error => error?.code === code)
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const settle = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }))
const waits = []
const operationWaits = []
const collisionWaits = []
async function waitUserLock(holderPid, name) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type=$1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes('"User"'))
    if (blocked) { waits.push({ name, holderPid, waiterPid: blocked.pid }); return }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual User row lock wait: ' + name)
}
async function waitOperationLock(holderPid, name) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type=$1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes('pg_advisory_xact_lock'))
    if (blocked) { operationWaits.push({ name, holderPid, waiterPid: blocked.pid }); return blocked.pid }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual operation advisory lock wait: ' + name)
}
async function waitCollisionLock(holderPid) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type=$1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes('pg_advisory_xact_lock(117'))
    if (blocked) { collisionWaits.push({ holderPid, waiterPid: blocked.pid }); return }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual forced equal-value advisory lock wait')
}
const started = (entered, holder) => Promise.race([entered.promise, holder.then(result => { throw result.error || Error('Holder ended before User lock wait') })])
async function run() {
  await setup()
  for (const [service] of services) {
    await test(`${service}: atomic transfer and historical replay`, async () => {
      const item = await row(service), id = identity(service, item.id), before = await setting(), individualBefore = await individualState()
      await expectCode(store.ownerTransferCandidates(service, item.id, 'new'), 'OWNER_TRANSFER_OWNER_REQUIRED')
      await expectCode(store.ownerTransferCandidates(service, item.id, 'old', 'other_org'), 'OWNER_TRANSFER_ORG_UNAVAILABLE')
      const list = await store.ownerTransferCandidates(service, item.id, 'old')
      assert.equal(list.candidates.length, 1)
      assert.equal(list.candidates[0].plan, 'LIGHT')
      await assert.rejects(retirement.checkAccountRetirementSafe(db, 'old'), error => error.reason === 'ownership')
      const result = await store.transferOwner(id, input(item), item.id, db)
      assert.equal(result.phase, 'committed')
      assert.deepEqual(await roles(item), { [item.newId]: 'owner', [item.oldId]: 'admin' })
      assert.equal((await setting()).length, before.length + 1)
      assert.deepEqual(dtoValue(await store.transferOwner(id, input(item), item.id, db)), dtoValue(result))
      assert.deepEqual(dtoValue(await store.ownerTransferStatus(id)), dtoValue(result))
      assert.deepEqual(await individualState(), individualBefore, 'personal plans, Stripe references, service usage and unrelated User must not change')
      await retirement.checkAccountRetirementSafe(db, 'old')
    })
  }
  for (const [service] of services) await test(`${service}: sole owner retirement preflight remains available`, async () => {
    const item = await row(service)
    await db.$executeRawUnsafe(`DELETE FROM ${quote(item.table)} WHERE id=$1`, item.newId)
    const before = await setting(), individualBefore = await individualState()
    await retirement.checkAccountRetirementSafe(db, 'old')
    assert.deepEqual(await roles(item), { [item.oldId]: 'owner' })
    assert.deepEqual(await setting(), before)
    assert.deepEqual(await individualState(), individualBefore)
  })
  await test('cancel before transfer and replay after downgrade', async () => {
    const item = await row('shodan'), id = identity('shodan', item.id)
    assert.equal((await store.cancelOwnerTransfer(id, db)).phase, 'canceled')
    assert.equal((await store.transferOwner(id, input(item), item.id, db)).phase, 'canceled')
    assert.equal((await store.ownerTransferStatus(id)).phase, 'canceled')
    assert.deepEqual(await roles(item), { [item.newId]: 'member', [item.oldId]: 'owner' })
    const newId = identity('shodan', item.id)
    assert.equal((await store.transferOwner(newId, input(item), item.id, db)).phase, 'committed')
    assert.equal((await store.cancelOwnerTransfer(newId, db)).phase, 'committed')
  })
  await test('plan drift, malformed receipt and rollback', async () => {
    const item = await row('quote'), id = identity('quote', item.id)
    const old = await setting()
    await db.$executeRawUnsafe('UPDATE "User" SET plan=$1 WHERE id=$2', 'PRO', 'new')
    await expectCode(store.transferOwner(id, input(item), item.id, db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.deepEqual(await roles(item), { [item.newId]: 'member', [item.oldId]: 'owner' })
    assert.deepEqual(await setting(), old)
    await db.systemSetting.create({ data: { key: types.ownerTransferKey(id), value: '{' } })
    await expectCode(store.ownerTransferStatus(id), 'OWNER_TRANSFER_STATE_UNAVAILABLE')
    await expectCode(store.cancelOwnerTransfer(id, db), 'OWNER_TRANSFER_STATE_UNAVAILABLE')
  })
  for (const change of ['pending target', 'rebound target', 'changed target role', 'missing target User', 'missing owner']) await test(`${change}: confirmation fails without mutation`, async () => {
    const item = await row('quote'), id = identity('quote', item.id)
    if (change === 'pending target') await db.$executeRawUnsafe(`UPDATE ${quote(item.table)} SET status='PENDING' WHERE id=$1`, item.newId)
    if (change === 'rebound target') {
      await db.$executeRawUnsafe('INSERT INTO "User" (id,plan) VALUES ($1,$2)', 'third', 'LIGHT')
      await db.$executeRawUnsafe(`UPDATE ${quote(item.table)} SET "userId"='third' WHERE id=$1`, item.newId)
    }
    if (change === 'changed target role') await db.$executeRawUnsafe(`UPDATE ${quote(item.table)} SET role='admin' WHERE id=$1`, item.newId)
    if (change === 'missing target User') await db.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', 'new')
    if (change === 'missing owner') await db.$executeRawUnsafe(`UPDATE ${quote(item.table)} SET role='admin' WHERE id=$1`, item.oldId)
    const beforeSetting = await setting(), beforeRoles = await roles(item)
    await expectCode(store.transferOwner(id, input(item), item.id, db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.deepEqual(await roles(item), beforeRoles)
    assert.deepEqual(await setting(), beforeSetting)
  })
  for (const phase of ['committed', 'canceled']) await test(`same operation ${phase} after first missing receipt wins over deleted target User`, async () => {
    const item = await row('quote'), id = identity('quote', item.id)
    const transactions = []
    let first = true, terminal, savedSetting, savedRoles
    const interposed = {
      $queryRaw: db.$queryRaw.bind(db),
      $transaction: async (callback, options) => {
        transactions.push(options?.isolationLevel)
        const value = await db.$transaction(callback, options)
        if (first) {
          first = false
          assert.equal(value, null, 'the first receipt read must be missing')
          terminal = phase === 'committed'
            ? await store.transferOwner(id, input(item), item.id, db)
            : await store.cancelOwnerTransfer(id, db)
          assert.equal(terminal.phase, phase)
          await db.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', 'new')
          savedSetting = await setting()
          savedRoles = await roles(item)
        }
        return value
      },
    }
    const recovered = await store.transferOwner(id, input(item), item.id, interposed)
    assert.deepEqual(transactions, ['ReadCommitted', 'Serializable', 'ReadCommitted'],
      'failed full transaction must roll back before a fresh receipt read')
    assert.deepEqual(dtoValue(recovered), dtoValue(terminal))
    assert.deepEqual(await setting(), savedSetting, 'recovery must not rewrite any receipt')
    assert.deepEqual(await roles(item), savedRoles, 'recovery must not rewrite either membership role')
    assert.equal(await db.user.findUnique({ where: { id: 'new' }, select: { id: true } }), null)
    assert.equal((await setting()).filter(record => record.key === types.ownerTransferKey(id)).length, 1)
  })
  await test('same operation with different target confirmation is rejected after commit', async () => {
    const item = await row('quote'), id = identity('quote', item.id)
    assert.equal((await store.transferOwner(id, input(item), item.id, db)).phase, 'committed')
    const before = await setting(), prior = await roles(item)
    await expectCode(store.transferOwner(id, { ...input(item), targetPlan: 'PRO' }, item.id, db), 'OWNER_TRANSFER_INPUT_CONFLICT')
    assert.deepEqual(await roles(item), prior)
    assert.deepEqual(await setting(), before)
  })
  await test('same UUID in other actor and organization has independent compound receipt', async () => {
    const item = await row('aio'), op = crypto.randomUUID()
    const original = identity('aio', item.id, op)
    const otherActor = { ...original, actorUserId: 'new' }
    const otherOrg = { ...original, organizationId: item.id + '_other' }
    for (const id of [original, otherActor, otherOrg]) assert.equal((await store.cancelOwnerTransfer(id, db)).phase, 'canceled')
    assert.equal(new Set([original, otherActor, otherOrg].map(types.ownerTransferKey)).size, 3)
    assert.equal((await setting()).filter(row => row.key.startsWith('doya-owner-transfer:')).length, 3)
  })
  await test('same UUID independent service scope', async () => {
    const shodan = await row('shodan'), quoteItem = await row('quote')
    const op = crypto.randomUUID()
    const first = identity('shodan', shodan.id, op), second = identity('quote', quoteItem.id, op)
    assert.equal((await store.transferOwner(first, input(shodan), shodan.id, db)).phase, 'committed')
    assert.equal((await store.transferOwner(second, input(quoteItem), quoteItem.id, db)).phase, 'committed')
    assert.notEqual(types.ownerTransferKey(first), types.ownerTransferKey(second))
  })
  await test('same UUID in billing lifecycle family leaves both exact receipt keys independent', async () => {
    const item = await row('shodan'), op = crypto.randomUUID(), id = identity('shodan', item.id, op)
    await lifecycle.reserveLifecycleOperation(db, {
      operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: 'observer',
      operationId: op, kind: 'retirement',
    }, crypto.createHash('sha256').update('synthetic independent billing family').digest('hex'))
    const before = await setting()
    assert.equal((await store.transferOwner(id, input(item), item.id, db)).phase, 'committed')
    const after = await setting()
    for (const prior of before) assert.deepEqual(after.find(row => row.key === prior.key), prior)
    assert.equal(after.filter(row => row.key === types.ownerTransferKey(id)).length, 1)
    assert.deepEqual(await roles(item), { [item.newId]: 'owner', [item.oldId]: 'admin' })
  })
  await test('forced equal advisory value serializes without aliasing exact receipts', async () => {
    const shodan = await row('shodan'), quoteItem = await row('quote'), op = crypto.randomUUID()
    await db.$executeRawUnsafe(`UPDATE ${quote(quoteItem.table)} SET "userId"=$1 WHERE id=$2`, 'otherOld', quoteItem.oldId)
    await db.$executeRawUnsafe(`UPDATE ${quote(quoteItem.table)} SET "userId"=$1 WHERE id=$2`, 'otherNew', quoteItem.newId)
    const first = identity('shodan', shodan.id, op)
    const second = { ...identity('quote', quoteItem.id, op), actorUserId: 'otherOld' }
    const secondInput = { ...input(quoteItem), targetUserId: 'otherNew' }
    const entered = deferred(), release = deferred()
    let advisoryCalls = 0, holderPid, firstHeld = false
    const equalLockDb = {
      $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, txOptions) => db.$transaction(tx => work(new Proxy(tx, { get(target, key) {
        if (key === '$queryRaw') return async (...args) => {
          if (Array.isArray(args[0]) && args[0].join('').includes('pg_advisory_xact_lock')) {
            advisoryCalls++
            const value = await target.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(117::bigint)`
            if (!firstHeld) {
              firstHeld = true
              holderPid = (await target.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
              entered.resolve(); await release.promise
            }
            return value
          }
          return target.$queryRaw(...args)
        }
        return target[key]
      } })), txOptions),
    }
    const firstPending = settle(store.transferOwner(first, input(shodan), shodan.id, equalLockDb))
    await started(entered, firstPending)
    const secondPending = settle(store.transferOwner(second, secondInput, quoteItem.id, equalLockDb))
    try { await waitCollisionLock(holderPid) } finally { release.resolve() }
    const firstResult = await firstPending, secondResult = await secondPending
    assert.equal(firstResult.ok, true, firstResult.error?.message)
    assert.equal(secondResult.ok, true, secondResult.error?.message)
    assert.equal(firstResult.value.phase, 'committed')
    assert.equal(secondResult.value.phase, 'committed')
    assert(advisoryCalls >= 4)
    assert.notEqual(types.ownerTransferKey(first), types.ownerTransferKey(second))
    assert.equal((await store.ownerTransferStatus(first)).phase, 'committed')
    assert.equal((await store.ownerTransferStatus(second)).phase, 'committed')
    assert.equal((await setting()).filter(row => [types.ownerTransferKey(first), types.ownerTransferKey(second)].includes(row.key)).length, 2)
    assert.deepEqual(await roles(shodan), { [shodan.newId]: 'owner', [shodan.oldId]: 'admin' })
    assert.deepEqual(await roles(quoteItem), { [quoteItem.newId]: 'owner', [quoteItem.oldId]: 'admin' })
  })
  await test('current User.plan alias remains exact in confirmation and unknown plan fails closed', async () => {
    const item = await row('aio'), id = identity('aio', item.id)
    await db.$executeRawUnsafe('UPDATE "User" SET plan=$1 WHERE id=$2', 'light-monthly', 'new')
    const list = await store.ownerTransferCandidates('aio', item.id, 'old')
    assert.equal(list.candidates[0].plan, 'light-monthly')
    await expectCode(store.transferOwner(id, input(item), item.id, db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.equal((await store.transferOwner(id, { ...input(item), targetPlan: 'light-monthly' }, item.id, db)).phase, 'committed')
    await db.$executeRawUnsafe('UPDATE "User" SET plan=$1 WHERE id=$2', 'NOT_PRO', 'new')
    const unknownItem = await row('aio', '_unknown')
    await expectCode(store.ownerTransferCandidates('aio', unknownItem.id, 'old'), 'OWNER_TRANSFER_STATE_UNAVAILABLE')
  })
  for (const userId of ['old', 'new']) await test(`${userId}: retirement fence rejects transfer without role or receipt mutation`, async () => {
    const item = await row('quote'), id = identity('quote', item.id)
    await retire(userId)
    const before = await setting(), prior = await roles(item)
    await expectCode(store.transferOwner(id, input(item), item.id, db), 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual(await roles(item), prior)
    assert.deepEqual(await setting(), before)
    if (userId === 'new') assert.equal((await store.ownerTransferCandidates('quote', item.id, 'old')).candidates.length, 0)
  })
  await test('retirement guard applies only to new missing cancel write', async () => {
    const item = await row('shodan'), missing = identity('shodan', item.id)
    await retire('old')
    const before = await setting()
    await expectCode(store.cancelOwnerTransfer(missing, db), 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual(await setting(), before)
    assert.equal((await store.ownerTransferStatus(missing)).phase, 'missing')
  })
  await test('failed second role update rolls back first update and receipt', async () => {
    const item = await row('mensetsu'), id = identity('mensetsu', item.id)
    const before = await setting(), prior = await roles(item)
    let updates = 0
    const wrapped = {
      $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, options) => db.$transaction(tx => work(new Proxy(tx, { get(target, key) {
        if (key === '$executeRaw') return async (...args) => ++updates % 2 === 0 ? 0 : target.$executeRaw(...args)
        return target[key]
      } })), options),
    }
    await expectCode(store.transferOwner(id, input(item), item.id, wrapped), 'OWNER_TRANSFER_PARTICIPANTS_CHANGED')
    assert(updates >= 2)
    assert.deepEqual(await roles(item), prior)
    assert.deepEqual(await setting(), before)
  })
  await test('failed first role update leaves both roles and receipt unchanged', async () => {
    const item = await row('mensetsu'), id = identity('mensetsu', item.id)
    const before = await setting(), prior = await roles(item), individualBefore = await individualState()
    let updates = 0
    const wrapped = {
      $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, txOptions) => db.$transaction(tx => work(new Proxy(tx, { get(target, key) {
        if (key === '$executeRaw') return async () => { updates++; return 0 }
        return target[key]
      } })), txOptions),
    }
    await expectCode(store.transferOwner(id, input(item), item.id, wrapped), 'OWNER_TRANSFER_PARTICIPANTS_CHANGED')
    assert(updates >= 1)
    assert.deepEqual(await roles(item), prior)
    assert.deepEqual(await setting(), before)
    assert.deepEqual(await individualState(), individualBefore)
  })
  await test('receipt insert fault rolls back both role updates', async () => {
    const item = await row('mensetsu'), id = identity('mensetsu', item.id)
    const before = await setting(), prior = await roles(item)
    const wrapped = {
      $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, options) => db.$transaction(tx => work(new Proxy(tx, { get(target, key) {
        if (key === 'systemSetting') return {
          findUnique: (...args) => target.systemSetting.findUnique(...args),
          create: async () => { throw Error('synthetic receipt insert failure') },
        }
        return target[key]
      } })), options),
    }
    await assert.rejects(store.transferOwner(id, input(item), item.id, wrapped), /synthetic receipt insert failure/)
    assert.deepEqual(await roles(item), prior)
    assert.deepEqual(await setting(), before)
  })
  await test('different operation IDs competing for one owner have one winner', async () => {
    const item = await row('quote'), a = identity('quote', item.id), b = identity('quote', item.id)
    const outcomes = await Promise.allSettled([
      store.transferOwner(a, input(item), item.id, db), store.transferOwner(b, input(item), item.id, db),
    ])
    assert.equal(outcomes.filter(row => row.status === 'fulfilled' && row.value.phase === 'committed').length, 1)
    assert.equal(outcomes.filter(row => row.status === 'rejected').length, 1)
    assert.equal(await db.systemSetting.count({ where: { key: { in: [types.ownerTransferKey(a), types.ownerTransferKey(b)] } } }), 1)
    assert.deepEqual(await roles(item), { [item.newId]: 'owner', [item.oldId]: 'admin' })
  })
  for (const first of ['cancel', 'transfer']) await test(`${first}-first: actual operation lock serializes one terminal receipt`, async () => {
    const item = await row('shodan'), id = identity('shodan', item.id)
    const entered = deferred(), release = deferred(), preflightDone = deferred(), advance = deferred()
    let holderPid
    let firstPending
    if (first === 'transfer') {
      let transactions = 0
      const controlled = {
        $queryRaw: (...args) => db.$queryRaw(...args),
        $transaction: async (work, options) => {
          const value = await db.$transaction(work, options)
          if (++transactions === 1) { preflightDone.resolve(); await advance.promise }
          return value
        },
      }
      firstPending = settle(store.transferOwner(id, input(item), item.id, controlled))
      await preflightDone.promise // The historical read is done before the advisory gate is held.
    }
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${types.ownerTransferKey(id)})::bigint)`
      entered.resolve(); await release.promise
    }, { isolationLevel: 'ReadCommitted', timeout: 30000 }))
    await started(entered, holder)
    if (first === 'transfer') advance.resolve()
    else firstPending = settle(store.cancelOwnerTransfer(id, db))
    let firstPid
    try { firstPid = await waitOperationLock(holderPid, first + '-first') }
    catch (error) { release.resolve(); await holder; await firstPending; throw error }
    const secondPending = settle(first === 'cancel' ? store.transferOwner(id, input(item), item.id, db) : store.cancelOwnerTransfer(id, db))
    try { await waitUserLock(firstPid, first + '-first contender') } finally { release.resolve() }
    assert.equal((await holder).ok, true)
    const one = await firstPending, two = await secondPending
    assert.equal(one.ok, true, one.error?.message)
    assert.equal(two.ok, true, two.error?.message)
    assert.equal(one.value.phase, first === 'cancel' ? 'canceled' : 'committed')
    assert.deepEqual(dtoValue(two.value), dtoValue(one.value))
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
    assert.deepEqual(await roles(item), first === 'cancel'
      ? { [item.newId]: 'member', [item.oldId]: 'owner' }
      : { [item.newId]: 'owner', [item.oldId]: 'admin' })
  })
  for (const userId of ['old', 'new']) await test(`${userId}: retirement-first actual User wait rejects transfer`, async () => {
    const item = await row('aishodan'), id = identity('aishodan', item.id)
    const entered = deferred(), release = deferred(), retirementId = {
      operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId,
      operationId: crypto.randomUUID(), kind: 'retirement',
    }
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId,
        crypto.createHash('sha256').update('synthetic owner-transfer retirement').digest('hex'))
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder)
    const pending = settle(store.transferOwner(id, input(item), item.id, db))
    try { await waitUserLock(holderPid, userId + ' retirement-first') } finally { release.resolve() }
    assert.equal((await holder).ok, true)
    const stopped = await pending
    assert.equal(stopped.ok, false)
    assert.equal(stopped.error?.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual(await roles(item), { [item.newId]: 'member', [item.oldId]: 'owner' })
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 0)
  })
  for (const userId of ['old', 'new']) await test(`${userId}: transfer-first actual User wait observes committed roles`, async () => {
    const item = await row('mensetsu'), id = identity('mensetsu', item.id)
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      const proxy = { $queryRaw: (...args) => db.$queryRaw(...args), $transaction: work => work(tx) }
      assert.equal((await store.transferOwner(id, input(item), item.id, proxy)).phase, 'committed')
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder)
    const pending = settle(lifecycle.reserveLifecycleOperation(db, {
      operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId,
      operationId: crypto.randomUUID(), kind: 'retirement',
    }, crypto.createHash('sha256').update('synthetic owner-transfer retirement').digest('hex')))
    try { await waitUserLock(holderPid, userId + ' transfer-first') } finally { release.resolve() }
    assert.equal((await holder).ok, true)
    const reserved = await pending
    assert.equal(reserved.ok, true, reserved.error?.message)
    assert.deepEqual(await roles(item), { [item.newId]: 'owner', [item.oldId]: 'admin' })
    if (userId === 'old') await retirement.checkAccountRetirementSafe(db, userId)
    else await assert.rejects(retirement.checkAccountRetirementSafe(db, userId), error => error.reason === 'ownership')
  })
  const sourcePaths = [
    'src/lib/owner-transfer/types.ts', 'src/lib/owner-transfer/receipt.ts', 'src/lib/owner-transfer/store.ts',
    'src/lib/account-lifecycle/state.ts', 'src/lib/account-lifecycle/store.ts',
    'src/lib/account-retirement.ts', 'scripts/security-regression/retirement-fixture.cjs',
    'docs/audits/2026-10-06-all-services-recheck/verify-owner-transfer-postgres.cjs',
  ]
  const sourceHashes = Object.fromEntries(sourcePaths.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))
  const evidence = { checkedAt: new Date().toISOString(), passed: cases.length, cases, waits, operationWaits, collisionWaits, sourceHashes, scope: 'Private Unix PostgreSQL. Synthetic users and five org/member pairs. No production data or provider.' }
  const output = process.env.DOYA_OWNER_T1_EVIDENCE || 'docs/audits/2026-10-06-all-services-recheck/owner-transfer-postgres-results.json'
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence))
}
run().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1 })
