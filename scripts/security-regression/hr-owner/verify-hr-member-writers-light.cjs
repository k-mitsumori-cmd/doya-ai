// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require(require('node:path').join(TEST_DEPS_ROOT, 'node_modules/typescript'))
const root = TEST_SOURCE_ROOT, repo = TEST_DEPS_ROOT
function load(file, mocks) {
  const candidate = path.join(root, file), filename = fs.existsSync(candidate) ? candidate : path.join(repo, file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in mocks, `${file}: unmocked ${name}`); return mocks[name] },
    Date, Error, Set, Map, JSON, Object, Array, String, Number, Promise, Headers, Response, URL, URLSearchParams,
    process: { env: {} }, console }, { filename })
  return exports
}
const nextServer = { NextResponse: { json: (body, init) => Response.json(body, init) } }
const privateApi = load('src/lib/private-api-response.ts', { 'next/server': nextServer })
const prisma = { sql: (strings, ...values) => ({ strings, values }), join: values => values, DbNull: null }
let owner = { id: 'owner', userId: 'actor', role: 'OWNER', status: 'ACTIVE' }
let target = { id: 'target', userId: 'successor', role: 'MEMBER', status: 'ACTIVE' }
let retired = false, locks = [], fences = 0, updates = 0, deletes = 0, orgUpdates = 0
const reset = () => { target = { id: 'target', userId: 'successor', role: 'MEMBER', status: 'ACTIVE' }; retired = false; locks = []; fences = 0; updates = 0; deletes = 0; orgUpdates = 0 }
const LifecycleError = class LifecycleError extends Error { constructor() { super('退会処理中'); this.code = 'ACCOUNT_RETIREMENT_IN_PROGRESS'; this.status = 409 } }
const db = {
  hrOrganizationMember: {
    findMany: async () => [owner, target].filter(Boolean),
    findFirst: async ({ where }) => where.id === 'owner' ? owner : target,
    findUnique: async () => target,
    updateMany: async ({ data }) => { updates++; target = { ...target, ...data }; return { count: 1 } },
    deleteMany: async () => { deletes++; target = null; return { count: 1 } },
  },
  hrOrganization: { update: async ({ data }) => { orgUpdates++; return { id: 'org', ...data } } },
  $queryRaw: async query => query?.strings?.join('').includes('hr_organizations') ? [{ id: 'org' }] : [{ id: 'owner' }, { id: 'target' }],
  $transaction: async run => run(db),
}
const helper = load('src/lib/hr/membership-write.ts', { '@prisma/client': { Prisma: prisma }, '@/lib/prisma': { prisma: db },
  '@/lib/account-lifecycle/store': {
    lockLifecycleUsers: async (_tx, ids) => { locks.push([...ids]); assert.deepEqual([...ids], ['actor', 'successor']) },
    assertRetirementMembershipWritable: async () => { fences++; if (retired) throw new LifecycleError() },
  } })
const roles = { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' }
const access = { getHrContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'owner', role: roles.OWNER }), hasMinRole: () => true,
  getOrCreateOrganization: async () => ({ id: 'org' }) }
const common = { 'next/server': nextServer, '@/lib/prisma': { prisma: db }, '@/lib/hr/access': access,
  '@/lib/hr/types': { HrMemberRole: roles }, '@/lib/hr/constants': { ROLE_HIERARCHY: { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 } },
  '@/lib/hr/membership-write': helper, '@/lib/account-lifecycle/state': { LifecycleError }, '@/lib/private-api-response': privateApi }
const member = load('src/app/api/hr/organization/members/[id]/route.ts', common)
const org = load('src/app/api/hr/organization/route.ts', { ...common, '@prisma/client': { Prisma: prisma },
  'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) }, '@/lib/auth': { authOptions: {} },
  '@/lib/hr/organization-choices': { readHrOrganizationChoicesPage: async () => ({}) }, })
const params = { params: Promise.resolve({ id: 'target' }) }
const request = body => ({ json: async () => body })
const privateResponse = response => { assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert.match(response.headers.get('Vary'), /Cookie/) }
;(async () => {
  reset()
  let response = await member.PATCH(request({ role: 'MANAGER' }), params)
  assert.equal(response.status, 200); privateResponse(response)
  assert.equal(target.role, 'MANAGER'); assert.deepEqual([updates, fences, locks.length], [1, 1, 1])
  reset(); response = await member.DELETE(request(null), params)
  assert.equal(response.status, 200); privateResponse(response)
  assert.deepEqual([deletes, fences, locks.length], [1, 1, 1])
  reset(); response = await org.PATCH(request({ name: 'Updated HR' }))
  assert.equal(response.status, 200); privateResponse(response)
  assert.deepEqual([orgUpdates, fences, locks.length], [1, 1, 1])
  reset(); retired = true; response = await member.PATCH(request({ role: 'MANAGER' }), params)
  assert.equal(response.status, 409); privateResponse(response)
  assert.equal((await response.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
  assert.deepEqual([updates, deletes, orgUpdates], [0, 0, 0])
  reset(); retired = true; response = await org.PATCH(request({ name: 'Blocked HR' }))
  assert.equal(response.status, 409); privateResponse(response)
  assert.deepEqual([updates, deletes, orgUpdates], [0, 0, 0])
  console.log(JSON.stringify({ passed: 5, actualHelperAndRoutes: true, privateHeaders: true, retirementWrite0: true }))
})().catch(error => { console.error(error); process.exitCode = 1 })
