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
  assert.equal(expectedPhase, 'before')
  assert.equal(process.env.DOYA_TEST_BASELINE, baselineDirectory, 'H5 before must use pinned v6 overlay')
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
  'scripts/security-regression/retirement-fixture.cjs', 'scripts/security-regression/hr-owner-load-v6.cjs', 'prisma/schema.prisma', 'package.json', 'package-lock.json',
  'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js', __filename,
  'scripts/security-regression/fixtures/hr-owner-before36/transfer-owner.route.txt',
  'scripts/security-regression/fixtures/hr-owner-before36/manifest.json',
]
const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
const loadedSourceHashes = sourceHashes()
const baselineRoot = process.env.DOYA_TEST_BASELINE
assert.ok(baselineRoot, 'H3 before requires owned strict v6 baseline')
const baselineFiles = [
  'src/app/api/hr/organization/invite/[token]/route.ts',
  'src/app/api/hr/organization/invite/accept/route.ts',
  'src/app/api/hr/organization/invite/route.ts',
  'src/app/api/hr/organization/members/[id]/route.ts',
  'src/app/api/hr/organization/route.ts',
  'src/lib/account-lifecycle/admin-subscription-fact.ts',
  'src/lib/account-lifecycle/admin-subscription-plan.ts',
  'src/lib/account-lifecycle/self-subscription-settlement.ts',
  'src/lib/account-lifecycle/state.ts',
  'src/lib/account-lifecycle/store.ts',
  'src/lib/account-lifecycle/subscription-plan.ts',
  'src/lib/account-lifecycle/subscription-provider.ts',
  'src/lib/account-retirement.ts',
  'src/lib/hr/access.ts',
  'src/lib/hr/billing.ts',
  'src/lib/hr/constants.ts',
  'src/lib/hr/membership-write.ts',
  'src/lib/hr/owner-transfer/receipt.ts',
  'src/lib/hr/owner-transfer/store.ts',
  'src/lib/hr/owner-transfer/types.ts',
  'src/lib/hr/types.ts',
  'src/lib/private-api-response.ts',
]
const baselineHashes = () => Object.fromEntries(baselineFiles.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(baselineRoot, file))).digest('hex')]))
const loadedBaselineHashes = baselineHashes()
const { Prisma, PrismaClient } = require('@prisma/client')
const { load } = require('../../../scripts/security-regression/hr-owner-load-v6.cjs')
const { retirementModels } = require('../../../scripts/security-regression/retirement-fixture.cjs')
assert.deepEqual(sourceHashes(), loadedSourceHashes, 'Fixture source changed during module import')
assert.deepEqual(baselineHashes(), loadedBaselineHashes, 'Strict v6 baseline changed during module import')

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
      const evidence = { name, holderPid, waiterPid: blocked.pid }
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


