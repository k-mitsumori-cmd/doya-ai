process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { PrismaClient, Prisma } = require('@prisma/client')
const { load } = require('./load-typescript.cjs')
const repo = path.resolve(__dirname, '../..')
const folder = process.env.DOYA_R1_THREE_PG_ROOT
const socket = process.env.DOYA_R1_THREE_PG_SOCKET
const port = Number(process.env.DOYA_R1_THREE_PG_PORT)
assert.match(folder || '', /^\/tmp\/doya-r1-three-[a-f0-9]{8}$/)
assert.equal(socket, folder + '/socket')
assert(port > 1024 && port < 65536)
const db = new PrismaClient({ datasources: { db: { url: `postgresql://doya_r1_three@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=r1_three_fixture` } } })
const services = ['quote', 'mensetsu', 'aishodan']
const models = ['User', 'SystemSetting', ...services.flatMap(s => [s[0].toUpperCase() + s.slice(1) + 'Organization', s[0].toUpperCase() + s.slice(1) + 'Member'])]
const ids = { owner: 'r1_three_owner', actor: 'r1_three_actor', recipient: 'r1_three_recipient', target: 'r1_three_target', foreign: 'r1_three_foreign' }
const orgId = 'r1_three_org'
const digest = crypto.createHash('sha256').update('synthetic R1 three membership').digest('hex')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const fence = load('src/lib/account-lifecycle/organization-fence.ts', { '@prisma/client': { Prisma }, './state': state, './store': store })
const source = { '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/organization-fence': fence }
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const cases = []
const watchdog = setTimeout(() => { console.error('R1 three private PG watchdog'); process.exitCode = 1; void db.$disconnect() }, 180000)
let sessionUser = ids.actor, mailCalls = 0, beforeMemberWrite = null, beforeAccessMemberWrite = null, beforeSettingWrite = null, afterTargetDiscovery = null, beforeScopeTransaction = null, scopeTransactionCount = 0
const modelOf = s => s + 'Member'
const organizationOf = s => s + 'Organization'
async function setup() {
  const [identity] = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address, current_user AS role, current_setting('data_directory') AS folder")
  assert.equal(identity.address, null); assert.equal(identity.role, 'doya_r1_three'); assert.equal(identity.folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA r1_three_fixture')
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
async function reset(service) {
  await db.$executeRawUnsafe('TRUNCATE "User", "SystemSetting", quote_organizations, mensetsu_organizations, aishodan_organizations CASCADE')
  for (const id of Object.values(ids)) await db.user.create({ data: { id, email: id + '@example.invalid', plan: 'FREE' } })
  await db[organizationOf(service)].create({ data: { id: orgId, slug: 'synthetic-three', name: 'Synthetic Three' } })
  for (const [id, userId, role] of [['owner_member', ids.owner, 'owner'], ['actor_member', ids.actor, 'admin']]) {
    await db[modelOf(service)].create({ data: { id, organizationId: orgId, userId, role, status: 'ACTIVE' } })
  }
  sessionUser = ids.actor; mailCalls = 0; beforeMemberWrite = null; beforeAccessMemberWrite = null; beforeSettingWrite = null; afterTargetDiscovery = null; beforeScopeTransaction = null; scopeTransactionCount = 0
}
async function check(service, name, work) {
  await reset(service)
  await work()
  cases.push(service + ': ' + name)
  console.log('PASS ' + service + ': ' + name)
}
const identity = (userId, kind = 'retirement') => ({ operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId, operationId: crypto.randomUUID(), kind })
const retirement = userId => store.reserveLifecycleOperation(db, identity(userId), digest)
async function heldRetirement(userId) {
  const seen = defer(), release = defer()
  const pending = db.$transaction(async tx => {
    const nested = { $transaction: async work => work(tx) }
    const reserved = await store.reserveLifecycleOperation(nested, identity(userId), digest)
    assert(reserved.claim)
    seen.resolve()
    await release.promise
    return reserved
  }, { isolationLevel: 'Serializable', timeout: 30000 })
  await seen.promise
  return { pending, release: release.resolve }
}
async function waitForUserLock() {
  for (let attempt = 0; attempt < 150; attempt++) {
    const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE usename='doya_r1_three' AND wait_event_type='Lock' AND query LIKE '%User%'")
    if (rows[0].count) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw Error('Expected actual User lock wait')
}
function routes(service) {
  const model = modelOf(service)
  const title = service[0].toUpperCase() + service.slice(1)
  const types = load(`src/lib/${service}/types.ts`)
  // Onboarding closes over this Prisma binding, not the route binding below.
  const accessDb = new Proxy(db, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key)
    return async (work, options) => target.$transaction(tx => work(new Proxy(tx, { get(transaction, field) {
      if (field !== model) return Reflect.get(transaction, field)
      return new Proxy(Reflect.get(transaction, field), { get(member, method) {
        if (method !== 'create') return Reflect.get(member, method)
        return async args => {
          if (beforeAccessMemberWrite) { const gate = beforeAccessMemberWrite; beforeAccessMemberWrite = null; gate.seen.resolve(); await gate.release.promise }
          return member.create(args)
        }
      } })
    } })), options)
  } })
  const common = {
    ...source, 'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => sessionUser ? { user: { id: sessionUser, email: sessionUser + '@example.invalid', name: 'Synthetic' } } : null },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: accessDb }, './types': types,
    [`@/lib/${service}/types`]: types,
  }
  const access = load(`src/lib/${service}/access.ts`, common)
  const routeDb = new Proxy(db, { get(target, key) {
    if (key === model) return new Proxy(Reflect.get(target, key), { get(member, method) {
      if (method !== 'findFirst') return Reflect.get(member, method)
      return async args => {
        const found = await member.findFirst(args)
        if (afterTargetDiscovery && args.where?.id) { const callback = afterTargetDiscovery; afterTargetDiscovery = null; await callback() }
        return found
      }
    } })
    if (key !== '$transaction') return Reflect.get(target, key)
    return async (work, options) => {
      scopeTransactionCount++
      if (beforeScopeTransaction && (typeof beforeScopeTransaction === 'function' || beforeScopeTransaction.when === scopeTransactionCount)) {
        const callback = typeof beforeScopeTransaction === 'function' ? beforeScopeTransaction : beforeScopeTransaction.work
        beforeScopeTransaction = null; await callback()
      }
      return target.$transaction(tx => work(new Proxy(tx, { get(transaction, field) {
        if (field === 'mensetsuOrganization' && service === 'mensetsu') return new Proxy(Reflect.get(transaction, field), { get(organization, method) {
          if (method !== 'update') return Reflect.get(organization, method)
          return async args => {
            if (beforeSettingWrite) { const gate = beforeSettingWrite; beforeSettingWrite = null; gate.seen.resolve(); await gate.release.promise }
            return organization.update(args)
          }
        } })
        if (field !== model) return Reflect.get(transaction, field)
        return new Proxy(Reflect.get(transaction, field), { get(member, method) {
          if (!['create', 'update', 'updateMany', 'delete', 'deleteMany'].includes(method)) return Reflect.get(member, method)
          return async args => {
            if (beforeMemberWrite?.method === method) { const gate = beforeMemberWrite; beforeMemberWrite = null; gate.seen.resolve(); await gate.release.promise }
            return member[method](args)
          }
        } })
      } })), options)
    }
  } })
  const routeCommon = { ...common, '@/lib/prisma': { prisma: routeDb }, [`@/lib/${service}/access`]: access }
  const organizations = load(`src/app/api/${service}/organizations/route.ts`, routeCommon)
  const members = load(`src/app/api/${service}/members/route.ts`, { ...routeCommon, '@/lib/email': { sendEmail: async () => { mailCalls++; return { success: true } } }, '@/lib/html-escape': { escapeHtml: value => value }, crypto })
  const mutation = load(`src/app/api/${service}/members/[id]/route.ts`, routeCommon)
  const invitation = load(`src/app/api/${service}/invite/[token]/route.ts`, routeCommon)
  const settings = service === 'mensetsu' ? load('src/app/api/mensetsu/organizations/settings/route.ts', routeCommon) : null
  const url = `/api/${service}`
  const request = (path, method, body) => new Request('https://example.invalid' + url + path + (path.startsWith('/invite/') ? '' : '?org=synthetic-three'), { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const post = (email = ids.recipient + '@example.invalid', role = 'member') => members.POST(request('/members', 'POST', { email, role }))
  const patch = (id, role = 'manager') => mutation.PATCH(request('/members/' + id, 'PATCH', { role }), { params: Promise.resolve({ id }) })
  const remove = id => mutation.DELETE(request('/members/' + id, 'DELETE'), { params: Promise.resolve({ id }) })
  const claim = token => invitation.POST(request('/invite/' + token, 'POST'), { params: Promise.resolve({ token }) })
  const create = name => organizations.POST(request('/organizations', 'POST', { name, memberName: 'Synthetic' }))
  const changeSettings = body => settings.PATCH(request('/organizations/settings', 'PATCH', body))
  return { access, post, patch, remove, claim, create, changeSettings }
}
;(async () => { try {
  await setup()
  for (const service of services) {
    const route = routes(service), member = db[modelOf(service)]
    await check(service, 'onboarding normal and reuse remain one owner', async () => {
      sessionUser = ids.target
      assert.equal((await route.create('Synthetic new')).status, 200)
      assert.equal((await route.create('Synthetic other')).status, 200)
      assert.equal(await member.count({ where: { userId: ids.target, role: 'owner', status: 'ACTIVE' } }), 1)
    })
    await check(service, 'retired User cannot create an owner membership', async () => {
      await retirement(ids.target); sessionUser = ids.target
      assert.equal((await route.create('Synthetic new')).status, 409)
      assert.equal(await member.count({ where: { userId: ids.target } }), 0)
    })
    await check(service, 'retirement-first onboarding waits for User lock and creates no org or owner', async () => {
      sessionUser = ids.target
      const orgBefore = await db[organizationOf(service)].count()
      const held = await heldRetirement(ids.target)
      const writing = route.create('Blocked new organization')
      await waitForUserLock()
      held.release(); await held.pending
      assert.equal((await writing).status, 409)
      assert.equal(await member.count({ where: { userId: ids.target } }), 0)
      assert.equal(await db[organizationOf(service)].count(), orgBefore)
    })
    await check(service, 'writer-first onboarding holds User lock through owner commit', async () => {
      sessionUser = ids.target
      const gate = { seen: defer(), release: defer() }
      beforeAccessMemberWrite = gate
      const orgBefore = await db[organizationOf(service)].count()
      const writing = route.create('Created before retirement')
      await gate.seen.promise
      const retiring = retirement(ids.target)
      await waitForUserLock()
      gate.release.resolve()
      assert.equal((await writing).status, 200)
      assert((await retiring).claim)
      assert.equal(await member.count({ where: { userId: ids.target, role: 'owner', status: 'ACTIVE' } }), 1)
      assert.equal(await db[organizationOf(service)].count(), orgBefore + 1)
    })
    await check(service, 'normal invitation remains PENDING and unbound; exact claim consumes once', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      assert.equal(pending.userId, null); assert.equal(mailCalls, 1)
      sessionUser = ids.recipient
      assert.equal((await route.claim(pending.inviteToken)).status, 200)
      const bound = await member.findUnique({ where: { id: pending.id } })
      assert.equal(bound.userId, ids.recipient); assert.equal(bound.status, 'ACTIVE'); assert.equal(bound.inviteToken, null)
      assert.notEqual((await route.claim(pending.inviteToken)).status, 200)
    })
    await check(service, 'actor and owner retirement deny invite without email', async () => {
      await retirement(ids.owner)
      assert.equal((await route.post()).status, 409)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 0); assert.equal(mailCalls, 0)
    })
    await check(service, 'retired actor cannot invite or modify a target', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      await retirement(ids.actor)
      assert.equal((await route.post()).status, 409)
      assert.equal((await route.patch('target_member')).status, 409)
      assert.equal((await route.remove('target_member')).status, 409)
      assert.equal(mailCalls, 0)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'member')
    })
    await check(service, 'registered recipient retirement denies invite and external delivery', async () => {
      await retirement(ids.recipient)
      assert.equal((await route.post()).status, 409)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 0)
      assert.equal(mailCalls, 0)
    })
    await check(service, 'claimant retirement denies pending invitation grant', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      await retirement(ids.recipient)
      sessionUser = ids.recipient
      assert.equal((await route.claim(pending.inviteToken)).status, 409)
      assert.equal(await member.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 0)
    })
    await check(service, 'legacy bound invitation cannot be transferred by email', async () => {
      const token = crypto.randomUUID()
      await member.create({ data: { id: 'bound_pending', organizationId: orgId, userId: ids.target, role: 'member', status: 'PENDING', inviteEmail: ids.recipient + '@example.invalid', inviteToken: token } })
      sessionUser = ids.recipient
      assert.equal((await route.claim(token)).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'bound_pending' } })).userId, ids.target)
    })
    await check(service, 'duplicate invitation does not disclose recipient retirement', async () => {
      assert.equal((await route.post()).status, 200)
      await retirement(ids.recipient)
      const duplicate = await route.post()
      assert.equal(duplicate.status, 409)
      assert.deepEqual(await duplicate.json(), { error: '既に招待済みです' })
      assert.equal(mailCalls, 1)
    })
    await check(service, 'expired bound legacy row cannot be erased by unbound reinvite', async () => {
      await member.create({ data: { id: 'bound_expired', organizationId: orgId, userId: ids.recipient, role: 'member', status: 'PENDING', inviteEmail: ids.recipient + '@example.invalid', inviteToken: crypto.randomUUID(), createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } })
      assert.equal((await route.post()).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'bound_expired' } })).userId, ids.recipient)
      assert.equal(mailCalls, 0)
    })
    await check(service, 'expired claim and concurrent claim never grant twice', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      sessionUser = ids.recipient
      await member.update({ where: { id: pending.id }, data: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } })
      assert.equal((await route.claim(pending.inviteToken)).status, 410)
      await member.update({ where: { id: pending.id }, data: { createdAt: new Date() } })
      const responses = await Promise.all([route.claim(pending.inviteToken), route.claim(pending.inviteToken)])
      assert.equal(responses.filter(response => response.status === 200).length, 1)
      assert.equal(await member.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 1)
    })
    await check(service, 'role edit and removal work for lower member; target fence denies change', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      assert.equal((await route.patch('target_member')).status, 200)
      await retirement(ids.target)
      assert.equal((await route.patch('target_member', 'member')).status, 409)
      assert.equal((await route.remove('target_member')).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'manager')
    })
    await check(service, 'ACTIVE lower-member DELETE succeeds without affecting owner', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      assert.equal((await route.remove('target_member')).status, 200)
      assert.equal(await member.count({ where: { id: 'target_member' } }), 0)
      assert.equal(await member.count({ where: { id: 'owner_member', role: 'owner', status: 'ACTIVE' } }), 1)
    })
    await check(service, 'null pending role edit stays unbound and cancel removes it', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      assert.equal((await route.patch(pending.id, 'manager')).status, 200)
      assert.equal((await member.findUnique({ where: { id: pending.id } })).userId, null)
      assert.equal((await route.remove(pending.id)).status, 200)
      assert.equal(await member.count({ where: { id: pending.id } }), 0)
    })
    await check(service, 'foreign target and self owner mutation fail closed', async () => {
      assert.equal((await route.patch('foreign_member')).status, 404)
      assert.notEqual((await route.remove('actor_member')).status, 200)
      assert.equal(await member.count({ where: { id: 'actor_member' } }), 1)
    })
    await check(service, 'target binding drift to a retiring User cannot grant changed role', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      await retirement(ids.foreign)
      afterTargetDiscovery = async () => { await member.update({ where: { id: 'target_member' }, data: { userId: ids.foreign } }) }
      assert.equal((await route.patch('target_member')).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'member')
    })
    await check(service, 'pending-to-ACTIVE target drift replans the newly bound User', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: null, role: 'member', status: 'PENDING', inviteEmail: ids.target + '@example.invalid', inviteToken: crypto.randomUUID() } })
      await retirement(ids.target)
      afterTargetDiscovery = async () => { await member.update({ where: { id: 'target_member' }, data: { userId: ids.target, status: 'ACTIVE', inviteToken: null } }) }
      assert.equal((await route.patch('target_member')).status, 409)
      const row = await member.findUnique({ where: { id: 'target_member' } })
      assert.equal(row.userId, ids.target); assert.equal(row.status, 'ACTIVE'); assert.equal(row.role, 'member')
    })
    await check(service, 'current owner drift to retiring User denies target mutation', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      await retirement(ids.foreign)
      beforeScopeTransaction = { when: 2, work: async () => { await member.update({ where: { id: 'owner_member' }, data: { userId: ids.foreign } }) } }
      assert.equal((await route.patch('target_member')).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'member')
    })
    await check(service, 'target role drift to owner denies lower-admin mutation', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      afterTargetDiscovery = async () => { await member.update({ where: { id: 'target_member' }, data: { role: 'owner' } }) }
      assert.notEqual((await route.patch('target_member', 'manager')).status, 200)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'owner')
    })
    await check(service, 'newly registered retired email recipient is rediscovered before invite', async () => {
      const email = 'new-recipient@example.invalid'
      beforeScopeTransaction = { when: 4, work: async () => {
        await db.user.create({ data: { id: 'new_recipient', email, plan: 'FREE' } })
        await retirement('new_recipient')
      } }
      assert.equal((await route.post(email)).status, 409)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 0)
      assert.equal(mailCalls, 0)
    })
    await check(service, 'unrelated checkout fence permits ordinary member invitation', async () => {
      assert((await store.reserveLifecycleOperation(db, identity(ids.actor, 'checkout'), digest)).claim)
      assert.equal((await route.post()).status, 200)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 1)
    })
    await check(service, 'malformed retirement fence refuses mutation', async () => {
      await retirement(ids.owner)
      await db.systemSetting.update({ where: { key: state.lifecycleFenceKey(ids.owner) }, data: { value: 'malformed' } })
      assert.equal((await route.post()).status, 409)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 0)
      assert.equal(mailCalls, 0)
    })
    await check(service, 'retirement-first User lock blocks invitation until fence commits', async () => {
      const held = await heldRetirement(ids.actor)
      const writing = route.post()
      await waitForUserLock()
      held.release()
      await held.pending
      assert.equal((await writing).status, 409)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 0); assert.equal(mailCalls, 0)
    })
    await check(service, 'writer-first pending invitation holds retirement User lock until commit', async () => {
      const gate = { seen: defer(), release: defer() }
      beforeMemberWrite = { ...gate, method: 'create' }
      const writing = route.post()
      await gate.seen.promise
      const retiring = retirement(ids.actor)
      await waitForUserLock()
      gate.release.resolve()
      assert.equal((await writing).status, 200)
      assert((await retiring).claim)
      assert.equal(await member.count({ where: { status: 'PENDING' } }), 1); assert.equal(mailCalls, 1)
    })
    await check(service, 'retirement-first claimant lock prevents delayed grant', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      sessionUser = ids.recipient
      const held = await heldRetirement(ids.recipient)
      const writing = route.claim(pending.inviteToken)
      await waitForUserLock()
      held.release()
      await held.pending
      assert.equal((await writing).status, 409)
      assert.equal(await member.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 0)
    })
    await check(service, 'writer-first claim holds claimant User lock until grant commits', async () => {
      assert.equal((await route.post()).status, 200)
      const pending = await member.findFirst({ where: { status: 'PENDING' } })
      sessionUser = ids.recipient
      const gate = { seen: defer(), release: defer() }
      beforeMemberWrite = { ...gate, method: 'updateMany' }
      const writing = route.claim(pending.inviteToken)
      await gate.seen.promise
      const retiring = retirement(ids.recipient)
      await waitForUserLock()
      gate.release.resolve()
      assert.equal((await writing).status, 200)
      assert((await retiring).claim)
      assert.equal(await member.count({ where: { userId: ids.recipient, status: 'ACTIVE' } }), 1)
    })
    await check(service, 'writer-first role update holds target User lock before retirement', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      const gate = { seen: defer(), release: defer() }
      beforeMemberWrite = { ...gate, method: 'update' }
      const writing = route.patch('target_member')
      await gate.seen.promise
      const retiring = retirement(ids.target)
      await waitForUserLock()
      gate.release.resolve()
      assert.equal((await writing).status, 200)
      assert((await retiring).claim)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'manager')
    })
    await check(service, 'retirement-first target User lock denies role update', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      const held = await heldRetirement(ids.target)
      const writing = route.patch('target_member')
      await waitForUserLock()
      held.release()
      await held.pending
      assert.equal((await writing).status, 409)
      assert.equal((await member.findUnique({ where: { id: 'target_member' } })).role, 'member')
    })
    await check(service, 'writer-first ACTIVE DELETE holds target User lock through removal', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      const gate = { seen: defer(), release: defer() }
      beforeMemberWrite = { ...gate, method: 'delete' }
      const writing = route.remove('target_member')
      await gate.seen.promise
      const retiring = retirement(ids.target)
      await waitForUserLock()
      gate.release.resolve()
      assert.equal((await writing).status, 200)
      assert((await retiring).claim)
      assert.equal(await member.count({ where: { id: 'target_member' } }), 0)
    })
    await check(service, 'retirement-first ACTIVE DELETE cannot remove target', async () => {
      await member.create({ data: { id: 'target_member', organizationId: orgId, userId: ids.target, role: 'member', status: 'ACTIVE' } })
      const held = await heldRetirement(ids.target)
      const writing = route.remove('target_member')
      await waitForUserLock()
      held.release(); await held.pending
      assert.equal((await writing).status, 409)
      assert.equal(await member.count({ where: { id: 'target_member', status: 'ACTIVE' } }), 1)
    })
    if (service === 'mensetsu') {
      await check(service, 'settings honors current admin and existing fields', async () => {
        const response = await route.changeSettings({ recordAudio: true, discloseToCandidate: false, retentionDays: 2000, recordVideo: true })
        assert.equal(response.status, 200)
        const org = await db.mensetsuOrganization.findUnique({ where: { id: orgId } })
        assert.equal(org.recordAudio, true); assert.equal(org.discloseToCandidate, false); assert.equal(org.retentionDays, 1095)
      })
      await check(service, 'settings denies retired current owner without mutation', async () => {
        await retirement(ids.owner)
        assert.equal((await route.changeSettings({ recordAudio: true })).status, 409)
        assert.equal((await db.mensetsuOrganization.findUnique({ where: { id: orgId } })).recordAudio, false)
      })
      await check(service, 'settings rechecks actor after downgrade between context and transaction', async () => {
        beforeScopeTransaction = async () => { await member.update({ where: { id: 'actor_member' }, data: { role: 'member' } }) }
        assert.equal((await route.changeSettings({ recordAudio: true })).status, 403)
        assert.equal((await db.mensetsuOrganization.findUnique({ where: { id: orgId } })).recordAudio, false)
      })
      await check(service, 'settings retirement-first actor User lock denies stale update', async () => {
        const held = await heldRetirement(ids.actor)
        const writing = route.changeSettings({ recordAudio: true })
        await waitForUserLock()
        held.release()
        await held.pending
        assert.equal((await writing).status, 409)
        assert.equal((await db.mensetsuOrganization.findUnique({ where: { id: orgId } })).recordAudio, false)
      })
      await check(service, 'settings writer-first update holds actor User lock until commit', async () => {
        const gate = { seen: defer(), release: defer() }
        beforeSettingWrite = gate
        const writing = route.changeSettings({ recordAudio: true })
        await gate.seen.promise
        const retiring = retirement(ids.actor)
        await waitForUserLock()
        gate.release.resolve()
        assert.equal((await writing).status, 200)
        assert((await retiring).claim)
        assert.equal((await db.mensetsuOrganization.findUnique({ where: { id: orgId } })).recordAudio, true)
      })
    }
  }
  const files = ['src/lib/account-lifecycle/store.ts', 'src/lib/account-lifecycle/organization-fence.ts', ...services.flatMap(s => [`src/lib/${s}/access.ts`, `src/app/api/${s}/organizations/route.ts`, `src/app/api/${s}/members/route.ts`, `src/app/api/${s}/members/[id]/route.ts`, `src/app/api/${s}/invite/[token]/route.ts`]), 'src/app/api/mensetsu/organizations/settings/route.ts', 'scripts/security-regression/verify-r1-three-membership-postgres.cjs', 'scripts/security-regression/verify-r1-three-membership-postgres.py']
  console.log(JSON.stringify({ passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])), scope: 'Actual Quote/Mensetsu/Aishodan routes and store with owned private PostgreSQL; synthetic session/mail only; no production, provider or real email' }, null, 2))
} finally { clearTimeout(watchdog); await db.$disconnect() } })().catch(error => { console.error(error); process.exitCode = 1 })
