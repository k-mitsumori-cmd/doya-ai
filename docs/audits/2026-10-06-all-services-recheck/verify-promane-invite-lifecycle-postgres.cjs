process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
// The supervisor freezes the exact phase inputs before PostgreSQL startup. Verify
// them again before the first project module or generated client is loaded.
const sourceLockPath = process.env.DOYA_PROMANE_INVITE_SOURCE_LOCK
assert(sourceLockPath && path.isAbsolute(sourceLockPath), 'Phase source lock is required')
const sourceLockBytes = fs.readFileSync(sourceLockPath)
const sourceLockSha256 = crypto.createHash('sha256').update(sourceLockBytes).digest('hex')
const sourceLock = JSON.parse(sourceLockBytes.toString('utf8'))
assert.equal(sourceLock.phase, process.env.DOYA_PROMANE_INVITE_EXPECT)
assert(Array.isArray(sourceLock.loadedSourcePaths) && Array.isArray(sourceLock.generatedInputs))
const inputNames = [...sourceLock.loadedSourcePaths, ...sourceLock.generatedInputs]
assert.equal(new Set(inputNames).size, inputNames.length)
assert.deepEqual(Object.keys(sourceLock.sourceHashes).sort(), [...inputNames].sort())
const hashInputs = () => Object.fromEntries(inputNames.map(name =>
  [name, crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')]))
const inputHashesAtStart = hashInputs()
assert.deepEqual(inputHashesAtStart, sourceLock.sourceHashes, 'Inputs changed before first require/load')
const { Prisma, PrismaClient } = require('@prisma/client')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')

// Reuse the repository's existing private-socket DMMF table builder, never an external DB.
const prefixFile = 'docs/audits/2026-10-06-all-services-recheck/verify-adimage-operation-postgres.cjs'
const prefixOriginal = fs.readFileSync(prefixFile, 'utf8')
assert.equal(prefixOriginal.split('async function makeBudget()').length, 2, 'Exact private PG builder boundary')
assert.equal(prefixOriginal.split("'AdImageFeedback']").length, 2, 'Exact DMMF model-list insertion')
const source = prefixOriginal.split('async function makeBudget()')[0]
  .replace("'AdImageFeedback']", "'AdImageFeedback','PromaneWorkspace','PromaneMember','PromaneInvitation']")
const { db, setupDb } = new Function('require', '__dirname', source + '\nreturn { db, setupDb }')(
  createRequire(path.resolve(prefixFile)), path.dirname(path.resolve(prefixFile)))
const socket = process.env.DOYA_SFA_AUTHORITY_PG_SOCKET
const port = Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT)
assert.match(socket || '', /^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/)
assert(port > 1024 && port < 65536)
const db2 = new PrismaClient({ datasources: { db: { url: `postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=adimage_lost_ack_fixture` } } })
const db3 = new PrismaClient({ datasources: { db: { url: `postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=adimage_lost_ack_fixture` } } })
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const retirement = load('src/lib/account-retirement.ts', { '@prisma/client': { Prisma } })
const cases = [], observed = [], waits = []
const now = () => new Date().toISOString()
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const bounded = async (promise, label) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Timeout: ' + label)), 12000) })]) } finally { clearTimeout(timer) } }
const digest = crypto.createHash('sha256').update('synthetic Promane invitation admission').digest('hex')
const identity = id => ({ operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: id, operationId: crypto.randomUUID(), kind: 'retirement' })
async function billingFence(userId) {
  const operationId = crypto.randomUUID(), generation = crypto.randomUUID(), token = crypto.randomUUID()
  const principal = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId, operationId, kind: 'checkout' }
  const timestamp = now()
  const receipt = { version: 2, targetHash: state.lifecycleSubject(userId), operationId, operator: principal.operator,
    kind: 'checkout', inputDigest: 'a'.repeat(64), generation, token, revision: 0, phase: 'reserved', reason: null,
    createdAt: timestamp, updatedAt: timestamp }
  await db.systemSetting.createMany({ data: [
    { key: state.lifecycleReceiptKey(principal), value: JSON.stringify(receipt) },
    { key: state.lifecycleFenceKey(userId), value: JSON.stringify({ version: 2, operationId, generation, kind: 'checkout', state: 'active' }) },
  ] })
}

async function reset(withInvite, withRecipient = true, ownerPlan = 'PRO') {
  await db.$executeRawUnsafe('TRUNCATE "User", "SystemSetting", promane_workspaces CASCADE')
  await db.$executeRawUnsafe('INSERT INTO "User" (id,plan,name,email) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
    'owner', ownerPlan, 'Owner', 'owner@example.test', 'admin', 'PRO', 'Admin', 'admin@example.test')
  if (withRecipient) await db.$executeRawUnsafe('INSERT INTO "User" (id,plan,name,email) VALUES ($1,$2,$3,$4)',
    'recipient', 'PRO', 'Recipient', 'recipient@example.test')
  await db.promaneWorkspace.create({ data: { id: 'ws', userId: 'owner', name: 'Team', slug: 'team' } })
  await db.promaneMember.createMany({ data: [
    { id: 'owner-member', workspaceId: 'ws', userId: 'owner', role: 'owner', displayName: 'Owner' },
    { id: 'admin-member', workspaceId: 'ws', userId: 'admin', role: 'admin', displayName: 'Admin' },
  ] })
  if (withInvite) await db.promaneInvitation.create({ data: { id: 'invite', workspaceId: 'ws', email: 'recipient@example.test', role: 'guest', token: 'synthetic-token', invitedById: 'admin', expiresAt: new Date(Date.now() + 600000) } })
}
async function setup() {
  await setupDb()
  const retirementModels = require('../../../scripts/security-regression/retirement-fixture.cjs').retirementModels
    .filter(name => !['PromaneWorkspace', 'PromaneMember', 'PromaneInvitation'].includes(name))
  const quote = value => '"' + value.replaceAll('"', '""') + '"'
  for (const name of retirementModels) {
    const model = Prisma.dmmf.datamodel.models.find(row => row.name === name)
    assert(model, name)
    const columns = model.fields.filter(field => field.kind !== 'object').map(field => {
      const type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      const defaultValue = field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now') ? ' DEFAULT CURRENT_TIMESTAMP'
        : field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default) ? ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default)) : ''
      return quote(field.dbName || field.name) + ' ' + type + (field.isList ? '[]' : '') + (field.isRequired ? ' NOT NULL' : '') + defaultValue + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + columns.join(',') + ')')
  }
  await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN name TEXT, ADD COLUMN email TEXT UNIQUE')
  await db.$executeRawUnsafe('ALTER TABLE promane_workspaces ADD FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE promane_members ADD FOREIGN KEY ("workspaceId") REFERENCES promane_workspaces(id) ON DELETE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE promane_members ADD FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE promane_invitations ADD FOREIGN KEY ("workspaceId") REFERENCES promane_workspaces(id) ON DELETE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE promane_invitations ADD FOREIGN KEY ("invitedById") REFERENCES "User"(id) ON DELETE CASCADE')
}
function actualApi(client, delivery, options = {}) {
  const planUtils = load('src/lib/plan-utils.ts')
  const limits = load('src/lib/promane/limits.ts', { '@/lib/prisma': { prisma: client }, '@/lib/plan-utils': planUtils })
  const helper = load('src/lib/promane/invite-admission.ts', {
    '@prisma/client': { Prisma }, crypto, '@/lib/prisma': { prisma: client }, '@/lib/promane/limits': limits,
    '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state,
  }, options.clock ? { Date: options.clock } : {})
  const privateResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } })
  const common = { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: options.acceptUserId || 'recipient', email: options.acceptEmail || 'recipient@example.test', name: 'Recipient' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: client }, '@/lib/promane/invite-admission': helper,
    '@/lib/private-api-response': privateResponse,
    '@/lib/email': { sendEmail: async () => { delivery.calls++; return { success: true } } } }
  const accept = load('src/app/api/promane/invite/[token]/route.ts', common)
  const issue = load('src/app/api/promane/invite/route.ts', { ...common,
    'next-auth': { getServerSession: async () => ({ user: { id: options.issueActorId || 'admin', email: 'admin@example.test' } }) } })
  return {
    accept: (token = 'synthetic-token') => accept.POST(new Request('https://synthetic.test/api/promane/invite/' + encodeURIComponent(token), { method: 'POST' }), { params: Promise.resolve({ token }) }),
    issue: (email = 'recipient@example.test', workspaceId = 'ws', role = 'guest') => issue.POST(new Request('https://synthetic.test/api/promane/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId, email, role }) })),
  }
}
function pausedAdmission(client, delivery) {
  const entered = deferred(), release = deferred()
  let held = false
  const gated = {
    $transaction: (work, options) => client.$transaction(tx => work(new Proxy(tx, {
      get(target, key) {
        if (key !== '$queryRaw') return target[key]
        return async query => {
          const result = await target.$queryRaw(query)
          if (!held && query.strings?.join('').includes('FROM "User"')) {
            held = true
            entered.resolve((await target.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
            await bounded(release.promise, 'paused admission release')
          }
          return result
        }
      },
    })), options),
    user: client.user,
  }
  return { api: actualApi(gated, delivery), entered: entered.promise, release: release.resolve }
}
async function snapshot() {
  return { members: await db.promaneMember.count({ where: { userId: 'recipient' } }),
    invites: await db.promaneInvitation.count(),
    acceptedAt: (await db.promaneInvitation.findUnique({ where: { id: 'invite' }, select: { acceptedAt: true } }))?.acceptedAt?.toISOString() || null,
    settings: await db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } }) }
}
async function waitForUserLock(holderPid, label) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, wait_event_type AS "waitType", pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = $1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes('"User"'))
    if (blocked) { waits.push({ label, holderPid, waiterPid: blocked.pid, waitType: blocked.waitType, blockedByHolder: true }); return }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual User lock waiter: ' + label)
}
async function check(label, work) { await work(); cases.push(label); console.log('PASS ' + label) }

