// Private Unix-socket PostgreSQL only. The supervisor owns this schema and cluster.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
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
const ts = require('typescript')
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
  'scripts/security-regression/fixtures/hr-owner-before36/transfer-owner.route.txt',
  'scripts/security-regression/fixtures/hr-owner-before36/manifest.json',
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
let routeActor = 'old', syntheticMailCalls = 0
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
  '@/lib/private-api-response': privateResponse, '@/lib/hr/audit': { logAudit: async () => {} },
  '@/lib/hr/email': { sendInvitationEmail: async () => { syntheticMailCalls++; return false } },
  'crypto': crypto, '@/lib/hr/organization-choices': { readHrOrganizationChoicesPage: async () => ({}) } }
const oldOwnerRouteData = 'scripts/security-regression/fixtures/hr-owner-before36/transfer-owner.route.txt'
const oldOwnerRouteManifest = 'scripts/security-regression/fixtures/hr-owner-before36/manifest.json'
function loadPinnedOldOwnerRoute() {
  const manifest = JSON.parse(fs.readFileSync(oldOwnerRouteManifest, 'utf8'))
  assert.deepEqual([manifest.baseCommit, manifest.baseTree, manifest.path, manifest.gitBlob, manifest.dataPath], [
    '36dbd63230056cedd762dff9617f3f8955991dc2',
    'f9bdd5999e01ee5f9c8fa37ef2ba6704942dde24',
    'src/app/api/hr/organization/transfer-owner/route.ts',
    '6a542ecde3420f2427f1d40e1f5de12f3b0cbb4e', oldOwnerRouteData,
  ])
  const source = fs.readFileSync(oldOwnerRouteData)
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), manifest.sha256)
  const compiled = ts.transpileModule(source.toString('utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  const exports = {}
  const mocks = {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db },
    '@/lib/hr/access': { getHrContext: async () => {
      const member = await db.hrOrganizationMember.findUnique({ where: { id: 'owner' }, select: { role: true } })
      return member ? { userId: 'old', memberId: 'owner', organizationId: 'hr_org', role: member.role } : null
    } },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN' } },
    '@/lib/hr/audit': { logAudit: async () => {} },
  }
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected pinned old route import ' + name)
    return mocks[name]
  }, Response, console, process: { env: {} } }, { filename: oldOwnerRouteData })
  assert.equal(typeof exports.POST, 'function')
  return exports.POST
}
const pinnedOldOwnerPost = loadPinnedOldOwnerRoute()
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
  routeActor = 'old'; syntheticMailCalls = 0
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

