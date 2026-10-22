// Private Unix-socket PostgreSQL only. The supervisor owns this schema and cluster.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
// Before TypeScript, Prisma, or a project loader: match the parent's pre-PG bytes.
const expectedFile = process.env.DOYA_OWNER_HR_H5_EXPECTED
const expectedDigest = process.env.DOYA_OWNER_HR_H5_EXPECTED_SHA256
const baselineDirectory = process.env.DOYA_OWNER_HR_H5_BASELINE
const expectedPhase = process.env.DOYA_OWNER_HR_H5_PHASE
if (expectedFile) {
  assert.ok(expectedFile && path.isAbsolute(expectedFile) && baselineDirectory && path.isAbsolute(baselineDirectory))
  assert.equal(expectedPhase, 'after')
  assert.equal(process.env.DOYA_TEST_BASELINE, undefined, 'H5 after must load current source only')
  assert.match(expectedDigest || '', /^[a-f0-9]{64}$/)
  const inputBytes = fs.readFileSync(expectedFile)
  assert.equal(crypto.createHash('sha256').update(inputBytes).digest('hex'), expectedDigest, 'Parent H5 input manifest changed')
  const expectedInputs = JSON.parse(inputBytes.toString('utf8'))
  assert.deepEqual(Object.keys(expectedInputs).sort(), ['generatedFiles', 'materializedBaseline', 'sourceFiles', 'sourceLockSha256', 'version'])
  assert.equal(expectedInputs.version, 1)
  const lockBytes = fs.readFileSync('scripts/security-regression/fixtures/hr-owner-h5-source-lock.json')
  assert.equal(crypto.createHash('sha256').update(lockBytes).digest('hex'), expectedInputs.sourceLockSha256)
  const committedLock = JSON.parse(lockBytes.toString('utf8'))
  const sourceRecord = value => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  assert.ok(sourceRecord(expectedInputs.sourceFiles) && sourceRecord(committedLock.sourceFiles), 'H5 source maps must be plain records')
  // The parent binds the entire canonical map by raw lock SHA; these are mandatory roots of its HR closure.
  const requiredSourceFiles = [
    '.github/workflows/ci.yml',
    'scripts/security-regression/verify-hr-owner-cohort-postgres.py',
    'scripts/security-regression/verify-hr-invite-registration-current-postgres.py',
    'docs/audits/2026-10-06-all-services-recheck/verify-hr-invite-registration-snapshot-current.cjs',
    'scripts/security-regression/run.cjs',
    'scripts/security-regression/verify-hr-owner-transfer-postgres.py',
    'docs/audits/2026-10-06-all-services-recheck/verify-hr-invite-registration-snapshot-before.cjs',
    'docs/audits/2026-10-06-all-services-recheck/verify-hr-owner-transfer-private-postgres.cjs',
    'src/app/api/hr/organization/invite/route.ts',
    'src/lib/hr/access.ts',
    'src/lib/hr/membership-write.ts',
    'src/lib/hr/owner-transfer/store.ts',
    'src/lib/hr/owner-transfer/receipt.ts',
    'src/lib/hr/owner-transfer/types.ts',
    'src/lib/account-lifecycle/state.ts',
    'src/lib/account-lifecycle/store.ts',
    'prisma/schema.prisma',
    'package.json',
    'package-lock.json',
  ]
  const sourceKeys = Object.keys(expectedInputs.sourceFiles).sort()
  assert.deepEqual(sourceKeys, Object.keys(committedLock.sourceFiles).sort(), 'H5 canonical source keyset changed')
  for (const file of requiredSourceFiles) assert.ok(Object.hasOwn(committedLock.sourceFiles, file), 'Missing mandatory H5 source: ' + file)
  assert.deepEqual(expectedInputs.sourceFiles, committedLock.sourceFiles)
  assert.equal(Object.keys(expectedInputs.materializedBaseline).length, 22)
  assert.equal(Object.keys(expectedInputs.generatedFiles).length, 11)
  const lockedBytes = (file) => {
    const info = fs.lstatSync(file)
    assert.ok(info.isFile() && !info.isSymbolicLink(), 'H5 child input must be a regular file: ' + file)
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  }
  const verifyExpected = (items, prefix = '') => {
    assert.ok(items && typeof items === 'object' && !Array.isArray(items))
    for (const [name, hash] of Object.entries(items)) {
      assert.ok(name && !path.isAbsolute(name) && !name.split('/').includes('..') && /^[a-f0-9]{64}$/.test(hash))
      assert.equal(lockedBytes(path.join(prefix, name)), hash, 'H5 child pre-require input drift: ' + name)
    }
  }
  verifyExpected(expectedInputs.sourceFiles)
  verifyExpected(expectedInputs.generatedFiles)
  verifyExpected(expectedInputs.materializedBaseline, baselineDirectory)
} else {
  assert.equal(expectedDigest, undefined, 'H5 expected hash without manifest')
}
const sourceFiles = [
  'src/lib/hr/owner-transfer/types.ts', 'src/lib/hr/owner-transfer/receipt.ts', 'src/lib/hr/owner-transfer/store.ts',
  'src/lib/hr/access.ts', 'src/lib/hr/membership-write.ts', 'src/lib/account-lifecycle/state.ts', 'src/lib/account-lifecycle/store.ts',
  'src/lib/hr/types.ts', 'src/lib/hr/constants.ts', 'src/lib/hr/billing.ts', 'src/lib/private-api-response.ts',
  'src/app/api/hr/organization/route.ts', 'src/app/api/hr/organization/members/[id]/route.ts',
  'src/app/api/hr/organization/invite/route.ts', 'src/app/api/hr/organization/invite/accept/route.ts',
  'src/app/api/hr/organization/invite/[token]/route.ts',
  'src/lib/account-retirement.ts', 'scripts/security-regression/load-typescript.cjs',
  'scripts/security-regression/retirement-fixture.cjs', 'prisma/schema.prisma', 'package.json', 'package-lock.json',
  'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js', __filename,
]
const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
const loadedSourceHashes = sourceHashes()
const { Prisma, PrismaClient } = require('@prisma/client')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const { retirementModels } = require('../../../scripts/security-regression/retirement-fixture.cjs')
assert.deepEqual(sourceHashes(), loadedSourceHashes, 'Fixture source changed during module import')