// Independent before phase. The v6 route/helper stay unchanged; the controlled
// client only observes the actual transaction and recipient lookups.
const h3Diagnostic = { sequence: [], attempts: [], discoveries: [], safetyAccepted: false }
function classifyH3Observation({ httpStatus, responseCode, invitationCount, mailCalls, attempts, discoveries }) {
  if (httpStatus === 200 && invitationCount === 1 && mailCalls === 1 &&
      attempts.some(row => row.outcome === 'committed')) return 'committed_email_invite_after_retirement'
  if (httpStatus === 409 && responseCode === 'ACCOUNT_RETIREMENT_IN_PROGRESS' &&
      invitationCount === 0 && mailCalls === 0 && attempts.length >= 2 &&
      attempts[0].outcome === 'rejected' &&
      attempts.some(row => row.outcome === 'rejected' && row.errorCode === 'ACCOUNT_RETIREMENT_IN_PROGRESS') &&
      discoveries.some(row => row.place === 'outer' && row.found === 'late')) return 'retirement_rejected_after_retry'
  if (httpStatus === 500 && invitationCount === 0 && mailCalls === 0 && attempts.length > 0 &&
      attempts.every(row => row.outcome === 'rejected' &&
        (row.errorCode === 'P2034' || row.errorCode === 'P2010' && ['40001', '40P01'].includes(row.sqlState)))) {
    return 'serialization_aborted_no_write'
  }
  throw Error('H3 observation outside known classifications: HTTP ' + httpStatus +
    ', attempts=' + attempts.length + ', invitations=' + invitationCount + ', mail=' + mailCalls)
}
async function run() {
  assert.equal(process.env.DOYA_OWNER_HR_H3_BEFORE, '1', 'H3 before must be an explicit independent phase')
  assert.ok(process.env.DOYA_OWNER_HR_H3_EVIDENCE, 'H3 before requires a separate owned evidence path')
  const initialSourceHashes = sourceHashes()
  assert.deepEqual(initialSourceHashes, loadedSourceHashes, 'Fixture source changed while loading real modules')
  assert.deepEqual(baselineHashes(), loadedBaselineHashes, 'Strict v6 baseline changed before H3 setup')
  await setup()
  await reset()
  const item = await seed()
  const email = 'late@example.invalid'
  assert.equal(await db.user.findUnique({ where: { email }, select: { id: true } }), null)
  assert.equal(await db.hrInvitation.count({ where: { organizationId: item.org.id } }), 0)
  const { sequence, attempts, discoveries } = h3Diagnostic
  const mark = (event, details = {}) => sequence.push({ order: sequence.length + 1, event, ...details })
  const observedUser = (delegate, place, attempt) => new Proxy(delegate, { get(target, property) {
    if (property !== 'findUnique') return Reflect.get(target, property, target)
    return async args => {
      const value = await target.findUnique(args)
      if (args?.where?.email === email) {
        const discovery = { place, attempt, found: value?.id || null }
        discoveries.push(discovery)
        mark('recipient-discovery', discovery)
      }
      return value
    }
  } })
  const observedDb = new Proxy(db, { get(target, property) {
    if (property === 'user') return observedUser(target.user, 'outer', null)
    if (property !== '$transaction') return Reflect.get(target, property, target)
    return async (work, options) => {
      const attempt = { index: attempts.length + 1, isolationRequested: options?.isolationLevel, outcome: 'started' }
      attempts.push(attempt)
      try {
        const value = await target.$transaction(async tx => {
          // This is the first SQL in the callback. Its snapshot-identifying
          // query fixes the Serializable snapshot before the actual User lock.
          const [seen] = await tx.$queryRawUnsafe(`SELECT pg_backend_pid() AS pid,
            current_setting('transaction_isolation') AS isolation,
            txid_current_snapshot()::text AS snapshot`)
          assert.equal(seen.isolation.toLowerCase(), 'serializable')
          attempt.pid = seen.pid
          attempt.snapshot = seen.snapshot
          mark('serializable-snapshot', { attempt: attempt.index, pid: seen.pid, snapshot: seen.snapshot })
          const observedTx = new Proxy(tx, { get(inner, key) {
            if (key === 'user') return observedUser(inner.user, 'inner', attempt.index)
            return Reflect.get(inner, key, inner)
          } })
          const result = await work(observedTx)
          mark('transaction-callback-returned', { attempt: attempt.index })
          return result
        }, options)
        attempt.outcome = 'committed'
        mark('transaction-committed', { attempt: attempt.index })
        return value
      } catch (error) {
        attempt.outcome = 'rejected'
        attempt.errorCode = error?.code || null
        attempt.sqlState = error?.meta?.code || null
        mark('transaction-rejected', { attempt: attempt.index, code: attempt.errorCode, sqlState: attempt.sqlState })
        throw error
      }
    }
  } })
  const observedMembership = load('src/lib/hr/membership-write.ts', {
    '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: observedDb }, '@/lib/account-lifecycle/store': lifecycle,
  })
  const observedRoute = load('src/app/api/hr/organization/invite/route.ts', {
    ...routeMocks, '@/lib/hr/membership-write': observedMembership,
  })
  const entered = deferred(), release = deferred()
  let holderPid = null, waiterPid = null
  const holder = settle(db.$transaction(async tx => {
    holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
    await tx.$queryRawUnsafe('SELECT id FROM ' + table('User') + ' WHERE id = $1 FOR UPDATE', 'old')
    mark('owner-holder-locked', { holderPid })
    entered.resolve()
    await release.promise
  }, { isolationLevel: 'ReadCommitted', timeout: 30000 }))
  let pending = null, originalError = null, lateIdentity = null, reservedValue = null, visibleReceiptValue = null
  try {
    await started(entered, holder, release)
    pending = settle(observedRoute.POST(request({ email })))
    const outerAbsent = () => discoveries.some(row => row.place === 'outer' && row.found === null)
    // The User lock observation is from pg_stat_activity and pg_blocking_pids,
    // after the transaction's first snapshot SQL, not from a sleep or callback entry.
    let waitWitness = null
    for (let n = 0; n < 200; n++) {
      const rows = await db.$queryRawUnsafe('SELECT pid, pg_blocking_pids(pid) AS blockers, query, wait_event_type AS "waitEventType" FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type=$1', 'Lock')
      const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes(table('User')))
      if (blocked) {
        waitWitness = { holderPid, waiterPid: blocked.pid, blockingPids: blocked.blockers,
          waitEventType: blocked.waitEventType, queryContainsUser: blocked.query.includes(table('User')) }
        break
      }
      await new Promise(done => setTimeout(done, 25))
    }
    assert.ok(waitWitness, 'Actual User row wait must be observed before registration')
    waiterPid = waitWitness.waiterPid
    assert.equal(waitWitness.waitEventType, 'Lock')
    assert.ok(waitWitness.blockingPids.includes(holderPid))
    assert.ok(outerAbsent(), 'Actual outer recipient discovery must be absent')
    assert.equal(attempts[0]?.pid, waiterPid, 'Observed waiter must be the snapshot-owning transaction')
    assert.ok(sequence.some(row => row.event === 'serializable-snapshot' && row.pid === waiterPid))
    mark('actual-user-wait', waitWitness)
    await db.user.create({ data: { id: 'late', email, plan: 'PRO' } })
    mark('late-registration-committed')
    lateIdentity = retirementId('late')
    reservedValue = await lifecycle.reserveLifecycleOperation(db, lateIdentity, reservationDigest)
    assert.equal(reservedValue.phase, 'reserved')
    mark('late-retirement-reservation-committed')
    const visibleUser = await db.user.findUnique({ where: { email }, select: { id: true } })
    const visibleReceipt = await db.systemSetting.findUnique({ where: { key: state.lifecycleReceiptKey(lateIdentity) } })
    assert.equal(visibleUser?.id, 'late')
    assert.ok(visibleReceipt)
    visibleReceiptValue = visibleReceipt.value
    mark('external-late-user-and-receipt-visible')
  } catch (error) { originalError = error }
  finally {
    mark('owner-holder-released')
    release.resolve()
  }
  let settled, drainError = null, drainTimer
  try {
    settled = await Promise.race([Promise.allSettled([holder, pending].filter(Boolean)),
      new Promise((_, reject) => { drainTimer = setTimeout(() => reject(Error('H3 phase drain exceeded 35 seconds')), 35000) })])
  } catch (error) { drainError = error }
  finally { clearTimeout(drainTimer) }
  if (originalError) {
    if (drainError) console.error('H3 secondary drain failure', drainError)
    throw originalError
  }
  if (drainError) throw drainError
  if (settled.some(row => row.status !== 'fulfilled')) throw Error('H3 passive settlement failed')
  const held = await holder, outcome = await pending
  assert.equal(held.ok, true, held.error?.message)
  assert.equal(outcome.ok, true, outcome.error?.message)
  const response = outcome.value, body = await response.json()
  const invitationRows = await db.hrInvitation.findMany({ where: { organizationId: item.org.id } })
  const memberRows = await db.hrOrganizationMember.findMany({ where: { organizationId: item.org.id, userId: 'late' } })
  const receiptAfter = await db.systemSetting.findUnique({ where: { key: state.lifecycleReceiptKey(lateIdentity) } })
  assert.ok(receiptAfter && reservedValue, 'Retirement receipt must survive the issue attempt')
  assert.equal(receiptAfter.value, visibleReceiptValue, 'Invite outcome must not alter the retirement receipt')
  assert.equal(memberRows.length, 0)
  const order = event => sequence.find(row => row.event === event)?.order
  for (const [before, after] of [
    ['serializable-snapshot', 'actual-user-wait'],
    ['actual-user-wait', 'late-registration-committed'],
    ['late-registration-committed', 'late-retirement-reservation-committed'],
    ['late-retirement-reservation-committed', 'external-late-user-and-receipt-visible'],
    ['external-late-user-and-receipt-visible', 'owner-holder-released'],
  ]) assert.ok(order(before) < order(after), `H3 ordering ${before} before ${after}`)
  const classification = classifyH3Observation({ httpStatus: response.status, responseCode: body.code || null,
    invitationCount: invitationRows.length, mailCalls: syntheticMailCalls, attempts, discoveries })
  if (classification === 'committed_email_invite_after_retirement') {
    const invite = invitationRows[0]
    assert.equal(invite.email, email)
    assert.equal(invite.role, 'MEMBER')
    assert.equal(invite.status, 'PENDING')
    assert.ok(Math.abs(invite.expiresAt.getTime() - Date.now() - 7 * 86400000) < 60000)
  }
  assert.deepEqual(sourceHashes(), initialSourceHashes, 'Fixture source changed during H3 observation')
  assert.deepEqual(baselineHashes(), loadedBaselineHashes, 'Strict v6 baseline changed during H3 observation')
  const report = { checkedAt: new Date().toISOString(), phase: 'v6_snapshot_after_registration_before',
    classification, safetyAccepted: false, httpStatus: response.status, responseCode: body.code || null,
    sequence, attempts, discoveries, wait: sequence.find(row => row.event === 'actual-user-wait'), invitations: invitationRows.length,
    membershipCreated: memberRows.length, syntheticMailCalls, sourceHashes: initialSourceHashes, baselineHashes: loadedBaselineHashes,
    h5ExpectedSha256: expectedFile ? expectedDigest : null,
    scope: 'Old v6 route/helper, actual private Unix PostgreSQL observation only; no mail/provider/production writes.' }
  fs.writeFileSync(process.env.DOYA_OWNER_HR_H3_EVIDENCE, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ phase: report.phase, classification, safetyAccepted: false, httpStatus: response.status }))
}
run().catch(async error => {
  console.error(error)
  process.exitCode = 1
  let drainError = null
  try { await drainPendingAfterFailure() }
  catch (failure) { drainError = failure; console.error('Private fixture secondary drain failure', failure) }
  if (process.env.DOYA_OWNER_HR_H3_EVIDENCE) {
    const report = { checkedAt: new Date().toISOString(), phase: 'v6_snapshot_after_registration_before',
      status: 'failed', classification: 'unknown', safetyAccepted: false,
      error: { name: error?.name || null, code: error?.code || null, sqlState: error?.meta?.code || null,
        message: String(error?.message || '').slice(0, 240) },
      drain: { settled: drainError === null, errorName: drainError?.name || null },
      sequence: h3Diagnostic.sequence, attempts: h3Diagnostic.attempts, discoveries: h3Diagnostic.discoveries,
      sourceHashes: loadedSourceHashes, baselineHashes: loadedBaselineHashes }
    fs.writeFileSync(process.env.DOYA_OWNER_HR_H3_EVIDENCE, JSON.stringify(report, null, 2) + '\n')
  }
}).finally(async () => { await db.$disconnect() })