;(async () => {
  try {
    await setup()
    const phase = process.env.DOYA_PROMANE_INVITE_EXPECT
    const before = phase === 'before', serializable = phase === 'serializable'
    assert(['before', 'serializable', 'after'].includes(phase))
    if (!serializable) {
    await check('recipient retirement completed before accept POST', async () => {
      await reset(true)
      await store.reserveLifecycleOperation(db, identity('recipient'), digest)
      const prior = await snapshot(), delivery = { calls: 0 }, response = await actualApi(db2, delivery).accept()
      const body = await response.json(), after = await snapshot()
      if (before) { assert.equal(response.status, 200); assert.equal(after.members, 1); assert.ok(after.acceptedAt) }
      else { assert.equal(response.status, 409); assert.equal(body.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS'); assert.equal(after.members, 0); assert.equal(after.acceptedAt, null); assert.deepEqual(after.settings, prior.settings) }
      assert.equal(delivery.calls, 0)
      observed.push({ label: 'accept', status: response.status, code: body.code || null, before: prior, after, syntheticDeliveries: delivery.calls })
    })
    await check('actor retirement completed before issue POST', async () => {
      await reset(false)
      await store.reserveLifecycleOperation(db, identity('admin'), digest)
      const prior = await snapshot(), delivery = { calls: 0 }, response = await actualApi(db2, delivery).issue()
      const body = await response.json(), after = await snapshot()
      if (before) { assert.equal(response.status, 200); assert.equal(after.invites, 1); assert.equal(delivery.calls, 1) }
      else { assert.equal(response.status, 409); assert.equal(body.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS'); assert.equal(after.invites, 0); assert.equal(delivery.calls, 0); assert.deepEqual(after.settings, prior.settings) }
      observed.push({ label: 'issue', status: response.status, code: body.code || null, before: prior, after, syntheticDeliveries: delivery.calls })
    })
    }
    if (!before && !serializable) {
      await check('retirement-first User lock waits then accept rejects', async () => {
        await reset(true)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          const pid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
          const claim = await store.reserveLifecycleOperation({ $transaction: work => work(tx) }, identity('recipient'), digest)
          assert(claim)
          entered.resolve(pid)
          await bounded(release.promise, 'retirement holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'retirement holder enter')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).accept()
        try { await waitForUserLock(holderPid, 'retirement-first accept') } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'waiting accept')
        assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        assert.equal((await snapshot()).members, 0); assert.equal(delivery.calls, 0)
      })
      await check('recipient retirement-first User lock waits then issue rejects without delivery', async () => {
        await reset(false)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          const pid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
          await store.reserveLifecycleOperation({ $transaction: work => work(tx) }, identity('recipient'), digest)
          entered.resolve(pid)
          await bounded(release.promise, 'recipient retirement holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'recipient retirement holder enter')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).issue()
        try { await waitForUserLock(holderPid, 'recipient retirement-first issue') } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'waiting issue')
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        assert.equal((await snapshot()).invites, 0); assert.equal(delivery.calls, 0)
      })
      await check('issue-first recipient User lock lets later retirement reserve, then accept rejects', async () => {
        await reset(false)
        const delivery = { calls: 0 }, first = pausedAdmission(db2, delivery)
        const issue = first.api.issue()
        const holderPid = await bounded(first.entered, 'issue-first User lock')
        const reservation = store.reserveLifecycleOperation(db3, identity('recipient'), digest)
        try { await waitForUserLock(holderPid, 'issue-first retirement reservation') } finally { first.release() }
        const response = await bounded(issue, 'issue-first invitation commit')
        assert.equal(response.status, 200)
        await bounded(reservation, 'issue-first retirement commit')
        const afterIssue = await snapshot()
        assert.equal(afterIssue.invites, 1); assert.equal(delivery.calls, 1)
        const issued = await db.promaneInvitation.findFirst({ where: { workspaceId: 'ws', email: 'recipient@example.test' }, select: { id: true, token: true, acceptedAt: true } })
        assert(issued?.token); assert.equal(issued.acceptedAt, null)
        const acceptance = await actualApi(db2, delivery).accept(issued.token)
        assert.equal(acceptance.status, 409)
        assert.equal((await acceptance.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        const after = await snapshot()
        assert.equal(after.members, 0)
        const savedIssued = await db.promaneInvitation.findUnique({ where: { id: issued.id }, select: { token: true, acceptedAt: true } })
        assert.equal(savedIssued?.token, issued.token); assert.equal(savedIssued.acceptedAt, null)
        assert.deepEqual(after.settings, afterIssue.settings)
        observed.push({ label: 'issue-first retirement reservation', issueStatus: response.status,
          acceptStatus: acceptance.status, invitationCount: after.invites, memberCount: after.members,
          syntheticDeliveries: delivery.calls })
      })
      await check('writer-first User lock makes retirement preflight see new member', async () => {
        await reset(true)
        const entered = deferred(), release = deferred()
        const gated = { $transaction: (work, options) => db2.$transaction(tx => work(new Proxy(tx, {
          get(target, key) {
            if (key !== '$queryRaw') return target[key]
            return async query => {
              const result = await target.$queryRaw(query)
              if (query.strings?.join('').includes('FROM "User"')) {
                entered.resolve((await target.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
                await bounded(release.promise, 'writer holder release')
              }
              return result
            }
          },
        })), options), user: db2.user }
        const delivery = { calls: 0 }, writer = actualApi(gated, delivery).accept()
        const holderPid = await bounded(entered.promise, 'writer User lock')
        const preflight = retirement.checkAccountRetirementSafe(db, 'recipient').then(() => ({ ok: true }), error => ({ ok: false, code: error.code }))
        try { await waitForUserLock(holderPid, 'writer-first preflight') } finally { release.resolve() }
        const response = await bounded(writer, 'writer accept')
        assert.equal(response.status, 200)
        const checked = await bounded(preflight, 'waiting retirement preflight')
        assert.equal(checked.ok, false); assert.equal(checked.code, 'ACCOUNT_RETIREMENT_BLOCKED')
        assert.equal((await snapshot()).members, 1); assert.equal(delivery.calls, 0)
      })
    }
    if (!before) {
      await check('unregistered recipient appears while issue waits on owner lock', async () => {
        await reset(false, false)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          const pid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve(pid)
          await bounded(release.promise, 'owner holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'owner holder enter')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).issue()
        try {
          await waitForUserLock(holderPid, 'unregistered recipient issue')
          await db.$executeRawUnsafe('INSERT INTO "User" (id,plan,name,email) VALUES ($1,$2,$3,$4)',
            'recipient', 'PRO', 'Recipient', 'recipient@example.test')
          await store.reserveLifecycleOperation(db, identity('recipient'), digest)
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'waiting issue with newly retired recipient')
        const body = await response.json(), after = await snapshot()
        console.log(JSON.stringify({ phantomCase: true, status: response.status, code: body.code || null,
          invitationCount: after.invites, syntheticDeliveries: delivery.calls }))
        observed.push({ label: 'unregistered recipient phantom', status: response.status, code: body.code || null,
          invitationCount: after.invites, syntheticDeliveries: delivery.calls })
        if (serializable) {
          assert.equal(response.status, 200); assert.equal(after.invites, 1); assert.equal(delivery.calls, 1)
        } else {
          assert.equal(response.status, 409); assert.equal(body.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
          assert.equal(after.invites, 0); assert.equal(delivery.calls, 0)
        }
      })
    }
    if (!before && !serializable) {
      await check('foreign email cannot accept or consume invitation', async () => {
        await reset(true)
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery, { acceptEmail: 'foreign@example.test' }).accept()
        assert.equal(response.status, 403)
        assert.equal((await response.json()).code, 'email_mismatch')
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      for (const mode of ['accept', 'issue']) await check(mode + ' rejects malformed lifecycle metadata without writes', async () => {
        await reset(mode === 'accept')
        const subject = mode === 'accept' ? 'recipient' : 'admin'
        await db.systemSetting.create({ data: { key: state.lifecycleFenceKey(subject), value: '{broken' } })
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery)[mode]()
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'LIFECYCLE_STATE_UNAVAILABLE')
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      for (const mode of ['accept', 'issue']) await check(mode + ' permits an unrelated billing-only fence', async () => {
        await reset(mode === 'accept')
        await billingFence(mode === 'accept' ? 'recipient' : 'admin')
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery)[mode]()
        assert.equal(response.status, 200)
        assert.equal((await response.json()).success, true)
        const after = await snapshot()
        assert.deepEqual(after.settings, prior.settings)
        assert.equal(after.members, mode === 'accept' ? 1 : 0)
        assert.equal(after.invites, 1)
        assert.equal(delivery.calls, mode === 'issue' ? 1 : 0)
      })
      await check('foreign workspace cannot issue invitation', async () => {
        await reset(false)
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery).issue('recipient@example.test', 'foreign')
        assert.equal(response.status, 403)
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      await check('different role never reuses existing active invitation', async () => {
        await reset(true)
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery).issue('recipient@example.test', 'ws', 'member')
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'PROMANE_INVITE_ROLE_CONFLICT')
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      await check('inactive existing membership is never revived or accepted', async () => {
        await reset(true)
        await db.promaneMember.create({ data: { id: 'recipient-inactive', workspaceId: 'ws', userId: 'recipient', role: 'member', displayName: 'Recipient', isActive: false } })
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery).accept()
        assert.equal(response.status, 403)
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      await check('active existing member keeps role while consuming invitation', async () => {
        await reset(true)
        await db.promaneMember.create({ data: { id: 'recipient-active', workspaceId: 'ws', userId: 'recipient', role: 'member', displayName: 'Recipient' } })
        const delivery = { calls: 0 }, response = await actualApi(db2, delivery).accept()
        assert.equal(response.status, 200)
        assert.equal((await response.json()).alreadyMember, true)
        assert.equal((await db.promaneMember.findUnique({ where: { id: 'recipient-active' } })).role, 'member')
        const after = await snapshot()
        assert.equal(after.members, 1); assert.ok(after.acceptedAt); assert.equal(delivery.calls, 0)
      })
      await check('expired invitation cannot grant or consume a seat', async () => {
        await reset(true)
        await db.promaneInvitation.update({ where: { id: 'invite' }, data: { expiresAt: new Date(Date.now() - 1000) } })
        const prior = await snapshot(), delivery = { calls: 0 }
        const response = await actualApi(db2, delivery).accept()
        assert.equal(response.status, 410)
        assert.equal((await response.json()).code, 'PROMANE_INVITE_EXPIRED')
        assert.deepEqual(await snapshot(), prior); assert.equal(delivery.calls, 0)
      })
      await check('expiry after actual member insert rolls back member and acceptedAt', async () => {
        await reset(true)
        const prior = await snapshot(), delivery = { calls: 0 }
        let advanced = false, memberCreateCalls = 0
        class FixtureDate extends Date {
          constructor(...args) { super(...(args.length ? args : [Date.now() + (advanced ? 3600000 : 0)])) }
          static now() { return Date.now() + (advanced ? 3600000 : 0) }
        }
        const gated = {
          $transaction: (work, options) => db2.$transaction(tx => work(new Proxy(tx, {
            get(target, key) {
              if (key !== 'promaneMember') return target[key]
              return new Proxy(target.promaneMember, {
                get(model, operation) {
                  if (operation !== 'create') return model[operation]
                  return async args => {
                    const inserted = await model.create(args)
                    memberCreateCalls++
                    advanced = true
                    return inserted
                  }
                },
              })
            },
          })), options), user: db2.user,
        }
        const response = await actualApi(gated, delivery, { clock: FixtureDate }).accept()
        assert.equal(response.status, 410)
        assert.equal((await response.json()).code, 'PROMANE_INVITE_EXPIRED')
        assert.equal(memberCreateCalls, 1)
        assert.deepEqual(await snapshot(), prior)
        assert.equal(delivery.calls, 0)
      })
      for (const drift of [
        { label: 'email', data: { email: 'foreign@example.test' }, status: 403, code: 'email_mismatch' },
        { label: 'role', data: { role: 'owner' }, status: 404, code: null },
        { label: 'acceptedAt', data: { acceptedAt: new Date() }, status: 410, code: 'PROMANE_INVITE_ACCEPTED' },
        { label: 'expiry', data: { expiresAt: new Date(Date.now() - 1000) }, status: 410, code: 'PROMANE_INVITE_EXPIRED' },
        { label: 'token', data: { token: 'replaced-token' }, status: 404, code: null },
      ]) await check('invitation ' + drift.label + ' changes while accept waits on User', async () => {
        await reset(true)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'invitation drift holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'invitation drift owner lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).accept()
        try {
          await waitForUserLock(holderPid, 'invitation ' + drift.label + ' drift')
          await db.promaneInvitation.update({ where: { id: 'invite' }, data: drift.data })
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'invitation drift accept')
        assert.equal(response.status, drift.status)
        if (drift.code) assert.equal((await response.json()).code, drift.code)
        const after = await snapshot()
        assert.equal(after.members, 0); assert.equal(after.acceptedAt === null, drift.label !== 'acceptedAt')
        assert.equal(delivery.calls, 0)
      })
      await check('inviter role changes while issue waits on owner User', async () => {
        await reset(false, false)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'role drift holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'role drift owner lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).issue()
        try {
          await waitForUserLock(holderPid, 'inviter role drift')
          await db.promaneMember.update({ where: { id: 'admin-member' }, data: { role: 'guest' } })
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'role drift issue')
        assert.equal(response.status, 403)
        assert.equal((await snapshot()).invites, 0); assert.equal(delivery.calls, 0)
      })
      await check('inviter becomes inactive while issue waits on owner User', async () => {
        await reset(false, false)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'inactive inviter holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'inactive inviter original lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).issue()
        try {
          await waitForUserLock(holderPid, 'inviter active drift')
          await db.promaneMember.update({ where: { id: 'admin-member' }, data: { isActive: false } })
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'inactive inviter issue')
        assert.equal(response.status, 403)
        assert.equal((await snapshot()).invites, 0); assert.equal(delivery.calls, 0)
      })
      await check('workspace owner changes to retiring User while issue waits', async () => {
        await reset(false)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'owner drift holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'owner drift original lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).issue()
        try {
          await waitForUserLock(holderPid, 'workspace owner drift')
          await db.promaneWorkspace.update({ where: { id: 'ws' }, data: { userId: 'recipient' } })
          await store.reserveLifecycleOperation(db, identity('recipient'), digest)
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'owner drift issue')
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        assert.equal((await snapshot()).invites, 0); assert.equal(delivery.calls, 0)
      })
      await check('recipient account email drift while accept waits rejects grant', async () => {
        await reset(true)
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'recipient email holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'recipient email owner lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).accept()
        try {
          await waitForUserLock(holderPid, 'recipient account email drift')
          await db.user.update({ where: { id: 'recipient' }, data: { email: 'changed@example.test' } })
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'recipient account email drift accept')
        assert.equal(response.status, 403)
        assert.equal((await response.json()).code, 'email_mismatch')
        const after = await snapshot()
        assert.equal(after.members, 0); assert.equal(after.acceptedAt, null); assert.equal(delivery.calls, 0)
      })
      await check('invitation workspace drift replans onto the current owned workspace', async () => {
        await reset(true)
        await db.promaneWorkspace.create({ data: { id: 'ws2', userId: 'owner', name: 'New team', slug: 'new-team' } })
        const entered = deferred(), release = deferred()
        const holder = db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${'owner'} FOR UPDATE`
          entered.resolve((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
          await bounded(release.promise, 'workspace drift holder release')
        }, { maxWait: 10000, timeout: 30000 })
        const holderPid = await bounded(entered.promise, 'workspace drift owner lock')
        const delivery = { calls: 0 }, writer = actualApi(db2, delivery).accept()
        try {
          await waitForUserLock(holderPid, 'invitation workspace drift')
          await db.promaneInvitation.update({ where: { id: 'invite' }, data: { workspaceId: 'ws2' } })
        } finally { release.resolve() }
        await holder
        const response = await bounded(writer, 'workspace drift accept')
        assert.equal(response.status, 200)
        assert.equal((await response.json()).workspaceSlug, 'new-team')
        assert.equal(await db.promaneMember.count({ where: { workspaceId: 'ws', userId: 'recipient' } }), 0)
        assert.equal(await db.promaneMember.count({ where: { workspaceId: 'ws2', userId: 'recipient' } }), 1)
        assert.equal(delivery.calls, 0)
      })
      await check('two connections issuing same email commit one invitation and one delivery', async () => {
        await reset(false, false)
        const delivery = { calls: 0 }
        const first = pausedAdmission(db2, delivery), firstReply = first.api.issue()
        const holderPid = await bounded(first.entered, 'same-email first User lock')
        const secondReply = actualApi(db3, delivery).issue()
        try { await waitForUserLock(holderPid, 'same-email issue') } finally { first.release() }
        const replies = await bounded(Promise.all([firstReply, secondReply]), 'same-email issue pair')
        const bodies = await Promise.all(replies.map(reply => reply.json()))
        assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 200])
        assert.equal(bodies.filter(body => body.reused === true).length, 1)
        assert.equal((await snapshot()).invites, 1)
        assert.equal(delivery.calls, 1)
        observed.push({ label: 'same-email issue pair', statuses: replies.map(reply => reply.status), reused: bodies.map(body => body.reused === true), invitationCount: 1, syntheticDeliveries: delivery.calls })
      })
      await check('two connections compete for final pending seat', async () => {
        await reset(false, false, 'FREE')
        const delivery = { calls: 0 }
        const first = pausedAdmission(db2, delivery), firstReply = first.api.issue('recipient@example.test')
        const holderPid = await bounded(first.entered, 'last-seat first User lock')
        const secondReply = actualApi(db3, delivery).issue('other@example.test')
        try { await waitForUserLock(holderPid, 'last-seat issue') } finally { first.release() }
        const replies = await bounded(Promise.all([firstReply, secondReply]), 'last-seat issue pair')
        const bodies = await Promise.all(replies.map(reply => reply.json()))
        assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 403])
        assert.equal(bodies.filter(body => body.code === 'PROMANE_MEMBER_LIMIT_REACHED').length, 1)
        assert.equal((await snapshot()).invites, 1)
        assert.equal(delivery.calls, 1)
        observed.push({ label: 'last-seat issue pair', statuses: replies.map(reply => reply.status), codes: bodies.map(body => body.code || null), invitationCount: 1, syntheticDeliveries: delivery.calls })
      })
      await check('two connections accept same token once', async () => {
        await reset(true)
        const delivery = { calls: 0 }
        const first = pausedAdmission(db2, delivery), firstReply = first.api.accept()
        const holderPid = await bounded(first.entered, 'same-token first User lock')
        const secondReply = actualApi(db3, delivery).accept()
        try { await waitForUserLock(holderPid, 'same-token accept') } finally { first.release() }
        const replies = await bounded(Promise.all([firstReply, secondReply]), 'same-token accept pair')
        const bodies = await Promise.all(replies.map(reply => reply.json()))
        assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 410])
        assert.equal(bodies.filter(body => body.code === 'PROMANE_INVITE_ACCEPTED').length, 1)
        const after = await snapshot()
        assert.equal(after.members, 1); assert.ok(after.acceptedAt); assert.equal(delivery.calls, 0)
        observed.push({ label: 'same-token accept pair', statuses: replies.map(reply => reply.status), memberCount: after.members, acceptedAt: after.acceptedAt })
      })
    }
    const closureFile = 'scripts/security-regression/fixtures/promane-invite-r1-66a/closure.json'
    const closure = JSON.parse(fs.readFileSync(closureFile, 'utf8'))
    assert.equal(closure.baseCommit, '66a60eee39f06fed34abdbcc24ab3468f3563eb7')
    assert.equal(Object.keys(closure.entries).length, 18)
    const baseline = process.env.DOYA_TEST_BASELINE
    const sourcePaths = [...Object.keys(closure.entries), closureFile,
      'scripts/security-regression/fixtures/promane-invite-r1-66a/manifest.json',
      'scripts/security-regression/fixtures/promane-invite-r1-serializable/manifest.json',
      'docs/audits/2026-10-06-all-services-recheck/verify-promane-invite-lifecycle-postgres.cjs',
      'docs/audits/2026-10-06-all-services-recheck/promane-invite-lifecycle-postgres-supervise.py']
    const actualSourcePaths = sourcePaths.map(name => baseline && fs.existsSync(path.join(baseline, name)) ? path.join(baseline, name) : name)
    assert.deepEqual([...actualSourcePaths].sort(), [...sourceLock.loadedSourcePaths].sort())
    const sourceHashes = Object.fromEntries(actualSourcePaths.map(name => [name, inputHashesAtStart[name]]))
    const generatedSchema = 'node_modules/.prisma/client/schema.prisma'
    assert(fs.statSync(generatedSchema).size > 1000, 'Actual generated Prisma schema input is required')
    const installedClientVersion = JSON.parse(fs.readFileSync('node_modules/@prisma/client/package.json', 'utf8')).version
    assert.equal(Prisma.prismaVersion.client, installedClientVersion)
    const prismaClient = { version: Prisma.prismaVersion.client,
      generatedSchemaSha256: inputHashesAtStart[generatedSchema],
      generatedImplementationSha256: inputHashesAtStart['node_modules/.prisma/client/index.js'],
      packageSha256: inputHashesAtStart['node_modules/@prisma/client/package.json'],
      dmmfModelCount: Prisma.dmmf.datamodel.models.length }
    const inputHashesAtEnd = hashInputs()
    assert.deepEqual(inputHashesAtEnd, inputHashesAtStart, 'Inputs changed during phase')
    const report = { checkedAt: now(), phase: before ? 'before_gap_observed' : serializable ? 'serializable_phantom_observed' : 'after_guard_verified', passed: cases.length,
      cases, observed, waitEvidence: waits, sourceHashes, inputHashesAtStart, inputHashesAtEnd, sourceLockSha256, prismaClient, scope: 'Actual 2 route handlers, admission helper, lifecycle store and owned private PostgreSQL. Session and email synthetic; no provider delivery or production DB.' }
    const output = process.env.DOYA_PROMANE_INVITE_EVIDENCE
    assert(output && path.isAbsolute(output))
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ phase: report.phase, passed: report.passed, waitEvidence: waits.length }))
  } finally { await db.$disconnect(); await db2.$disconnect(); await db3.$disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