const socket = process.env.DOYA_OWNER_HR_PG_SOCKET
const port = Number(process.env.DOYA_OWNER_HR_PG_PORT)
assert.match(socket || '', /^\/tmp\/doya-owner-hr-[a-f0-9]{8}\/socket$/)
assert(port > 1024 && port < 65536)
const db = new PrismaClient({ datasources: { db: { url: `postgresql://doya_owner_hr@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=owner_hr_fixture` } } })
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const model = name => {
  const found = Prisma.dmmf.datamodel.models.find(row => row.name === name)
  assert.ok(found, 'Missing generated Prisma model ' + name)
  return found
}
const table = name => quote(model(name).dbName || name)
const fixtureModels = [...new Set(['User', 'UserServiceSubscription', 'SystemSetting', 'HrOrganization', 'HrOrganizationMember', 'HrInvitation', ...retirementModels])]
assert.equal(fixtureModels.length, new Set(fixtureModels.map(table)).size, 'Fixture models must have distinct physical tables')
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
  await db.$executeRawUnsafe('CREATE TABLE ' + table(name) + ' (' + columns.join(',') + ')')
}
async function setup() {
  const server = await db.$queryRawUnsafe('SELECT inet_server_addr() AS address, current_user AS role')
  assert.equal(server[0].address, null)
  assert.equal(server[0].role, 'doya_owner_hr')
  await db.$executeRawUnsafe('CREATE SCHEMA owner_hr_fixture')
  const userUpdated = model('User').fields.find(field => field.name === 'updatedAt')
  assert.deepEqual([userUpdated?.type, userUpdated?.isRequired, userUpdated?.isUpdatedAt], ['DateTime', true, true])
  // @updatedAt gets a fixture-only DB default for raw seeding. This does not claim a production DDL default.
  for (const name of fixtureModels) await createModel(name)
}
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const lifecycle = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const types = load('src/lib/hr/owner-transfer/types.ts', { 'node:crypto': crypto, '@/lib/account-lifecycle/state': state })
const receipt = load('src/lib/hr/owner-transfer/receipt.ts', { '@/lib/account-lifecycle/state': state, './types': types })
const store = load('src/lib/hr/owner-transfer/store.ts', { '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db },
  '@/lib/account-lifecycle/store': lifecycle, './types': types, './receipt': receipt })
