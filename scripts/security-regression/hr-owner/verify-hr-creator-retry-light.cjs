// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const repo = TEST_DEPS_ROOT
const ts = require(path.join(repo, 'node_modules/typescript'))
const file = path.join(TEST_SOURCE_ROOT, 'src/lib/hr/access.ts')
let mode = 'serialization', txCount = 0, lockCount = 0, fenceCount = 0, createCount = 0
const organization = { id: 'org', slug: 'synthetic' }
const tx = {
  hrOrganizationMember: { findFirst: async () => null }, hrOrganization: {
    findUnique: async () => null, create: async () => { createCount++; return organization },
  },
}
const db = { $transaction: async callback => { txCount++; return callback(tx) } }
const mocks = {
  'next-auth': { getServerSession: async () => null }, 'next/headers': { headers: async () => new Headers() },
  './organization-selection': { parseHrOrganizationSelection: () => ({ kind: 'none' }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db },
  './types': { HrMemberRole: { OWNER: 'OWNER' } }, './constants': { ROLE_HIERARCHY: { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 } },
  '@/lib/account-lifecycle/store': {
    lockLifecycleUsers: async () => { lockCount++; if (txCount === 1) throw { code: 'P2010', meta: { code: mode === 'serialization' ? '40001' : '22000' } } },
    assertRetirementMembershipWritable: async () => { fenceCount++ },
  },
}
const moduleExports = {}
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
vm.runInNewContext(code, { exports: moduleExports, require: name => { assert.ok(name in mocks, name); return mocks[name] },
  Date, Math, Set, Map, Error, console, Headers }, { filename: file })
;(async () => {
  const result = await moduleExports.getOrCreateOrganization('actor', 'Org', { slug: 'synthetic' })
  assert.equal(result.id, organization.id)
  assert.deepEqual([txCount, lockCount, fenceCount, createCount], [2, 2, 1, 1])
  mode = 'unrelated'; txCount = 0; lockCount = 0; fenceCount = 0; createCount = 0
  await assert.rejects(moduleExports.getOrCreateOrganization('actor', 'Org', { slug: 'synthetic' }), error => error.code === 'P2010' && error.meta.code === '22000')
  assert.deepEqual([txCount, lockCount, fenceCount, createCount], [1, 1, 0, 0])
  console.log(JSON.stringify({ passed: 2, exact40001WholeTxRetried: true, unrelatedP2010NotRetried: true }))
})().catch(error => { console.error(error); process.exitCode = 1 })
