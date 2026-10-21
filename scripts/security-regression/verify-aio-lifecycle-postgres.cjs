process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { PrismaClient, Prisma } = require('@prisma/client')
const { load } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../..')
const folder = process.env.DOYA_AIO_LIFECYCLE_PG_ROOT
const socket = process.env.DOYA_AIO_LIFECYCLE_PG_SOCKET
const port = Number(process.env.DOYA_AIO_LIFECYCLE_PG_PORT)
assert.match(folder || '', /^\/tmp\/doya-aio-lifecycle-[a-f0-9]{8}$/)
assert.equal(socket, folder + '/socket')
assert(port > 1024 && port < 65536)
const db = new PrismaClient({ datasources: { db: { url: `postgresql://doya_aio_lifecycle@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=aio_lifecycle_fixture` } } })
const models = ['User', 'SystemSetting', 'AioOrganization', 'AioMember', 'AioBrandProfile', 'AioPrompt']
const ids = { owner: 'synthetic_aio_owner', actor: 'synthetic_aio_actor', recipient: 'synthetic_aio_recipient', empty: 'synthetic_aio_empty' }
const orgId = 'synthetic_aio_org'
let sessionUser = ids.actor
let mails = 0
let providerCalls = 0
let retireDuringDerive = false
let beforeInviteWrite = null
let beforeSecondTransaction = null
let routeTransactionCount = 0
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const routeDb = new Proxy(db, { get(target, key) {
  if (key !== '$transaction') return Reflect.get(target, key)
  return async (work, options) => {
    routeTransactionCount++
    if (beforeSecondTransaction && routeTransactionCount === 2) { const held = beforeSecondTransaction; beforeSecondTransaction = null; held.seen.resolve(); await held.release.promise }
    return target.$transaction(tx => work(new Proxy(tx, { get(transaction, field) {
    if (field !== 'aioMember') return Reflect.get(transaction, field)
    return new Proxy(transaction.aioMember, { get(model, method) {
      if (method !== 'create') return Reflect.get(model, method)
      return async args => {
        if (beforeInviteWrite) { const held = beforeInviteWrite; beforeInviteWrite = null; held.seen.resolve(); await held.release.promise }
        return model.create(args)
      }
    } })
  } })), options)
  }
} })
const types = load('src/lib/aio/types.ts')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const fence = load('src/lib/account-lifecycle/organization-fence.ts', { '@prisma/client': { Prisma }, './state': state, './store': store })
const common = {
  'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => sessionUser ? { user: { id: sessionUser, email: sessionUser + '@example.invalid', name: 'Synthetic actor' } } : null },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db }, './types': types, '@/lib/aio/types': types,
  '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/organization-fence': fence,
}
const access = load('src/lib/aio/access.ts', common)
const memberRoute = load('src/app/api/aio/members/route.ts', { ...common, '@/lib/prisma': { prisma: routeDb }, '@/lib/aio/access': access, '@/lib/html-escape': { escapeHtml: s => s }, '@/lib/email': { sendEmail: async () => { mails++; return { success: true } } }, crypto })
const mutateRoute = load('src/app/api/aio/members/[id]/route.ts', { ...common, '@/lib/prisma': { prisma: routeDb }, '@/lib/aio/access': access })
const inviteRoute = load('src/app/api/aio/invite/[token]/route.ts', common)
const organizationRoute = load('src/app/api/aio/organization/route.ts', { ...common, '@/lib/aio/access': access })
const quick = load('src/lib/aio/quick-start-operation.ts', { ...common, 'node:crypto': crypto })
const digest = crypto.createHash('sha256').update('synthetic AIO R1 lifecycle').digest('hex')
const retirement = userId => store.reserveLifecycleOperation(db, { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId, operationId: crypto.randomUUID(), kind: 'retirement' }, digest)
const operational = load('src/lib/operational-json.ts', {}, { TextDecoder, Uint8Array })
const quickRoute = load('src/app/api/aio/quick-start/route.ts', {
  ...common, 'node:crypto': crypto, '@/lib/aio/quick-start-operation': quick,
  '@/lib/aio/billing': { getAioBilling: async () => ({ plan: 'FREE' }) },
  '@/lib/unified-plan': load('src/lib/unified-plan.ts'),
  '@/lib/operational-json': operational,
  '@/lib/aio/suggest': {
    normalizeUrl: value => value,
    deriveBrandFromUrl: async () => {
      if (retireDuringDerive) await retirement(sessionUser)
      return { brandName: 'Synthetic AIO' }
    },
    suggestBrandSetup: async () => { providerCalls++; return { category: 'SaaS', aliases: [], competitors: [], prompts: ['Synthetic prompt'] } },
  },
})
const operationId = () => crypto.randomUUID()
const quote = s => '"' + s.replaceAll('"', '""') + '"'
const cases = []
const watchdog = setTimeout(() => { console.error('AIO private PG watchdog'); process.exitCode = 1; void db.$disconnect() }, 120000)
async function setup() {
  const [identity] = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address, current_user AS role, current_setting('data_directory') AS folder")
  assert.equal(identity.address, null)
  assert.equal(identity.role, 'doya_aio_lifecycle')
  assert.equal(identity.folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA aio_lifecycle_fixture')
  for (const name of models) {
    const model = Prisma.dmmf.datamodel.models.find(item => item.name === name)
    assert(model, name)
    const columns = model.fields.filter(field => field.kind !== 'object').map(field => {
      let type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      if (field.isList) type += '[]'
      let defaultValue = ''
      if (field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now')) defaultValue = ' DEFAULT CURRENT_TIMESTAMP'
      else if (field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default)) defaultValue = ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default))
      return quote(field.dbName || field.name) + ' ' + type + (field.isRequired ? ' NOT NULL' : '') + defaultValue + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + columns.join(',') + ')')
  }
  for (const model of Prisma.dmmf.datamodel.models.filter(item => models.includes(item.name))) {
    for (const field of model.fields.filter(item => item.kind === 'object' && item.relationFromFields?.length && models.includes(item.type))) {
      const target = Prisma.dmmf.datamodel.models.find(item => item.name === field.type)
      const onDelete = field.relationOnDelete || (field.isRequired ? 'Restrict' : 'SetNull')
      const action = { Cascade: 'CASCADE', SetNull: 'SET NULL', Restrict: 'RESTRICT', NoAction: 'NO ACTION' }[onDelete]
      await db.$executeRawUnsafe('ALTER TABLE ' + quote(model.dbName || model.name) + ' ADD FOREIGN KEY (' + field.relationFromFields.map(quote).join(',') + ') REFERENCES ' + quote(target.dbName || target.name) + ' (' + field.relationToFields.map(quote).join(',') + ') ON DELETE ' + action)
    }
  }
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User", "SystemSetting", aio_organizations CASCADE')
  for (const id of Object.values(ids)) await db.user.create({ data: { id, email: id + '@example.invalid', plan: 'FREE' } })
  await db.aioOrganization.create({ data: { id: orgId, slug: 'synthetic-aio', name: 'Synthetic AIO' } })
  await db.aioMember.create({ data: { id: 'member_owner', organizationId: orgId, userId: ids.owner, role: 'owner', status: 'ACTIVE' } })
  await db.aioMember.create({ data: { id: 'member_actor', organizationId: orgId, userId: ids.actor, role: 'admin', status: 'ACTIVE' } })
  sessionUser = ids.actor; mails = 0; providerCalls = 0; retireDuringDerive = false; beforeInviteWrite = null; beforeSecondTransaction = null; routeTransactionCount = 0
}
async function check(name, work) {
  await reset()
  await work()
  cases.push(name)
  console.log('PASS ' + name)
}
const postMember = (email = ids.recipient + '@example.invalid') => memberRoute.POST(new Request('https://example.invalid/api/aio/members?org=synthetic-aio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role: 'member' }) }))
const patchMember = (id, role = 'manager') => mutateRoute.PATCH(new Request('https://example.invalid/api/aio/members/' + id + '?org=synthetic-aio', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }), { params: Promise.resolve({ id }) })
const deleteMember = id => mutateRoute.DELETE(new Request('https://example.invalid/api/aio/members/' + id + '?org=synthetic-aio', { method: 'DELETE' }), { params: Promise.resolve({ id }) })
const claim = token => inviteRoute.POST(new Request('https://example.invalid/api/aio/invite/' + token, { method: 'POST' }), { params: Promise.resolve({ token }) })
async function waitForUserLock() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE usename='doya_aio_lifecycle' AND wait_event_type='Lock' AND query LIKE '%User%'")
    if (rows[0].count) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw Error('Expected real User lock wait')
}
async function heldRetirement(userId) {
  const ready = defer(), release = defer()
  const identity = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId, operationId: operationId(), kind: 'retirement' }
  const pending = db.$transaction(async tx => {
    const nested = { $transaction: async work => work(tx) }
    const reserved = await store.reserveLifecycleOperation(nested, identity, digest)
    assert(reserved.claim)
    ready.resolve()
    await release.promise
    return reserved
  }, { isolationLevel: 'Serializable', timeout: 30000 })
  await ready.promise
  return { pending, release: release.resolve }
}
;(async () => { try {
  await setup()
  await check('retired actor cannot create pending invitation or send mail', async () => {
    await retirement(ids.actor)
    const response = await postMember()
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.aioMember.count({ where: { status: 'PENDING' } }), 0)
    assert.equal(mails, 0)
  })
  await check('writer-first pending invitation commits before retirement reserves actor', async () => {
    const held = { seen: defer(), release: defer() }
    beforeInviteWrite = held
    const pending = postMember()
    await held.seen.promise
    let retired = false
    const reservation = retirement(ids.actor).then(result => { retired = true; return result })
    await waitForUserLock()
    assert.equal(retired, false)
    held.release.resolve()
    assert.equal((await pending).status, 200)
    assert((await reservation).claim)
    assert.equal(await db.aioMember.count({ where: { status: 'PENDING' } }), 1)
    assert.equal(mails, 1)
  })
  await check('pending invitation keeps null user and recipient retirement blocks claim', async () => {
    const response = await postMember()
    assert.equal(response.status, 200)
    const pending = await db.aioMember.findFirst({ where: { status: 'PENDING' } })
    assert.equal(pending.userId, null)
    assert.equal(mails, 1)
    await retirement(ids.recipient)
    sessionUser = ids.recipient
    const denied = await claim(pending.inviteToken)
    assert.equal(denied.status, 409)
    assert.equal(await db.aioMember.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 0)
  })
  await check('valid recipient claims invitation with exact user binding and consumed token', async () => {
    assert.equal((await postMember()).status, 200)
    const pending = await db.aioMember.findFirst({ where: { status: 'PENDING' } })
    assert.equal(pending.userId, null)
    sessionUser = ids.recipient
    const response = await claim(pending.inviteToken)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).ok, true)
    const bound = await db.aioMember.findUnique({ where: { id: pending.id } })
    assert.equal(bound.status, 'ACTIVE'); assert.equal(bound.userId, ids.recipient)
    assert(bound.acceptedAt instanceof Date); assert.equal(bound.inviteToken, null)
    assert.equal((await claim(pending.inviteToken)).status, 404)
  })
  await check('legacy pending binding is not transferred to another recipient', async () => {
    await db.aioMember.create({ data: { id: 'bound_pending', organizationId: orgId, userId: ids.empty, role: 'member', status: 'PENDING', inviteEmail: ids.recipient + '@example.invalid', inviteToken: operationId() } })
    const pending = await db.aioMember.findUnique({ where: { id: 'bound_pending' } })
    sessionUser = ids.recipient
    assert.equal((await claim(pending.inviteToken)).status, 409)
    const after = await db.aioMember.findUnique({ where: { id: pending.id } })
    assert.equal(after.userId, ids.empty); assert.equal(after.status, 'PENDING'); assert.equal(after.inviteToken, pending.inviteToken)
  })
  await check('actual DELETE removes ordinary member but retirement blocks actor owner and target', async () => {
    for (const who of [ids.recipient, ids.empty]) await db.aioMember.create({ data: { id: 'member_' + who, organizationId: orgId, userId: who, role: 'member', status: 'ACTIVE' } })
    assert.equal((await deleteMember('member_' + ids.recipient)).status, 200)
    assert.equal(await db.aioMember.count({ where: { id: 'member_' + ids.recipient } }), 0)
    await retirement(ids.empty)
    const deniedTarget = await deleteMember('member_' + ids.empty)
    assert.equal(deniedTarget.status, 409)
    assert.equal(await db.aioMember.count({ where: { id: 'member_' + ids.empty } }), 1)
  })
  for (const who of [ids.actor, ids.owner]) await check('actual DELETE denies retiring ' + who, async () => {
    await db.aioMember.create({ data: { id: 'member_target', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'ACTIVE' } })
    await retirement(who)
    const response = await deleteMember('member_target')
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.aioMember.count({ where: { id: 'member_target' } }), 1)
  })
  await check('owner retirement before invite claim denies ACTIVE binding', async () => {
    assert.equal((await postMember()).status, 200)
    const pending = await db.aioMember.findFirst({ where: { status: 'PENDING' } })
    await retirement(ids.owner)
    sessionUser = ids.recipient
    const response = await claim(pending.inviteToken)
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.aioMember.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 0)
  })
  await check('retired owner blocks member role update', async () => {
    await db.aioMember.create({ data: { id: 'member_target', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'ACTIVE' } })
    await retirement(ids.owner)
    const response = await patchMember('member_target')
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal((await db.aioMember.findUnique({ where: { id: 'member_target' } })).role, 'member')
  })
  await check('target User swap after discovery replans and protects replacement retirement', async () => {
    await db.aioMember.create({ data: { id: 'member_target', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'ACTIVE' } })
    const held = { seen: defer(), release: defer() }
    beforeSecondTransaction = held
    const pending = patchMember('member_target')
    await held.seen.promise
    await db.aioMember.update({ where: { id: 'member_target' }, data: { userId: ids.empty } })
    await retirement(ids.empty)
    held.release.resolve()
    const response = await pending
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal((await db.aioMember.findUnique({ where: { id: 'member_target' } })).role, 'member')
  })
  await check('actor downgrade after discovery denies member role update', async () => {
    await db.aioMember.create({ data: { id: 'member_target', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'ACTIVE' } })
    const held = { seen: defer(), release: defer() }
    beforeSecondTransaction = held
    const pending = patchMember('member_target')
    await held.seen.promise
    await db.aioMember.update({ where: { id: 'member_actor' }, data: { role: 'member' } })
    held.release.resolve()
    const response = await pending
    assert.equal(response.status, 403)
    assert.equal((await db.aioMember.findUnique({ where: { id: 'member_target' } })).role, 'member')
  })
  await check('unbound pending role update preserves status and null user', async () => {
    await db.aioMember.create({ data: { id: 'member_target', organizationId: orgId, userId: null, role: 'member', status: 'PENDING', inviteEmail: 'unbound@example.invalid', inviteToken: operationId() } })
    const response = await patchMember('member_target')
    assert.equal(response.status, 200)
    const row = await db.aioMember.findUnique({ where: { id: 'member_target' } })
    assert.equal(row.role, 'manager'); assert.equal(row.userId, null); assert.equal(row.status, 'PENDING')
  })
  await check('foreign organization target is not mutated', async () => {
    await db.aioOrganization.create({ data: { id: 'foreign_aio_org', slug: 'foreign-aio', name: 'Foreign synthetic' } })
    await db.aioMember.create({ data: { id: 'foreign_member', organizationId: 'foreign_aio_org', userId: ids.recipient, role: 'member', status: 'ACTIVE' } })
    const response = await patchMember('foreign_member')
    assert.equal(response.status, 404)
    assert.equal((await db.aioMember.findUnique({ where: { id: 'foreign_member' } })).role, 'member')
  })
  await check('actor downgrade denies pending invite before mail', async () => {
    await db.aioMember.update({ where: { id: 'member_actor' }, data: { role: 'member' } })
    const response = await postMember()
    assert.equal(response.status, 403)
    assert.equal(mails, 0)
    assert.equal(await db.aioMember.count({ where: { status: 'PENDING' } }), 0)
  })
  await check('changed current DB email denies pending claim', async () => {
    assert.equal((await postMember()).status, 200)
    const pending = await db.aioMember.findFirst({ where: { status: 'PENDING' } })
    await db.user.update({ where: { id: ids.recipient }, data: { email: 'changed@example.invalid' } })
    sessionUser = ids.recipient
    const response = await claim(pending.inviteToken)
    assert.equal(response.status, 403)
    assert.equal(await db.aioMember.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 0)
  })
  await check('duplicate invitation preserves null policy and expired unbound invitation is replaced', async () => {
    assert.equal((await postMember()).status, 200)
    assert.equal((await postMember()).status, 409)
    assert.equal(mails, 1)
    const pending = await db.aioMember.findFirst({ where: { status: 'PENDING' } })
    await db.aioMember.update({ where: { id: pending.id }, data: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } })
    assert.equal((await postMember()).status, 200)
    assert.equal(await db.aioMember.count({ where: { status: 'PENDING' } }), 1)
    assert.equal((await db.aioMember.findFirst({ where: { status: 'PENDING' } })).userId, null)
    assert.equal(mails, 2)
  })
  await check('expired bound anomalous invitation cannot be silently deleted', async () => {
    await db.aioMember.create({ data: { id: 'bound_pending', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'PENDING', inviteEmail: ids.recipient + '@example.invalid', inviteToken: operationId(), createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } })
    const response = await postMember()
    assert.equal(response.status, 409)
    assert.equal(await db.aioMember.count({ where: { id: 'bound_pending' } }), 1)
    assert.equal(mails, 0)
  })
  await check('malformed owner retirement fence fails closed before pending invite or mail', async () => {
    await retirement(ids.owner)
    await db.systemSetting.update({ where: { key: state.lifecycleFenceKey(ids.owner) }, data: { value: 'malformed' } })
    const response = await postMember()
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'LIFECYCLE_STATE_UNAVAILABLE')
    assert.equal(await db.aioMember.count({ where: { status: 'PENDING' } }), 0)
    assert.equal(mails, 0)
  })
  await check('onboarding reuse and new-user retirement denial', async () => {
    sessionUser = ids.empty
    const created = await organizationRoute.POST(new Request('https://example.invalid/api/aio/organization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New', memberName: 'Owner' }) }))
    assert.equal(created.status, 200)
    const again = await organizationRoute.POST(new Request('https://example.invalid/api/aio/organization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Another', memberName: 'Owner' }) }))
    assert.equal(again.status, 200)
    assert.equal((await again.json()).organization.id, (await created.json()).organization.id)
    await retirement(ids.actor)
    await assert.rejects(access.createAioOrganization(ids.actor, 'Blocked', 'Owner'), error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
  })
  for (const creator of ['getOrCreateOrganization', 'createAioOrganization']) await check('retirement first makes actual ' + creator + ' wait and deny grant', async () => {
    const held = await heldRetirement(ids.empty)
    let settled = false
    const pending = access[creator](ids.empty, 'Fresh ' + creator, 'Owner').then(value => { settled = true; return value }, error => { settled = true; throw error })
    await waitForUserLock()
    assert.equal(settled, false)
    held.release()
    assert((await held.pending).claim)
    await assert.rejects(pending, error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.aioMember.count({ where: { userId: ids.empty } }), 0)
    assert.equal(await db.aioOrganization.count(), 1)
  })
  for (const creator of ['getOrCreateOrganization', 'createAioOrganization']) await check('actual ' + creator + ' writer first holds retirement until owner grant commits', async () => {
    const seen = defer(), release = defer()
    const writerDb = new Proxy(db, { get(target, key) {
      if (key !== '$transaction') return Reflect.get(target, key)
      return (work, options) => target.$transaction(tx => work(new Proxy(tx, { get(inner, field) {
        if (field !== 'aioOrganization') return Reflect.get(inner, field)
        return new Proxy(inner.aioOrganization, { get(model, method) {
          if (method !== 'create') return Reflect.get(model, method)
          return async args => { seen.resolve(); await release.promise; return model.create(args) }
        } })
      } })), options)
    } })
    const actual = load('src/lib/aio/access.ts', { ...common, '@/lib/prisma': { prisma: writerDb } })
    const pending = actual[creator](ids.empty, 'Writer first ' + creator, 'Owner')
    await seen.promise
    let retired = false
    const reserve = retirement(ids.empty).then(value => { retired = true; return value })
    await waitForUserLock()
    assert.equal(retired, false)
    release.resolve()
    const created = await pending
    assert(created.id)
    assert((await reserve).claim)
    assert.equal(await db.aioMember.count({ where: { userId: ids.empty, role: 'owner', status: 'ACTIVE' } }), 1)
  })
  await check('missing User fails onboarding without an orphan organization', async () => {
    sessionUser = ids.empty
    await db.user.delete({ where: { id: ids.empty } })
    const response = await organizationRoute.POST(new Request('https://example.invalid/api/aio/organization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Missing', memberName: 'Owner' }) }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'LIFECYCLE_USER_UNAVAILABLE')
    assert.equal(await db.aioOrganization.count(), 1)
  })
  await check('quick-start denies before external stage and finish after retirement', async () => {
    const operation = { userId: ids.empty, operationId: operationId(), url: 'https://new.example.invalid' }
    const started = await quick.beginAioQuickStart(operation, db)
    assert.equal(started.state, 'started')
    await retirement(ids.empty)
    await assert.rejects(quick.assertAioQuickStartGrantAllowed(operation, db), error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(providerCalls, 0)
    await assert.rejects(quick.finishAioQuickStart({ userId: operation.userId, operationId: operation.operationId, leaseToken: started.leaseToken }, async tx => {
      providerCalls++
      return tx.aioOrganization.create({ data: { name: 'Blocked', slug: 'blocked' } })
    }, db), error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(providerCalls, 0)
    assert.equal(await db.aioOrganization.count(), 1)
    assert.equal((await quick.recoverAioQuickStart(operation, false, db)).state, 'pending')
  })
  await check('retirement first makes actual quick finish wait and deny graph commit', async () => {
    const operation = { userId: ids.empty, operationId: operationId(), url: 'https://quick-retire-first.invalid' }
    const started = await quick.beginAioQuickStart(operation, db)
    assert.equal(started.state, 'started')
    const held = await heldRetirement(ids.empty)
    let saveCalls = 0
    const pending = quick.finishAioQuickStart({ userId: ids.empty, operationId: operation.operationId, leaseToken: started.leaseToken }, async tx => {
      saveCalls++
      return tx.aioOrganization.create({ data: { name: 'Forbidden', slug: 'forbidden' } })
    }, db)
    await waitForUserLock()
    held.release(); assert((await held.pending).claim)
    await assert.rejects(pending, error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(saveCalls, 0)
    assert.equal(await db.aioOrganization.count(), 1)
    assert.equal((await quick.recoverAioQuickStart(operation, false, db)).state, 'pending')
  })
  await check('quick finish writer first holds retirement until receipt and owner commit', async () => {
    const operation = { userId: ids.empty, operationId: operationId(), url: 'https://quick-writer-first.invalid' }
    const started = await quick.beginAioQuickStart(operation, db)
    assert.equal(started.state, 'started')
    const seen = defer(), release = defer()
    const pending = quick.finishAioQuickStart({ userId: ids.empty, operationId: operation.operationId, leaseToken: started.leaseToken }, async tx => {
      seen.resolve(); await release.promise
      const org = await tx.aioOrganization.create({ data: { name: 'Committed', slug: 'committed' } })
      await tx.aioMember.create({ data: { organizationId: org.id, userId: ids.empty, role: 'owner', status: 'ACTIVE' } })
      await tx.aioBrandProfile.create({ data: { organizationId: org.id, brandName: 'Committed', brandUrl: operation.url } })
      return org
    }, db)
    await seen.promise
    let retired = false
    const reserve = retirement(ids.empty).then(value => { retired = true; return value })
    await waitForUserLock(); assert.equal(retired, false)
    release.resolve()
    assert.equal((await pending).state, 'completed')
    assert((await reserve).claim)
    assert.equal(await db.aioMember.count({ where: { userId: ids.empty, role: 'owner', status: 'ACTIVE' } }), 1)
    assert.equal((await quick.recoverAioQuickStart(operation, false, db)).state, 'completed')
  })
  await check('actual quick-start route denies retired actor before provider stage', async () => {
    sessionUser = ids.empty
    await retirement(ids.empty)
    const response = await quickRoute.POST(new Request('https://example.invalid/api/aio/quick-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: operationId(), url: 'https://new.example.invalid' }) }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(providerCalls, 0)
    assert.equal(await db.aioOrganization.count(), 1)
  })
  await check('actual quick-start route rechecks after title derivation before AI provider', async () => {
    sessionUser = ids.empty
    retireDuringDerive = true
    const response = await quickRoute.POST(new Request('https://example.invalid/api/aio/quick-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: operationId(), url: 'https://new.example.invalid' }) }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(providerCalls, 0)
    assert.equal(await db.aioOrganization.count(), 1)
  })
  await check('cancel-before-start tombstone prevents new provider work for same UUID', async () => {
    const identity = { userId: ids.empty, operationId: operationId() }
    assert.equal((await quick.recoverAioQuickStart(identity, true, db)).state, 'cancelled')
    assert.equal((await quick.beginAioQuickStart({ ...identity, url: 'https://new.example.invalid' }, db)).state, 'cancelled')
    assert.equal(providerCalls, 0)
    assert.equal(await db.aioOrganization.count(), 1)
  })
  await check('twenty-workspace quota remains unchanged and prevents provider call', async () => {
    sessionUser = ids.empty
    for (let n = 0; n < 20; n++) {
      const organization = await db.aioOrganization.create({ data: { id: 'quota_org_' + n, slug: 'quota-' + n, name: 'Quota' } })
      await db.aioMember.create({ data: { id: 'quota_member_' + n, organizationId: organization.id, userId: ids.empty, role: 'owner', status: 'ACTIVE' } })
    }
    const response = await quickRoute.POST(new Request('https://example.invalid/api/aio/quick-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: operationId(), url: 'https://new.example.invalid' }) }))
    assert.equal(response.status, 402)
    assert.equal((await response.json()).code, 'WORKSPACE_LIMIT')
    assert.equal(providerCalls, 0)
    assert.equal(await db.aioOrganization.count(), 21)
  })
  const files = ['src/lib/aio/access.ts', 'src/lib/aio/quick-start-operation.ts', 'src/app/api/aio/members/route.ts', 'src/app/api/aio/members/[id]/route.ts', 'src/app/api/aio/invite/[token]/route.ts', 'src/app/api/aio/organization/route.ts', 'src/app/api/aio/quick-start/route.ts', 'scripts/security-regression/verify-aio-lifecycle-postgres.cjs']
  console.log(JSON.stringify({ passed: cases.length, scope: 'Actual AIO route/access/quick-start + lifecycle store on owned private PostgreSQL; synthetic mail and no provider', cases, sourceHashes: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])) }))
} finally { clearTimeout(watchdog); await db.$disconnect() } })().catch(error => { console.error(error); process.exitCode = 1 })