const accessFor = (client, authenticated = false) => load('src/lib/hr/access.ts', { 'next-auth': { getServerSession: async () => authenticated ? { user: { id: routeActor } } : null },
  'next/headers': { headers: async () => new Headers() }, './organization-selection': { parseHrOrganizationSelection: () => ({ kind: 'none' }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: client },
  './types': { HrMemberRole: { OWNER: 'OWNER' } },
  './constants': { ROLE_HIERARCHY: { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 } },
  '@/lib/account-lifecycle/store': lifecycle })
const access = accessFor(db)
const membership = load('src/lib/hr/membership-write.ts', { '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db },
  '@/lib/account-lifecycle/store': lifecycle })
let routeActor = 'old', syntheticMailCalls = 0, syntheticAuditCalls = 0
const hrTypes = load('src/lib/hr/types.ts')
const hrConstants = load('src/lib/hr/constants.ts', { './types': hrTypes })
const billing = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma: db } })
const routeAccess = accessFor(db, true)
const privateResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } })
const routeMocks = { 'next/server': { NextResponse: Response }, '@prisma/client': { Prisma },
  'next-auth': { getServerSession: async () => ({ user: { id: routeActor, name: 'Synthetic' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db }, '@/lib/hr/access': routeAccess,
  '@/lib/hr/types': hrTypes, '@/lib/hr/constants': hrConstants, '@/lib/hr/billing': billing,
  '@/lib/hr/membership-write': membership, '@/lib/account-lifecycle/state': state,
  '@/lib/private-api-response': privateResponse, '@/lib/hr/audit': { logAudit: async () => { syntheticAuditCalls++ } },
  '@/lib/hr/email': { sendInvitationEmail: async () => { syntheticMailCalls++; return false } },
  'crypto': crypto, '@/lib/hr/organization-choices': { readHrOrganizationChoicesPage: async () => ({}) } }
const memberRoute = load('src/app/api/hr/organization/members/[id]/route.ts', routeMocks)
const organizationRoute = load('src/app/api/hr/organization/route.ts', routeMocks)
const inviteRoute = load('src/app/api/hr/organization/invite/route.ts', routeMocks)
const acceptRoute = load('src/app/api/hr/organization/invite/accept/route.ts', routeMocks)
const inviteReadRoute = load('src/app/api/hr/organization/invite/[token]/route.ts', routeMocks)
const retirement = load('src/lib/account-retirement.ts', { '@prisma/client': { Prisma } })
const cases = [], waits = [], operationWaits = []
const dto = value => structuredClone(value)
const pendingSettlements = new Set(), unresolvedBarriers = new Set()
const deferred = () => {
  let complete
  const promise = new Promise(done => { complete = done })
  const ticket = { promise, resolve: () => { unresolvedBarriers.delete(ticket); complete() } }
  unresolvedBarriers.add(ticket)
  return ticket
}
const settle = promise => {
  const observed = promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }))
  pendingSettlements.add(observed)
  void observed.finally(() => pendingSettlements.delete(observed))
  return observed
}
async function drainPendingAfterFailure() {
  const deadline = Date.now() + 35000
  while (pendingSettlements.size || unresolvedBarriers.size) {
    for (const barrier of unresolvedBarriers) barrier.resolve()
    if (!pendingSettlements.size) continue
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw Error('Private fixture transaction drain exceeded 35 seconds')
    let timer
    try {
      await Promise.race([Promise.allSettled([...pendingSettlements]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Private fixture transaction drain exceeded 35 seconds')), remaining) })])
    } finally { clearTimeout(timer) }
  }
}
const reservationDigest = crypto.createHash('sha256').update('synthetic HR owner retirement').digest('hex')
const retirementId = userId => ({ operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId,
  operationId: crypto.randomUUID(), kind: 'retirement' })
const dependentWrite = (kind, item, client = db) => membership.withHrMembershipWrite(kind === 'member'
  ? { organizationId: item.org.id, actorUserId: 'old', requestedMemberIds: [item.oldId, item.targetId],
      run: async tx => {
        const changed = await tx.hrOrganizationMember.updateMany({
          where: { id: item.targetId, organizationId: item.org.id, role: 'MEMBER', status: 'ACTIVE' },
          data: { status: 'SUSPENDED' },
        })
        assert.equal(changed.count, 1)
        return 'member-updated'
      } }
  : { organizationId: item.org.id, actorUserId: 'old', requestedMemberIds: [item.oldId],
      discoverUserIds: async source => {
        const recipient = await source.user.findUnique({ where: { email: 'third@example.invalid' }, select: { id: true } })
        return recipient ? [recipient.id] : []
      }, run: async (tx, snapshot) => {
        assert.equal(JSON.stringify(snapshot.discoveredUsers), '["third"]')
        await tx.hrInvitation.create({ data: { organizationId: item.org.id, email: 'third@example.invalid',
          role: 'MEMBER', token: 'synthetic_invite', invitedBy: 'old', status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 86400000) } })
        return 'invitation-created'
      } }, client)
async function waitForLock(holderPid, name, expectedSql) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type=$1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes(expectedSql))
    if (blocked) {
      // pg_blocking_pids is the actual server wait graph, not a scheduled test assumption.
      const evidence = { name, holderPid, waiterPid: blocked.pid,
        blockingPids: blocked.blockers, waitEventType: 'Lock', lockTarget: expectedSql,
        queryContainsTarget: blocked.query.includes(expectedSql) }
      if (expectedSql === 'pg_advisory_xact_lock') operationWaits.push(evidence)
      else waits.push(evidence)
      return blocked.pid
    }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual lock wait: ' + name)
}
const started = (entered, holder, release) => Promise.race([entered.promise,
  holder.then(result => { throw result.error || Error('Holder ended before lock wait') })]).catch(error => {
  release?.resolve()
  throw error
})
async function observeThenRelease(holderPid, name, expectedSql, release) {
  let waiterPid = null, waitError = null
  try { waiterPid = await waitForLock(holderPid, name, expectedSql) }
  catch (error) { waitError = error }
  finally { release.resolve() }
  return { waiterPid, waitError }
}
const setting = () => db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } })
const users = () => db.user.findMany({ orderBy: { id: 'asc' } })
const subscriptions = () => db.userServiceSubscription.findMany({ orderBy: { id: 'asc' } })
const orgs = () => db.hrOrganization.findMany({ orderBy: { id: 'asc' } })
const members = () => db.hrOrganizationMember.findMany({ orderBy: { id: 'asc' } })
const invitations = () => db.hrInvitation.findMany({ orderBy: { id: 'asc' } })
const snapshot = async () => ({ settings: await setting(), users: await users(), subscriptions: await subscriptions(),
  orgs: await orgs(), members: await members(), invitations: await invitations() })
