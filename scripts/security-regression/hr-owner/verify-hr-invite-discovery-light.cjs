// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require(require('node:path').join(TEST_DEPS_ROOT, 'node_modules/typescript'))
const root = TEST_SOURCE_ROOT
const load = (file, mocks) => {
  const candidate = path.join(root, file)
  const source = fs.readFileSync(fs.existsSync(candidate) ? candidate : path.join(TEST_DEPS_ROOT, file), 'utf8')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in mocks, `${file}: unmocked ${name}`)
    return mocks[name]
  }, Date, Error, Set, Map, JSON, Object, Array, String, Number, Promise, Headers, Response,
  process: { env: {} }, console }, { filename: file })
  return exports
}
const owner = { id: 'ownerMember', userId: 'actor', role: 'OWNER', status: 'ACTIVE' }
let mode = 'stable', lookups = 0, locks = [], fences = 0, creates = 0, txs = 0, mails = 0, audits = 0
const db = {
  hrOrganizationMember: {
    findMany: async () => [owner],
    count: async () => 1,
    findFirst: async () => null,
  },
  hrOrganization: { findUnique: async () => ({ name: 'Synthetic HR' }) },
  hrInvitation: {
    findFirst: async () => null,
    create: async ({ data }) => { creates++; return { id: 'invitation', ...data } },
  },
  user: { findUnique: async () => {
    lookups++
    return { id: mode === 'drift' && lookups % 2 === 0 ? 'other' : 'recipient' }
  } },
  $queryRaw: async query => query?.strings?.join('').includes('hr_organizations')
    ? [{ id: 'org' }] : [{ id: 'ownerMember' }],
  $transaction: async run => { txs++; return run(db) },
}
const prisma = { sql: (strings, ...values) => ({ strings, values }), join: values => values }
const nextServer = { NextResponse: { json: (body, init) => Response.json(body, init) } }
const privateApi = load('src/lib/private-api-response.ts', { 'next/server': nextServer })
const helper = load('src/lib/hr/membership-write.ts', {
  '@prisma/client': { Prisma: prisma }, '@/lib/prisma': { prisma: db },
  '@/lib/account-lifecycle/store': {
    lockLifecycleUsers: async (_tx, ids) => { locks.push([...ids]); assert.deepEqual([...ids], ['actor', 'recipient']) },
    assertRetirementMembershipWritable: async () => { fences++ },
  },
})
const role = { ADMIN: 'ADMIN', MEMBER: 'MEMBER', OWNER: 'OWNER' }
const route = load('src/app/api/hr/organization/invite/route.ts', {
  'next/server': nextServer,
  'next-auth': { getServerSession: async () => ({ user: { id: 'actor', name: 'Synthetic actor' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db },
  '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', memberId: 'ownerMember', userId: 'actor', role: role.OWNER }), hasMinRole: () => true },
  '@/lib/hr/types': { HrMemberRole: role },
  '@/lib/hr/billing': { getOrgPlan: async () => 'PRO', getOrgPlanLimits: () => ({ maxMembers: -1 }) },
  '@/lib/hr/membership-write': helper,
  '@/lib/account-lifecycle/state': { LifecycleError: class LifecycleError extends Error {} },
  '@/lib/private-api-response': privateApi,
  '@/lib/hr/email': { sendInvitationEmail: async () => { mails++; return true } },
  '@/lib/hr/audit': { logAudit: async () => { audits++ } },
  crypto: require('node:crypto'),
})
const request = { json: async () => ({ email: 'recipient@example.invalid' }) }
;(async () => {
  const stable = await route.POST(request)
  assert.equal(stable.status, 200)
  assert.equal(stable.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(stable.headers.get('Vary'), 'Cookie')
  assert.equal((await stable.json()).invitation.email, 'recipient@example.invalid')
  assert.deepEqual([lookups, locks.length, fences, creates, txs, mails, audits], [3, 1, 1, 1, 1, 1, 1])
  mode = 'drift'; lookups = 0; locks = []; fences = 0; creates = 0; txs = 0; mails = 0; audits = 0
  const drift = await route.POST(request)
  assert.equal(drift.status, 409)
  assert.equal(drift.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual([lookups, txs, creates, mails, audits], [8, 4, 0, 0, 0])
  console.log(JSON.stringify({ passed: 2, actualHelperAndInvite: true, existingRecipient200: true, drift409NoWrite: true }))
})().catch(error => { console.error(error); process.exitCode = 1 })
