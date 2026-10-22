// Exercise the real planTierOf mapper with its legacy default client and a transaction-scoped client.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript')
const file = path.join(root, 'src/lib/plan-limit.ts')
const unifiedFile = path.join(root, 'src/lib/unified-plan.ts')
const unifiedModule = new Module(unifiedFile)
unifiedModule.filename = unifiedFile
unifiedModule._compile(ts.transpileModule(fs.readFileSync(unifiedFile, 'utf8'), { fileName: unifiedFile, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText, unifiedFile)
let defaultReads = 0, injectedReads = 0, plan = null
const client = reads => ({ user: { findUnique: async query => {
  assert.deepEqual(query, { where: { id: 'actor-a' }, select: { plan: true } })
  if (reads === 'default') defaultReads++
  else injectedReads++
  return { plan }
} } })
const globalClient = client('default'), transactionClient = client('transaction')
const mod = new Module(file)
mod.filename = file
mod.paths = Module._nodeModulePaths(path.dirname(file))
mod.require = id => {
  if (id === '@/lib/prisma') return { prisma: globalClient }
  if (id === '@/lib/unified-plan') return unifiedModule.exports
  if (id === '@/lib/auth') return { authOptions: {} }
  if (id === 'next-auth') return { getServerSession: async () => null }
  return req(id)
}
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText, file)
;(async () => {
  const { planTierOf } = mod.exports
  assert.equal(await planTierOf(null, transactionClient), 'FREE')
  assert.equal(injectedReads, 0)
  for (const [stored, expected] of [[null, 'FREE'], ['FREE', 'FREE'], ['TRIAL', 'FREE'], ['LIGHT', 'PRO'], ['PRO', 'PRO'], ['BUNDLE', 'PRO'], ['ENTERPRISE', 'ENTERPRISE'], ['enterprise', 'ENTERPRISE']]) {
    plan = stored
    assert.equal(await planTierOf('actor-a'), expected)
    assert.equal(await planTierOf('actor-a', transactionClient), expected)
  }
  assert.equal(defaultReads, 8)
  assert.equal(injectedReads, 8)
  console.log(JSON.stringify({ accepted: true, passed: 9, defaultReads, injectedReads,
    sourceHashes: { 'src/lib/plan-limit.ts': crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      'src/lib/unified-plan.ts': crypto.createHash('sha256').update(fs.readFileSync(unifiedFile)).digest('hex') } }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