async function reset() {
  const tables = fixtureModels.map(table)
  await db.$executeRawUnsafe('TRUNCATE ' + tables.join(',') + ' CASCADE')
  await db.user.createMany({ data: [
    { id: 'old', email: 'old@example.invalid', plan: 'PRO', stripeCustomerId: 'cus_old', stripeSubscriptionId: 'sub_old' },
    { id: 'new', email: 'new@example.invalid', plan: 'LIGHT', stripeCustomerId: 'cus_new', stripeSubscriptionId: 'sub_new' },
    { id: 'third', email: 'third@example.invalid', plan: 'ENTERPRISE', stripeCustomerId: 'cus_third', stripeSubscriptionId: 'sub_third' },
  ] })
  await db.userServiceSubscription.createMany({ data: [
    { id: 'personal_old', userId: 'old', serviceId: 'banner', plan: 'PRO', stripeSubscriptionId: 'sub_old',
      stripePriceId: 'price_old', dailyUsage: 4, monthlyUsage: 9 },
    { id: 'personal_new', userId: 'new', serviceId: 'banner', plan: 'LIGHT', stripeSubscriptionId: 'sub_new',
      stripePriceId: 'price_new', dailyUsage: 2, monthlyUsage: 3 },
    { id: 'personal_third', userId: 'third', serviceId: 'banner', plan: 'ENTERPRISE', stripeSubscriptionId: 'sub_third',
      stripePriceId: 'price_third', dailyUsage: 7, monthlyUsage: 11 },
  ] })
  routeActor = 'old'; syntheticMailCalls = 0; syntheticAuditCalls = 0
}
async function seed(suffix = '') {
  const org = await db.hrOrganization.create({ data: { id: 'hr_org' + suffix, slug: 'x'.repeat(161) + suffix, name: 'Synthetic HR', plan: 'PRO' } })
  await db.hrOrganizationMember.createMany({ data: [
    { id: 'owner' + suffix, organizationId: org.id, userId: 'old', role: 'OWNER', status: 'ACTIVE' },
    { id: 'target' + suffix, organizationId: org.id, userId: 'new', role: 'MEMBER', status: 'ACTIVE' },
  ] })
  return { org, oldId: 'owner' + suffix, targetId: 'target' + suffix }
}
const identity = (item, op = crypto.randomUUID()) => ({ service: 'hr', organizationId: item.org.id, actorUserId: 'old', operationId: op })
const input = item => ({ expectedOwnerMemberId: item.oldId, targetMemberId: item.targetId, targetUserId: 'new', targetRole: 'MEMBER', targetPlan: 'LIGHT' })
async function test(name, run) { await reset(); await run(); cases.push(name); console.log('PASS', name) }
async function expectCode(promise, code) { await assert.rejects(promise, error => error?.code === code) }
async function roles() { return Object.fromEntries((await db.hrOrganizationMember.findMany({ select: { id: true, role: true } })).map(row => [row.id, row.role])) }
const request = body => ({ json: async () => body })
const privateStatus = (response, status) => {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.match(response.headers.get('Vary') || '', /Cookie/)
}
const seedAcceptInvite = item => db.hrInvitation.create({ data: { organizationId: item.org.id,
  email: 'third@example.invalid', role: 'MEMBER', token: 'accept_token', invitedBy: 'old',
  status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 86400000) } })
