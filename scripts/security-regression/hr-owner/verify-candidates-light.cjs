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
const rows = [
  { id: 'owner', userId: 'actor', role: 'OWNER', status: 'ACTIVE', name: null },
  ...Array.from({ length: 61 }, (_, i) => ({ id: 'm' + String(i + 1).padStart(3, '0'), userId: 'u' + String(i + 1).padStart(3, '0'), role: 'MEMBER', status: 'ACTIVE', name: null })),
]
const users = rows.map(row => ({ id: row.userId, plan: 'PRO', name: row.id }))
const q = (strings, ...values) => ({ strings: [...strings], values })
const prismaSql = { raw: value => ({ raw: value }), sql: q }
const locks = []
const db = {
  $queryRaw: async query => {
    const sql = query.strings.join('?')
    if (sql.includes('SELECT id, slug, name')) return [{ id: 'orgA', slug: 'x'.repeat(161), name: 'Org' }]
    if (sql.includes('NULL::text AS name')) return rows
    throw Error('Unexpected SQL ' + sql)
  },
  $transaction: async callback => callback(db),
  user: { findMany: async query => users.filter(user => query.where.id.in.includes(user.id)) },
}
const modules = {}
function load(file) {
  if (modules[file]) return modules[file]
  const filename = path.join(root, file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, require: name => {
      if (name === '@prisma/client') return { Prisma: prismaSql }
      if (name === '@/lib/prisma') return { prisma: db }
      if (name === '@/lib/account-lifecycle/store') return { lockLifecycleUsers: async (_db, ids) => locks.push([...ids]), assertRetirementMembershipWritable: async () => {} }
      if (name === './types') return load('src/lib/hr/owner-transfer/types.ts')
      if (name === './receipt') return { readOwnerTransferReceipt: () => { throw Error('Not used') } }
      if (name === 'node:crypto') return require(name)
      if (name === '@/lib/account-lifecycle/state') return { validLifecycleUser: () => true, validLifecycleUuid: () => true, validLifecycleDigest: () => true, LifecycleError: class LifecycleError extends Error {} }
      throw Error('Unmocked ' + name)
    },
    console, Buffer, Date, JSON, Map, Set, Error, process: { env: {} },
  }, { filename })
  modules[file] = exports
  return exports
}
;(async () => {
  const { ownerTransferCandidates } = load('src/lib/hr/owner-transfer/store.ts')
  const first = await ownerTransferCandidates('hr', 'orgA', 'actor', undefined, db)
  assert.equal(first.organization.slug.length, 161)
  assert.equal(first.candidates.length, 50)
  assert.equal(first.nextCursor, 'm050')
  assert.equal(first.candidates[0].memberId, 'm001')
  assert.equal(first.candidates.at(-1).memberId, 'm050')
  const second = await ownerTransferCandidates('hr', 'orgA', 'actor', first.nextCursor, db)
  assert.equal(second.candidates.length, 11)
  assert.equal(second.nextCursor, null)
  assert.equal(second.candidates[0].memberId, 'm051')
  assert.equal(second.candidates.at(-1).memberId, 'm061')
  assert.equal(locks.length, 63)
  console.log(JSON.stringify({ first: first.candidates.length, second: second.candidates.length, nextCursor: first.nextCursor, last: second.candidates.at(-1).memberId, lockedTransactions: locks.length, slugLength: first.organization.slug.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