async function run() {
  const initialSourceHashes = sourceHashes()
  assert.deepEqual(initialSourceHashes, loadedSourceHashes, 'Fixture source changed while loading real modules')
  await setup()
  await test('HR before36 old route transfers after target retirement without a fence', async () => {
    const item = await seed()
    await lifecycle.reserveLifecycleOperation(db, retirementId('new'), reservationDigest)
    const before = await snapshot()
    const response = await pinnedOldOwnerPost(request({ targetMemberId: item.targetId }))
    assert.equal(response.status, 200)
    assert.deepEqual(await roles(), { owner: 'ADMIN', target: 'OWNER' })
    assert.deepEqual(await setting(), before.settings, 'Old route has no durable transfer receipt')
  })
  await test('HR before36 old route cannot replay a lost successful response', async () => {
    const item = await seed()
    const first = await pinnedOldOwnerPost(request({ targetMemberId: item.targetId }))
    assert.equal(first.status, 200)
    const afterFirst = await snapshot()
    const replay = await pinnedOldOwnerPost(request({ targetMemberId: item.targetId }))
    assert.equal(replay.status, 403)
    assert.deepEqual(await snapshot(), afterFirst)
    assert.equal(await db.systemSetting.count(), 0, 'Old route has no operation receipt to recover')
  })
  await test('HR atomic uppercase transfer, exact replay and personal fields unchanged', async () => {
    const item = await seed(), id = identity(item), before = await snapshot()
    await expectCode(store.ownerTransferCandidates('hr', item.org.id, 'new'), 'OWNER_TRANSFER_OWNER_REQUIRED')
    const list = await store.ownerTransferCandidates('hr', item.org.id, 'old')
    assert.equal(list.organization.slug.length, 161)
    assert.equal(list.candidates.length, 1)
    assert.equal(list.candidates[0].role, 'MEMBER')
    await assert.rejects(retirement.checkAccountRetirementSafe(db, 'old'), error => error.reason === 'ownership')
    const result = await store.transferOwner(id, input(item), db)
    assert.equal(result.phase, 'committed')
    assert.deepEqual(await roles(), { owner: 'ADMIN', target: 'OWNER' })
    assert.deepEqual(dto(await store.transferOwner(id, input(item), db)), dto(result))
    assert.deepEqual(dto(await store.ownerTransferStatus(id, db)), dto(result))
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.orgs, before.orgs)
    assert.deepEqual(after.invitations, before.invitations)
    assert.equal(after.settings.length, before.settings.length + 1)
    await retirement.checkAccountRetirementSafe(db, 'old')
  })
  await test('HR sole owner preflight remains safe without inventing another member', async () => {
    const item = await seed()
    await db.hrOrganizationMember.delete({ where: { id: item.targetId } })
    const before = await snapshot()
    await retirement.checkAccountRetirementSafe(db, 'old')
    assert.deepEqual(await snapshot(), before)
  })
  await test('HR missing cancel is durable and cannot undo a committed transfer', async () => {
    const item = await seed(), id = identity(item)
    assert.equal((await store.cancelOwnerTransfer(id, db)).phase, 'canceled')
    assert.equal((await store.transferOwner(id, input(item), db)).phase, 'canceled')
    assert.equal((await store.ownerTransferStatus(id, db)).phase, 'canceled')
    assert.deepEqual(await roles(), { owner: 'OWNER', target: 'MEMBER' })
    const second = identity(item)
    assert.equal((await store.transferOwner(second, input(item), db)).phase, 'committed')
    assert.equal((await store.cancelOwnerTransfer(second, db)).phase, 'committed')
  })
  await test('HR retirement fences only a new missing cancel write; existing receipt remains readable', async () => {
    const item = await seed(), missing = identity(item), saved = identity(item)
    assert.equal((await store.cancelOwnerTransfer(saved, db)).phase, 'canceled')
    await lifecycle.reserveLifecycleOperation(db, retirementId('old'), reservationDigest)
    const before = await snapshot()
    await expectCode(store.cancelOwnerTransfer(missing, db), 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal((await store.ownerTransferStatus(missing, db)).phase, 'missing')
    assert.equal((await store.cancelOwnerTransfer(saved, db)).phase, 'canceled')
    assert.deepEqual(await snapshot(), before)
  })
  await test('HR missing cancel retirement-first User wait rejects the new receipt', async () => {
    const item = await seed(), id = identity(item), before = await snapshot()
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId('old'), reservationDigest)
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(store.cancelOwnerTransfer(id, db))
    const observed = await observeThenRelease(holderPid, 'missing cancel retirement-first', '"User"', release)
    const held = await holder, canceled = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(canceled.ok, false)
    assert.equal(canceled.error?.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 0)
    assert.deepEqual((await snapshot()).users, before.users)
    assert.deepEqual((await snapshot()).subscriptions, before.subscriptions)
    assert.deepEqual((await snapshot()).members, before.members)
  })
  await test('HR missing cancel-first User wait creates one receipt before retirement', async () => {
    const item = await seed(), id = identity(item)
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      const saved = await store.cancelOwnerTransfer(id, { $transaction: work => work(tx) })
      assert.equal(saved.phase, 'canceled')
      entered.resolve(); await release.promise
    }, { isolationLevel: 'ReadCommitted', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId('old'), reservationDigest))
    const observed = await observeThenRelease(holderPid, 'missing cancel-first retirement', '"User"', release)
    const held = await holder, reserved = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(reserved.ok, true, reserved.error?.message)
    assert.equal((await store.ownerTransferStatus(id, db)).phase, 'canceled')
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
    assert.deepEqual(await roles(), { owner: 'OWNER', target: 'MEMBER' })
  })
  await test('HR target plan drift and malformed receipt fail without role mutation', async () => {
    const item = await seed(), id = identity(item)
    await db.user.update({ where: { id: 'new' }, data: { plan: 'PRO' } })
    const before = await snapshot()
    await expectCode(store.transferOwner(id, input(item), db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.deepEqual(await snapshot(), before)
    await db.systemSetting.create({ data: { key: types.ownerTransferKey(id), value: '{' } })
    await expectCode(store.ownerTransferStatus(id, db), 'OWNER_TRANSFER_STATE_UNAVAILABLE')
    await expectCode(store.cancelOwnerTransfer(id, db), 'OWNER_TRANSFER_STATE_UNAVAILABLE')
  })
  await test('HR target role, status and User binding drift reject without creating a receipt', async () => {
    const item = await seed(), id = identity(item)
    for (const data of [{ role: 'MANAGER' }, { status: 'SUSPENDED' }, { userId: 'third' }]) {
      await db.hrOrganizationMember.update({ where: { id: item.targetId }, data, select: { id: true } })
      const before = await snapshot()
      await expectCode(store.transferOwner(id, input(item), db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
      assert.deepEqual(await snapshot(), before)
      assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 0)
      await db.hrOrganizationMember.update({ where: { id: item.targetId }, data: {
        role: 'MEMBER', status: 'ACTIVE', userId: 'new' }, select: { id: true } })
    }
  })
  await test('HR exact raw target plan replays but changed confirmation and unknown plan fail closed', async () => {
    const item = await seed(), id = identity(item)
    await db.user.update({ where: { id: 'new' }, data: { plan: 'BANNER_PRO' }, select: { id: true } })
    const expected = { ...input(item), targetPlan: 'BANNER_PRO' }
    const before = await snapshot()
    assert.equal((await store.transferOwner(id, expected, db)).phase, 'committed')
    await expectCode(store.transferOwner(id, { ...expected, targetPlan: 'PRO' }, db), 'OWNER_TRANSFER_INPUT_CONFLICT')
    assert.equal((await store.transferOwner(id, expected, db)).phase, 'committed')
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.orgs, before.orgs)
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
    await reset()
    const unknownItem = await seed(), second = identity(unknownItem)
    await db.user.update({ where: { id: 'new' }, data: { plan: 'UNKNOWN_PLAN' }, select: { id: true } })
    const unknownBefore = await snapshot()
    await expectCode(store.transferOwner(second, { ...input(unknownItem), targetPlan: 'UNKNOWN_PLAN' }, db), 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.deepEqual(await snapshot(), unknownBefore)
  })
  await test('HR same UUID has independent actor and immutable organization receipts', async () => {
    const item = await seed(), op = crypto.randomUUID()
    const first = identity(item, op), second = { ...first, actorUserId: 'new' },
      third = { ...first, organizationId: 'other_org' }
    for (const id of [first, second, third]) assert.equal((await store.cancelOwnerTransfer(id, db)).phase, 'canceled')
    const keys = [first, second, third].map(types.ownerTransferKey)
    assert.equal(new Set(keys).size, 3)
    assert.equal((await db.systemSetting.findMany({ where: { key: { in: keys } } })).length, 3)
    for (const id of [first, second, third]) assert.equal((await store.ownerTransferStatus(id, db)).phase, 'canceled')
  })
  for (const phase of ['committed', 'canceled']) await test(`HR late ${phase} receipt wins after target User deletion`, async () => {
    const item = await seed(), id = identity(item), transactions = []
    let first = true, terminal, savedSetting, savedRoles
    const interposed = { $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: async (work, options) => {
        transactions.push(options?.isolationLevel)
        const value = await db.$transaction(work, options)
        if (first) {
          first = false
          assert.equal(value, null, 'first receipt read must be missing')
          terminal = phase === 'committed' ? await store.transferOwner(id, input(item), db) : await store.cancelOwnerTransfer(id, db)
          assert.equal(terminal.phase, phase)
          await db.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', 'new')
          savedSetting = await setting()
          savedRoles = await roles()
        }
        return value
      },
    }
    const recovered = await store.transferOwner(id, input(item), interposed)
    assert.deepEqual(transactions, ['ReadCommitted', 'Serializable', 'ReadCommitted'])
    assert.deepEqual(dto(recovered), dto(terminal))
    assert.deepEqual(await setting(), savedSetting)
    assert.deepEqual(await roles(), savedRoles)
    assert.equal(await db.user.findUnique({ where: { id: 'new' }, select: { id: true } }), null)
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
  })
  await test('HR candidate pagination reaches member 61 without a new eligibility cap', async () => {
    const item = await seed()
    await db.user.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ id: 'extra' + String(i + 1).padStart(3, '0'), plan: 'PRO' })) })
    await db.hrOrganizationMember.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ id: 'extra' + String(i + 1).padStart(3, '0'), organizationId: item.org.id, userId: 'extra' + String(i + 1).padStart(3, '0'), role: 'MEMBER', status: 'ACTIVE' })) })
    const first = await store.ownerTransferCandidates('hr', item.org.id, 'old')
    assert.equal(first.candidates.length, 50)
    assert.ok(first.nextCursor)
    const second = await store.ownerTransferCandidates('hr', item.org.id, 'old', first.nextCursor)
    assert.equal(second.candidates.length, 11)
    assert.equal(second.nextCursor, null)
    assert.equal(new Set([...first.candidates, ...second.candidates].map(row => row.memberId)).size, 61)
  })
  await test('HR actual creator first membership and exact existing membership replay', async () => {
    const before = await snapshot()
    const created = await access.getOrCreateOrganization('third', 'Synthetic new HR', { slug: 'synthetic-new-hr' })
    assert.equal(created.slug, 'synthetic-new-hr')
    assert.equal((await access.getOrCreateOrganization('third', 'Ignored replay', { slug: 'must-not-create' })).id, created.id)
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.settings, before.settings)
    assert.equal(after.orgs.length, before.orgs.length + 1)
    assert.equal(after.members.length, before.members.length + 1)
    assert.equal(after.members[0].userId, 'third')
    assert.equal(after.members[0].role, 'OWNER')
  })
  await test('HR actual creator rejects retirement before new organization and member writes', async () => {
    await lifecycle.reserveLifecycleOperation(db, retirementId('third'), reservationDigest)
    const before = await snapshot()
    await expectCode(access.getOrCreateOrganization('third', 'Must not create', { slug: 'must-not-create' }), 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual(await snapshot(), before)
  })
  await test('HR creator retirement-first actual User wait leaves no organization', async () => {
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId('third'), reservationDigest)
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(access.getOrCreateOrganization('third', 'Blocked HR', { slug: 'blocked-hr' }))
    const observed = await observeThenRelease(holderPid, 'creator retirement-first', '"User"', release)
    const held = await holder, rejected = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error?.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.hrOrganization.count(), 0)
    assert.equal(await db.hrOrganizationMember.count(), 0)
  })
  await test('HR creator-first actual User wait has one owner membership', async () => {
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      const inTx = accessFor({ $transaction: work => work(tx) })
      const created = await inTx.getOrCreateOrganization('third', 'New HR', { slug: 'new-hr' })
      assert.equal(created.slug, 'new-hr')
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId('third'), reservationDigest))
    const observed = await observeThenRelease(holderPid, 'creator-first retirement', '"User"', release)
    const held = await holder, reserved = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(reserved.ok, true, reserved.error?.message)
    assert.equal(await db.hrOrganization.count(), 1)
    assert.equal(await db.hrOrganizationMember.count({ where: { userId: 'third', role: 'OWNER', status: 'ACTIVE' } }), 1)
  })
  for (const kind of ['organization-create', 'member-patch', 'member-delete', 'organization-patch', 'invite-issue', 'invite-accept']) {
    await test(`HR actual ${kind} route commits one authorized write`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const response = await callActualWriter(kind, item)
      privateStatus(response, 200)
      if (kind === 'organization-create') {
        assert.equal(await db.hrOrganization.count({ where: { slug: 'created-hr' } }), 1)
        assert.equal(await db.hrOrganizationMember.count({ where: { userId: 'third', role: 'OWNER', status: 'ACTIVE' } }), 1)
      }
      if (kind === 'member-patch') assert.equal((await db.hrOrganizationMember.findUnique({ where: { id: item.targetId } })).role, 'MANAGER')
      if (kind === 'member-delete') assert.equal(await db.hrOrganizationMember.count({ where: { id: item.targetId } }), 0)
      if (kind === 'organization-patch') assert.equal((await db.hrOrganization.findUnique({ where: { id: item.org.id } })).name, 'Updated HR')
      if (kind === 'invite-issue') {
        assert.equal(await db.hrInvitation.count({ where: { email: 'third@example.invalid', status: 'PENDING' } }), 1)
        assert.equal(syntheticMailCalls, 1, 'Synthetic email stub only; no mail is sent')
      }
      if (kind === 'invite-accept') {
        assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, userId: 'third', role: 'MEMBER', status: 'ACTIVE' } }), 1)
        assert.equal((await db.hrInvitation.findUnique({ where: { token: 'accept_token' } })).status, 'ACCEPTED')
      }
    })
    await test(`HR actual ${kind} route rejects retirement before any write`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const userId = kind === 'organization-patch' ? 'old' : kind.startsWith('member-') ? 'new' : 'third'
      await lifecycle.reserveLifecycleOperation(db, retirementId(userId), reservationDigest)
      const before = await snapshot(), mailBefore = syntheticMailCalls
      const response = await callActualWriter(kind, item)
      privateStatus(response, 409)
      assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
      assert.deepEqual(await snapshot(), before)
      assert.equal(syntheticMailCalls, mailBefore)
    })
    await test(`HR actual ${kind} retirement-first User wait rejects the route`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const userId = kind === 'organization-patch' ? 'old' : kind.startsWith('member-') ? 'new' : 'third'
      const entered = deferred(), release = deferred()
      let holderPid
      const holder = settle(db.$transaction(async tx => {
        holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
        await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId(userId), reservationDigest)
        entered.resolve(); await release.promise
      }, { isolationLevel: 'Serializable', timeout: 30000 }))
      await started(entered, holder, release)
      const before = await snapshot(), mailBefore = syntheticMailCalls
      const pending = settle(callActualWriter(kind, item))
      const observed = await observeThenRelease(holderPid, `${kind} route retirement-first`, '"User"', release)
      const held = await holder, response = await pending
      if (observed.waitError) throw observed.waitError
      assert.equal(held.ok, true, held.error?.message)
      assert.equal(response.ok, true, response.error?.message)
      privateStatus(response.value, 409)
      assert.equal((await response.value.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
      const after = await snapshot()
      assert.deepEqual(after.users, before.users)
      assert.deepEqual(after.subscriptions, before.subscriptions)
      assert.deepEqual(after.orgs, before.orgs)
      assert.deepEqual(after.members, before.members)
      assert.deepEqual(after.invitations, before.invitations)
      assert.equal(syntheticMailCalls, mailBefore)
    })
    await test(`HR actual ${kind} route-first User wait completes before retirement`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const userId = kind === 'organization-patch' ? 'old' : kind.startsWith('member-') ? 'new' : 'third'
      const entered = deferred(), release = deferred()
      let holderPid
      const routes = tracedActualRoutes(entered, release, pid => { holderPid = pid })
      const holder = settle(callActualWriter(kind, item, routes))
      await started(entered, holder, release)
      const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId(userId), reservationDigest))
      const observed = await observeThenRelease(holderPid, `${kind} route-first retirement`, '"User"', release)
      const response = await holder, reserved = await pending
      if (observed.waitError) throw observed.waitError
      assert.equal(response.ok, true, response.error?.message)
      privateStatus(response.value, 200)
      assert.equal(reserved.ok, true, reserved.error?.message)
      if (kind === 'organization-create') assert.equal(await db.hrOrganization.count({ where: { slug: 'created-hr' } }), 1)
      if (kind === 'member-patch') assert.equal((await db.hrOrganizationMember.findUnique({ where: { id: item.targetId } })).role, 'MANAGER')
      if (kind === 'member-delete') assert.equal(await db.hrOrganizationMember.count({ where: { id: item.targetId } }), 0)
      if (kind === 'organization-patch') assert.equal((await db.hrOrganization.findUnique({ where: { id: item.org.id } })).name, 'Updated HR')
      if (kind === 'invite-issue') assert.equal(await db.hrInvitation.count({ where: { email: 'third@example.invalid', status: 'PENDING' } }), 1)
      if (kind === 'invite-accept') assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, userId: 'third', status: 'ACTIVE' } }), 1)
    })
  }
  for (const kind of ['member-patch', 'member-delete', 'invite-issue', 'invite-accept']) {
    await test(`HR actual ${kind} current OWNER retirement-first User wait rejects the route`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const entered = deferred(), release = deferred(), before = await snapshot(), mailBefore = syntheticMailCalls
      let holderPid
      const holder = settle(db.$transaction(async tx => {
        holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
        await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId('old'), reservationDigest)
        entered.resolve(); await release.promise
      }, { isolationLevel: 'Serializable', timeout: 30000 }))
      await started(entered, holder, release)
      const pending = settle(callActualWriter(kind, item))
      const observed = await observeThenRelease(holderPid, `${kind} current OWNER retirement-first`, '"User"', release)
      const held = await holder, response = await pending
      if (observed.waitError) throw observed.waitError
      assert.equal(held.ok, true, held.error?.message)
      assert.equal(response.ok, true, response.error?.message)
      privateStatus(response.value, 409)
      assert.equal((await response.value.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
      const after = await snapshot()
      assert.deepEqual(after.users, before.users)
      assert.deepEqual(after.subscriptions, before.subscriptions)
      assert.deepEqual(after.orgs, before.orgs)
      assert.deepEqual(after.members, before.members)
      assert.deepEqual(after.invitations, before.invitations)
      assert.equal(syntheticMailCalls, mailBefore)
    })
    await test(`HR actual ${kind} route-first current OWNER User wait completes before retirement`, async () => {
      const item = await seed()
      if (kind === 'invite-accept') await seedAcceptInvite(item)
      const entered = deferred(), release = deferred()
      let holderPid
      const routes = tracedActualRoutes(entered, release, pid => { holderPid = pid })
      const holder = settle(callActualWriter(kind, item, routes))
      await started(entered, holder, release)
      const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId('old'), reservationDigest))
      const observed = await observeThenRelease(holderPid, `${kind} route-first current OWNER retirement`, '"User"', release)
      const response = await holder, reserved = await pending
      if (observed.waitError) throw observed.waitError
      assert.equal(response.ok, true, response.error?.message)
      privateStatus(response.value, 200)
      assert.equal(reserved.ok, true, reserved.error?.message)
      if (kind === 'member-patch') assert.equal((await db.hrOrganizationMember.findUnique({ where: { id: item.targetId } })).role, 'MANAGER')
      if (kind === 'member-delete') assert.equal(await db.hrOrganizationMember.count({ where: { id: item.targetId } }), 0)
      if (kind === 'invite-issue') assert.equal(await db.hrInvitation.count({ where: { email: 'third@example.invalid', status: 'PENDING' } }), 1)
      if (kind === 'invite-accept') assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, userId: 'third', status: 'ACTIVE' } }), 1)
    })
  }
  for (const kind of ['member', 'invite']) await test(`HR ${kind} shared writer has one bounded actual mutation`, async () => {
    const item = await seed()
    assert.equal(await dependentWrite(kind, item), kind === 'member' ? 'member-updated' : 'invitation-created')
    assert.equal(await db.hrOrganizationMember.count({ where: { id: item.targetId, status: 'SUSPENDED' } }), kind === 'member' ? 1 : 0)
    assert.equal(await db.hrInvitation.count({ where: { token: 'synthetic_invite' } }), kind === 'invite' ? 1 : 0)
  })
  await test('HR invitation registration phantom restarts discovery and respects a new retirement fence', async () => {
    const item = await seed(), registrationReady = deferred(), release = deferred()
    let holderPid, first = true
    let reservation
    const phantomDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return async (work, options) => {
        if (first) {
          first = false
          await db.user.create({ data: { id: 'late', email: 'late@example.invalid', plan: 'PRO' } })
          const entered = deferred()
          reservation = settle(db.$transaction(async tx => {
            holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
            await lifecycle.reserveLifecycleOperation({ $transaction: run => run(tx) }, retirementId('late'), reservationDigest)
            entered.resolve(); await release.promise
          }, { isolationLevel: 'Serializable', timeout: 30000 }))
          await started(entered, reservation, release)
          registrationReady.resolve()
        }
        return target.$transaction(work, options)
      }
      return Reflect.get(target, property, target)
    } })
    const phantomMembership = load('src/lib/hr/membership-write.ts', { '@prisma/client': { Prisma },
      '@/lib/prisma': { prisma: phantomDb }, '@/lib/account-lifecycle/store': lifecycle })
    const route = load('src/app/api/hr/organization/invite/route.ts', {
      ...routeMocks, '@/lib/hr/membership-write': phantomMembership })
    const pending = settle(route.POST(request({ email: 'late@example.invalid' })))
    await started(registrationReady, pending, release)
    const observed = await observeThenRelease(holderPid, 'invitation registration phantom retirement-first', '"User"', release)
    const held = await reservation, response = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(response.ok, true, response.error?.message)
    privateStatus(response.value, 409)
    assert.equal((await response.value.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(await db.hrInvitation.count({ where: { organizationId: item.org.id } }), 0)
    assert.equal(syntheticMailCalls, 0)
  })
  await test('HR two actual invitation accept routes compete for the last FREE member slot', async () => {
    const item = await seed()
    await db.user.update({ where: { id: 'old' }, data: { plan: 'FREE' }, select: { id: true } })
    await db.hrOrganizationMember.delete({ where: { id: item.targetId } })
    for (const [token, email] of [['new_invite', 'new@example.invalid'], ['third_invite', 'third@example.invalid']]) {
      await db.hrInvitation.create({ data: { organizationId: item.org.id, email, role: 'MEMBER', token,
        invitedBy: 'old', status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 86400000) } })
    }
    const acceptFor = (id, token) => {
      const route = load('src/app/api/hr/organization/invite/accept/route.ts', {
        ...routeMocks, 'next-auth': { getServerSession: async () => ({ user: { id, name: 'Synthetic' } }) } })
      return route.POST(request({ token }))
    }
    const results = await Promise.all([acceptFor('new', 'new_invite'), acceptFor('third', 'third_invite')])
    assert.deepEqual(results.map(response => response.status).sort(), [200, 403])
    for (const response of results) privateStatus(response, response.status)
    assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, status: 'ACTIVE' } }), 2)
    assert.equal(await db.hrInvitation.count({ where: { organizationId: item.org.id, status: 'ACCEPTED' } }), 1)
    assert.equal(await db.hrInvitation.count({ where: { organizationId: item.org.id, status: 'PENDING' } }), 1)
  })
  await test('HR public invitation GET reports expiry without mutating its receipt or membership', async () => {
    const item = await seed()
    await db.hrInvitation.create({ data: { organizationId: item.org.id, email: 'third@example.invalid',
      role: 'MEMBER', token: 'expired_read', invitedBy: 'old', status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000) } })
    const before = await snapshot()
    const response = await inviteReadRoute.GET(request(null), { params: Promise.resolve({ token: 'expired_read' }) })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.invitation.status, 'EXPIRED')
    assert.deepEqual(await snapshot(), before)
  })
  await test('HR public invitation GET reads accepted and unknown tokens without writes', async () => {
    const item = await seed()
    await db.hrInvitation.create({ data: { organizationId: item.org.id, email: 'third@example.invalid',
      role: 'MEMBER', token: 'accepted_read', invitedBy: 'old', status: 'ACCEPTED',
      expiresAt: new Date(Date.now() - 1000) } })
    const before = await snapshot()
    const accepted = await inviteReadRoute.GET(request(null), { params: Promise.resolve({ token: 'accepted_read' }) })
    assert.equal(accepted.status, 200)
    assert.equal((await accepted.json()).invitation.status, 'ACCEPTED')
    const missing = await inviteReadRoute.GET(request(null), { params: Promise.resolve({ token: 'unknown_token' }) })
    assert.equal(missing.status, 404)
    assert.deepEqual(await snapshot(), before)
    assert.equal(syntheticMailCalls, 0)
  })
  await test('HR actual accept expires a pending invitation without creating a membership', async () => {
    const item = await seed()
    await db.hrInvitation.create({ data: { organizationId: item.org.id, email: 'third@example.invalid',
      role: 'MEMBER', token: 'expired_accept', invitedBy: 'old', status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000) } })
    routeActor = 'third'
    const response = await acceptRoute.POST(request({ token: 'expired_accept' }))
    privateStatus(response, 410)
    assert.equal((await response.json()).code, 'INVITE_EXPIRED')
    assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, userId: 'third' } }), 0)
    assert.equal((await db.hrInvitation.findUnique({ where: { token: 'expired_accept' } })).status, 'EXPIRED')
    assert.equal(syntheticMailCalls, 0)
  })
  await test('HR actual accept cannot claim the same token twice', async () => {
    const item = await seed()
    await seedAcceptInvite(item)
    routeActor = 'third'
    const first = await acceptRoute.POST(request({ token: 'accept_token' }))
    privateStatus(first, 200)
    const afterFirst = await snapshot()
    const second = await acceptRoute.POST(request({ token: 'accept_token' }))
    privateStatus(second, 409)
    assert.equal((await second.json()).code, 'INVITE_UNAVAILABLE')
    assert.deepEqual(await snapshot(), afterFirst)
    assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, userId: 'third', status: 'ACTIVE' } }), 1)
  })
  await test('HR actual invitation issue is MEMBER-only for seven days and respects the last FREE seat', async () => {
    const item = await seed()
    const startedAt = Date.now()
    const issued = await inviteRoute.POST(request({ email: 'third@example.invalid', role: 'OWNER' }))
    privateStatus(issued, 200)
    const body = await issued.json()
    assert.equal(body.invitation.role, 'MEMBER')
    const row = await db.hrInvitation.findUnique({ where: { token: body.invitation.token } })
    assert.equal(row.role, 'MEMBER')
    assert.ok(row.expiresAt.getTime() >= startedAt + 7 * 86400000)
    assert.ok(row.expiresAt.getTime() <= Date.now() + 7 * 86400000)
    assert.equal(syntheticMailCalls, 1, 'Only the synthetic mail stub is called')
    await db.user.update({ where: { id: 'old' }, data: { plan: 'FREE' }, select: { id: true } })
    const before = await snapshot(), mailBefore = syntheticMailCalls
    const denied = await inviteRoute.POST(request({ email: 'fourth@example.invalid' }))
    privateStatus(denied, 403)
    assert.equal((await denied.json()).code, 'HR_ORG_MEMBER_LIMIT')
    assert.deepEqual(await snapshot(), before)
    assert.equal(syntheticMailCalls, mailBefore)
    assert.equal(await db.hrOrganizationMember.count({ where: { organizationId: item.org.id, status: 'ACTIVE' } }), 2)
  })
  for (const kind of ['member', 'invite']) await test(`HR ${kind} retirement-first User wait rejects shared writer`, async () => {
    const item = await seed(), userId = kind === 'member' ? 'new' : 'third', before = await snapshot()
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId(userId), reservationDigest)
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(dependentWrite(kind, item))
    const observed = await observeThenRelease(holderPid, `${kind} retirement-first`, '"User"', release)
    const held = await holder, rejected = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error?.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.orgs, before.orgs)
    assert.deepEqual(after.members, before.members)
    assert.deepEqual(after.invitations, before.invitations)
  })
  for (const kind of ['member', 'invite']) await test(`HR ${kind} writer-first User wait leaves one completed mutation`, async () => {
    const item = await seed(), userId = kind === 'member' ? 'new' : 'third'
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      const client = { hrOrganizationMember: tx.hrOrganizationMember, user: tx.user,
        $transaction: work => work(tx) }
      assert.equal(await dependentWrite(kind, item, client), kind === 'member' ? 'member-updated' : 'invitation-created')
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId(userId), reservationDigest))
    const observed = await observeThenRelease(holderPid, `${kind} writer-first`, '"User"', release)
    const held = await holder, reserved = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(reserved.ok, true, reserved.error?.message)
    assert.equal(await db.hrOrganizationMember.count({ where: { id: item.targetId, status: 'SUSPENDED' } }), kind === 'member' ? 1 : 0)
    assert.equal(await db.hrInvitation.count({ where: { token: 'synthetic_invite' } }), kind === 'invite' ? 1 : 0)
  })
  for (const userId of ['old', 'new']) await test(`HR ${userId} retirement-first User wait rejects new transfer`, async () => {
    const item = await seed(), id = identity(item), before = await snapshot()
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await lifecycle.reserveLifecycleOperation({ $transaction: work => work(tx) }, retirementId(userId), reservationDigest)
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(store.transferOwner(id, input(item), db))
    const observed = await observeThenRelease(holderPid, `${userId} retirement-first`, '"User"', release)
    const held = await holder, rejected = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error?.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual(await roles(), { owner: 'OWNER', target: 'MEMBER' })
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 0)
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.orgs, before.orgs)
    assert.deepEqual(after.members, before.members)
    assert.deepEqual(after.invitations, before.invitations)
  })
  for (const userId of ['old', 'new']) await test(`HR ${userId} transfer-first User wait preserves one committed result`, async () => {
    const item = await seed(), id = identity(item)
    const entered = deferred(), release = deferred()
    let holderPid
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      const proxy = { $queryRaw: (...args) => db.$queryRaw(...args), $transaction: work => work(tx) }
      assert.equal((await store.transferOwner(id, input(item), proxy)).phase, 'committed')
      entered.resolve(); await release.promise
    }, { isolationLevel: 'Serializable', timeout: 30000 }))
    await started(entered, holder, release)
    const pending = settle(lifecycle.reserveLifecycleOperation(db, retirementId(userId), reservationDigest))
    const observed = await observeThenRelease(holderPid, `${userId} transfer-first`, '"User"', release)
    const held = await holder, reserved = await pending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(reserved.ok, true, reserved.error?.message)
    assert.deepEqual(await roles(), { owner: 'ADMIN', target: 'OWNER' })
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
    if (userId === 'old') await retirement.checkAccountRetirementSafe(db, userId)
    else await assert.rejects(retirement.checkAccountRetirementSafe(db, userId), error => error.reason === 'ownership')
  })
  for (const first of ['cancel', 'transfer']) await test(`HR ${first}-first operation wait has one durable terminal result`, async () => {
    const item = await seed(), id = identity(item)
    const entered = deferred(), release = deferred(), preflightDone = deferred(), advance = deferred()
    let holderPid, firstPending
    if (first === 'transfer') {
      let transactions = 0
      const controlled = { $queryRaw: (...args) => db.$queryRaw(...args),
        $transaction: async (work, options) => {
          const value = await db.$transaction(work, options)
          if (++transactions === 1) { preflightDone.resolve(); await advance.promise }
          return value
        },
      }
      firstPending = settle(store.transferOwner(id, input(item), controlled))
      await started(preflightDone, firstPending, release)
    }
    const holder = settle(db.$transaction(async tx => {
      holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
      await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${types.ownerTransferKey(id)})::bigint)`
      entered.resolve(); await release.promise
    }, { isolationLevel: 'ReadCommitted', timeout: 30000 }))
    await started(entered, holder, release)
    if (first === 'transfer') advance.resolve()
    else firstPending = settle(store.cancelOwnerTransfer(id, db))
    let firstPid
    try { firstPid = await waitForLock(holderPid, `${first}-first advisory`, 'pg_advisory_xact_lock') }
    catch (error) { release.resolve(); await Promise.allSettled([holder, firstPending]); throw error }
    const secondPending = settle(first === 'cancel' ? store.transferOwner(id, input(item), db) : store.cancelOwnerTransfer(id, db))
    const observed = await observeThenRelease(firstPid, `${first}-first contender`, '"User"', release)
    const held = await holder, one = await firstPending, two = await secondPending
    if (observed.waitError) throw observed.waitError
    assert.equal(held.ok, true, held.error?.message)
    assert.equal(one.ok, true, one.error?.message)
    assert.equal(two.ok, true, two.error?.message)
    assert.equal(one.value.phase, first === 'cancel' ? 'canceled' : 'committed')
    assert.deepEqual(dto(two.value), dto(one.value))
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
    assert.deepEqual(await roles(), first === 'cancel'
      ? { owner: 'OWNER', target: 'MEMBER' } : { owner: 'ADMIN', target: 'OWNER' })
  })
  await test('HR distinct UUID transfers serialize on User and commit only the first owner change', async () => {
    const item = await seed(), firstId = identity(item), secondId = identity(item)
    const before = await snapshot(), entered = deferred(), release = deferred()
    let holderPid
    const controlled = { $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, options) => db.$transaction(async tx => {
        const value = await work(tx)
        if (options?.isolationLevel === 'Serializable') {
          holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
          entered.resolve(); await release.promise
        }
        return value
      }, options) }
    const first = settle(store.transferOwner(firstId, input(item), controlled))
    await started(entered, first, release)
    const second = settle(store.transferOwner(secondId, input(item), db))
    const observed = await observeThenRelease(holderPid, 'distinct UUID second transfer User wait', '"User"', release)
    const winner = await first, loser = await second
    if (observed.waitError) throw observed.waitError
    assert.equal(winner.ok, true, winner.error?.message)
    assert.equal(winner.value.phase, 'committed')
    assert.equal(loser.ok, false)
    assert.equal(loser.error?.code, 'OWNER_TRANSFER_CONFIRMATION_CHANGED')
    assert.deepEqual(await roles(), { owner: 'ADMIN', target: 'OWNER' })
    const after = await snapshot()
    assert.deepEqual(after.users, before.users)
    assert.deepEqual(after.subscriptions, before.subscriptions)
    assert.deepEqual(after.orgs, before.orgs)
    assert.deepEqual(after.invitations, before.invitations)
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(firstId) } }), 1)
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(secondId) } }), 0)
  })
  for (const faultAt of ['demote', 'promote', 'receipt']) await test(`HR ${faultAt} fault rolls back both roles and receipt; same ID retries`, async () => {
    const item = await seed(), id = identity(item), before = await snapshot()
    let roleWrites = 0, injected = false
    const controlled = { $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (work, options) => db.$transaction(tx => {
        const faultTx = new Proxy(tx, { get(target, property) {
          if (property === '$executeRaw') return async (...args) => {
            const value = await target.$executeRaw(...args)
            if (String(args[0]?.strings?.join('')).includes('SET role')) {
              roleWrites++
              if (!injected && (faultAt === 'demote' && roleWrites === 1 || faultAt === 'promote' && roleWrites === 2)) {
                injected = true
                throw Error('synthetic role fault')
              }
            }
            return value
          }
          if (property === 'systemSetting') return new Proxy(target.systemSetting, { get(delegate, method) {
            if (method === 'create') return async (...args) => {
              if (!injected && faultAt === 'receipt') { injected = true; throw Error('synthetic receipt fault') }
              return delegate.create(...args)
            }
            return delegate[method]
          } })
          return target[property]
        } })
        return work(faultTx)
      }, options),
    }
    await assert.rejects(store.transferOwner(id, input(item), controlled), error => error?.message === `synthetic ${faultAt === 'receipt' ? 'receipt' : 'role'} fault`)
    assert.equal(injected, true)
    assert.deepEqual(await snapshot(), before, 'role, complete SystemSetting values, User, org and invite must roll back')
    const result = await store.transferOwner(id, input(item), db)
    assert.equal(result.phase, 'committed')
    assert.deepEqual(await roles(), { owner: 'ADMIN', target: 'OWNER' })
    assert.equal(await db.systemSetting.count({ where: { key: types.ownerTransferKey(id) } }), 1)
  })
  assert.deepEqual(sourceHashes(), initialSourceHashes, 'Fixture source changed during the native run')
  const report = { checkedAt: new Date().toISOString(), passed: cases.length, cases, waits, operationWaits,
    sourceHashes: initialSourceHashes, h5ExpectedSha256: expectedFile ? expectedDigest : null,
    scope: 'Private Unix socket only; actual Prisma, pinned before36 route, HR store/creator, named HTTP routes and shared writer. User and UserServiceSubscription scalars, HR counters and complete SystemSetting values are snapshotted. No provider or mail is sent.' }
  fs.writeFileSync(process.env.DOYA_OWNER_HR_EVIDENCE, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: cases.length, names: cases }))
}
run().catch(async error => {
  console.error(error)
  process.exitCode = 1
  try { await drainPendingAfterFailure() }
  catch (drainError) { console.error('Private fixture secondary drain failure', drainError) }
}).finally(async () => { await db.$disconnect() })