async function callActualWriter(kind, item, routes = { memberRoute, organizationRoute, inviteRoute, acceptRoute }) {
  if (kind === 'organization-create') { routeActor = 'third'; return routes.organizationRoute.POST(request({ name: 'New HR', slug: 'created-hr' })) }
  if (kind === 'member-patch') return routes.memberRoute.PATCH(request({ role: 'MANAGER' }), { params: Promise.resolve({ id: item.targetId }) })
  if (kind === 'member-delete') return routes.memberRoute.DELETE(request(null), { params: Promise.resolve({ id: item.targetId }) })
  if (kind === 'organization-patch') return routes.organizationRoute.PATCH(request({ name: 'Updated HR' }))
  if (kind === 'invite-issue') return routes.inviteRoute.POST(request({ email: 'third@example.invalid' }))
  if (kind === 'invite-accept') { routeActor = 'third'; return routes.acceptRoute.POST(request({ token: 'accept_token' })) }
  throw Error('Unknown actual HR writer ' + kind)
}
function tracedActualRoutes(entered, release, onPid) {
  const tracedDb = new Proxy(db, { get(target, property) {
    if (property === '$transaction') return (work, options) => target.$transaction(async tx => {
      const value = await work(tx)
      onPid((await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid)
      entered.resolve()
      await release.promise
      return value
    }, options)
    return Reflect.get(target, property, target)
  } })
  const tracedMembership = load('src/lib/hr/membership-write.ts', { '@prisma/client': { Prisma },
    '@/lib/prisma': { prisma: tracedDb }, '@/lib/account-lifecycle/store': lifecycle })
  const mocks = { ...routeMocks, '@/lib/hr/membership-write': tracedMembership,
    '@/lib/hr/access': accessFor(tracedDb, true) }
  return {
    memberRoute: load('src/app/api/hr/organization/members/[id]/route.ts', mocks),
    organizationRoute: load('src/app/api/hr/organization/route.ts', mocks),
    inviteRoute: load('src/app/api/hr/organization/invite/route.ts', mocks),
    acceptRoute: load('src/app/api/hr/organization/invite/accept/route.ts', mocks),
  }
}

const h3Events = [], h3Attempts = [], h3Discoveries = []
let h3RaceEvidence = null
const event = (name, details = {}) => h3Events.push({ order: h3Events.length + 1, name, ...details })
const probeUser = (delegate, place, attempt, email) => new Proxy(delegate, { get(target, property) {
  if (property !== 'findUnique') return Reflect.get(target, property, target)
  return async args => {
    const value = await target.findUnique(args)
    if (args?.where?.email === email) {
      const row = { place, attempt, id: value?.id || null }
      h3Discoveries.push(row)
      event('recipient-discovery', row)
    }
    return value
  }
} })
function tracedH3Db(email) {
  return new Proxy(db, { get(target, property) {
    if (property === 'user') return probeUser(target.user, 'outer', null, email)
    if (property !== '$transaction') return Reflect.get(target, property, target)
    return async (work, options) => {
      const attempt = { index: h3Attempts.length + 1, isolationRequested: options?.isolationLevel, outcome: 'started' }
      h3Attempts.push(attempt)
      try {
        const value = await target.$transaction(async tx => {
          // First statement fixes the actual Serializable snapshot before the User lock.
          const [seen] = await tx.$queryRawUnsafe(`SELECT pg_backend_pid() AS pid,
            current_setting('transaction_isolation') AS isolation,
            txid_current_snapshot()::text AS snapshot`)
          assert.equal(seen.isolation.toLowerCase(), 'serializable')
          attempt.pid = seen.pid
          attempt.snapshot = seen.snapshot
          event('serializable-snapshot', { attempt: attempt.index, pid: seen.pid, snapshot: seen.snapshot })
          const observedTx = new Proxy(tx, { get(inner, key) {
            if (key === 'user') return probeUser(inner.user, 'inner', attempt.index, email)
            return Reflect.get(inner, key, inner)
          } })
          return work(observedTx)
        }, options)
        attempt.outcome = 'committed'
        event('transaction-committed', { attempt: attempt.index })
        return value
      } catch (error) {
        attempt.outcome = 'rejected'
        attempt.errorCode = error?.code || null
        attempt.sqlState = error?.meta?.code || null
        event('transaction-rejected', { attempt: attempt.index, code: attempt.errorCode, sqlState: attempt.sqlState })
        throw error
      }
    }
  } })
}
function actualH3InviteRoute(email) {
  const observedDb = tracedH3Db(email)
  const observedMembership = load('src/lib/hr/membership-write.ts', {
    '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: observedDb }, '@/lib/account-lifecycle/store': lifecycle,
  })
  return load('src/app/api/hr/organization/invite/route.ts', {
    ...routeMocks, '@/lib/hr/membership-write': observedMembership,
  })
}
async function waitForH3Owner(holderPid) {
  for (let n = 0; n < 200; n++) {
    const rows = await db.$queryRawUnsafe(`SELECT pid, pg_blocking_pids(pid) AS blockers,
      query, wait_event_type AS "waitEventType" FROM pg_stat_activity
      WHERE pid <> pg_backend_pid() AND wait_event_type = $1`, 'Lock')
    const row = rows.find(value => value.blockers.includes(holderPid) && value.query.includes(table('User')))
    if (row) return { holderPid, waiterPid: row.pid, blockingPids: row.blockers,
      queryContainsUser: row.query.includes(table('User')), waitEventType: row.waitEventType }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('H3 actual User row wait not observed')
}
async function currentH3Race() {
  await reset()
  const item = await seed()
  const email = 'late@example.invalid'
  assert.equal(await db.user.findUnique({ where: { email }, select: { id: true } }), null)
  assert.equal(await db.hrInvitation.count({ where: { organizationId: item.org.id } }), 0)
  const route = actualH3InviteRoute(email)
  const entered = deferred(), release = deferred()
  let holderPid, pending, originalError, reserved, visibleReceiptValue, lateIdentity, committedBeforeRelease
  const holder = settle(db.$transaction(async tx => {
    holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
    await tx.$queryRawUnsafe('SELECT id FROM ' + table('User') + ' WHERE id = $1 FOR UPDATE', 'old')
    event('owner-holder-locked', { holderPid })
    entered.resolve()
    await release.promise
  }, { isolationLevel: 'ReadCommitted', timeout: 30000 }))
  try {
    await started(entered, holder, release)
    pending = settle(route.POST(request({ email })))
    const wait = await waitForH3Owner(holderPid)
    assert.ok(h3Discoveries.some(row => row.place === 'outer' && row.id === null))
    assert.equal(h3Attempts[0]?.pid, wait.waiterPid)
    assert.ok(h3Events.some(row => row.name === 'serializable-snapshot' && row.pid === wait.waiterPid))
    event('actual-user-wait', wait)
    await db.user.create({ data: { id: 'late', email, plan: 'PRO' } })
    event('late-registration-committed')
    lateIdentity = retirementId('late')
    reserved = await lifecycle.reserveLifecycleOperation(db, lateIdentity, reservationDigest)
    assert.equal(reserved.phase, 'reserved')
    event('late-retirement-reservation-committed')
    assert.equal((await db.user.findUnique({ where: { email }, select: { id: true } }))?.id, 'late')
    const visibleReceipt = await db.systemSetting.findUnique({ where: { key: state.lifecycleReceiptKey(lateIdentity) } })
    assert.ok(visibleReceipt)
    visibleReceiptValue = visibleReceipt.value
    event('external-late-user-and-receipt-visible')
    // The other transactions have committed; only the blocked invitation may change this graph.
    committedBeforeRelease = await snapshot()
  } catch (error) { originalError = error }
  finally { event('owner-holder-released'); release.resolve() }
  let settled, timer, drainError
  try {
    settled = await Promise.race([Promise.allSettled([holder, pending].filter(Boolean)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('H3 drain exceeded 35 seconds')), 35000) })])
  } catch (error) { drainError = error }
  finally { clearTimeout(timer) }
  if (originalError) throw originalError
  if (drainError) throw drainError
  assert.ok(settled.every(row => row.status === 'fulfilled'), 'H3 pending tasks must settle')
  const held = await holder, outcome = await pending
  assert.equal(held.ok, true, held.error?.message)
  assert.equal(outcome.ok, true, outcome.error?.message)
  const response = outcome.value
  h3RaceEvidence = { httpStatus: response.status }
  let body
  try { body = await response.json() }
  catch (error) { h3RaceEvidence.bodyParseError = error?.message || 'invalid JSON'; throw error }
  h3RaceEvidence.responseCode = body?.code || null
  h3RaceEvidence.bodyShape = { codeType: typeof body?.code, errorType: typeof body?.error }
  const afterGraph = await snapshot()
  const invitationRows = await db.hrInvitation.findMany({ where: { organizationId: item.org.id } })
  const lateMembers = await db.hrOrganizationMember.findMany({ where: { organizationId: item.org.id, userId: 'late' } })
  const receipt = await db.systemSetting.findUnique({ where: { key: state.lifecycleReceiptKey(lateIdentity) } })
  const graphHash = value => crypto.createHash('sha256').update(JSON.stringify(value,
    (_key, field) => typeof field === 'bigint' ? field.toString() : field)).digest('hex')
  const graphChanges = Object.fromEntries(Object.keys(committedBeforeRelease).map(name => [name, {
    before: committedBeforeRelease[name].length, after: afterGraph[name].length,
    changed: !isDeepStrictEqual(committedBeforeRelease[name], afterGraph[name]),
  }]))
  const fullGraphUnchanged = isDeepStrictEqual(afterGraph, committedBeforeRelease)
  const order = name => h3Events.find(row => row.name === name)?.order
  const classification = response.status === 409 && body?.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS'
    ? 'fence-rejected'
    : response.status === 409 && /状態が変わりました/.test(body?.error || '')
      ? 'membership-changed-rejected' : response.status === 500 ? 'unexpected-500' : 'unexpected-response'
  const result = { name: 'current-after snapshot then registration and retirement',
    classification, httpStatus: response.status, responseCode: body?.code || null,
    bodyShape: { codeType: typeof body?.code, errorType: typeof body?.error },
    privateCacheControl: response.headers.get('Cache-Control') === 'private, no-store',
    varyCookie: /Cookie/.test(response.headers.get('Vary') || ''),
    fullGraphUnchanged, graphBeforeSha256: graphHash(committedBeforeRelease),
    graphAfterSha256: graphHash(afterGraph), graphChanges,
    retirementReceiptUnchanged: receipt?.value === visibleReceiptValue,
    invitations: invitationRows.length, lateMembers: lateMembers.length,
    syntheticMailCalls, syntheticAuditCalls, events: structuredClone(h3Events),
    attempts: structuredClone(h3Attempts), discoveries: structuredClone(h3Discoveries) }
  // Persist exact failure evidence before any assertion can stop unsafe responses or graph mutations.
  h3RaceEvidence = result
  privateStatus(response, 409)
  assert.deepEqual(afterGraph, committedBeforeRelease,
    'Rejected invite must not mutate any User, subscription, receipt, organization, member, or invitation row')
  assert.equal(receipt?.value, visibleReceiptValue, 'Retirement receipt must survive unchanged')
  for (const [before, after] of [
    ['serializable-snapshot', 'actual-user-wait'], ['actual-user-wait', 'late-registration-committed'],
    ['late-registration-committed', 'late-retirement-reservation-committed'],
    ['late-retirement-reservation-committed', 'external-late-user-and-receipt-visible'],
    ['external-late-user-and-receipt-visible', 'owner-holder-released'],
  ]) assert.ok(order(before) < order(after), 'H3 schedule order: ' + before + ' -> ' + after)
  assert.ok(['fence-rejected', 'membership-changed-rejected'].includes(classification), JSON.stringify(result))
  assert.equal(invitationRows.length, 0)
  assert.equal(lateMembers.length, 0)
  assert.equal(syntheticMailCalls, 0)
  assert.equal(syntheticAuditCalls, 0)
  return result
}
async function currentH3Positive() {
  await reset()
  const item = await seed()
  const email = 'late@example.invalid'
  const route = actualH3InviteRoute(email)
  const result = await route.POST(request({ email }))
  privateStatus(result, 200)
  const body = await result.json()
  assert.equal(body.success, true)
  const invitations = await db.hrInvitation.findMany({ where: { organizationId: item.org.id, email, status: 'PENDING' } })
  assert.equal(invitations.length, 1)
  assert.equal(invitations[0].role, 'MEMBER')
  assert.equal(invitations[0].status, 'PENDING')
  assert.equal(invitations[0].invitedBy, 'old')
  assert.ok(invitations[0].expiresAt.getTime() - Date.now() > 6 * 86400000)
  assert.ok(invitations[0].expiresAt.getTime() - Date.now() <= 7 * 86400000)
  assert.equal(syntheticMailCalls, 1)
  assert.equal(syntheticAuditCalls, 1)
  return { name: 'current-after unregistered recipient positive', httpStatus: result.status,
    invitations: invitations.length, invitationRole: invitations[0].role,
    invitationStatus: invitations[0].status, invitedBy: invitations[0].invitedBy,
    invitationExpiresInDays: (invitations[0].expiresAt.getTime() - Date.now()) / 86400000,
    syntheticMailCalls, syntheticAuditCalls }
}
async function run() {
  assert.equal(process.env.DOYA_OWNER_HR_H3_CURRENT_AFTER, '1')
  assert.ok(process.env.DOYA_OWNER_HR_H3_CURRENT_EVIDENCE)
  assert.equal(process.env.DOYA_TEST_BASELINE, undefined)
  const initialSourceHashes = sourceHashes()
  assert.deepEqual(initialSourceHashes, loadedSourceHashes)
  await setup()
  const results = []
  try {
    results.push(await currentH3Race())
    results.push(await currentH3Positive())
    assert.deepEqual(sourceHashes(), initialSourceHashes)
    const report = { checkedAt: new Date().toISOString(), phase: 'current-h3-after', passed: results.length,
      results, sourceHashes: initialSourceHashes, h5ExpectedSha256: expectedFile ? expectedDigest : null,
      scope: 'Current invite route and shared writer against owned Unix PostgreSQL; synthetic mail/audit only.' }
    fs.writeFileSync(process.env.DOYA_OWNER_HR_H3_CURRENT_EVIDENCE, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ phase: report.phase, passed: report.passed }))
  } catch (error) {
    fs.writeFileSync(process.env.DOYA_OWNER_HR_H3_CURRENT_EVIDENCE, JSON.stringify({
      checkedAt: new Date().toISOString(), phase: 'current-h3-after', failed: true,
      error: { name: error?.name, code: error?.code, message: error?.message }, results,
      raceEvidence: h3RaceEvidence,
      events: h3Events, attempts: h3Attempts, discoveries: h3Discoveries,
      sourceHashes: initialSourceHashes,
    }, null, 2) + '\n')
    throw error
  }
}
run().catch(async error => {
  console.error(error)
  process.exitCode = 1
  try { await drainPendingAfterFailure() }
  catch (drainError) { console.error('H3 secondary drain failure', drainError) }
}).finally(async () => { await db.$disconnect() })

