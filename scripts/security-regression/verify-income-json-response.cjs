// Execute the actual communication declarations without importing React/Next/CSS.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const ts = createRequire(path.join(process.cwd(), 'package.json'))('typescript')
const sourcePath = process.argv[2] || path.join(process.cwd(), 'src/components/income/ui.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
assert.equal(ast.parseDiagnostics.length, 0)
const names = new Set(['ApiError', 'fetchJson'])
const declarations = ast.statements.filter(node => (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && names.has(node.name?.text))
assert.equal(declarations.length, 2, 'Communication declarations must exist exactly once')
const code = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
let reply, calls = 0
const sandbox = { exports: {}, fetch: async (url, init) => { calls++; assert.equal(url, '/synthetic-income-read'); assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store'); return reply() } }
vm.runInNewContext(code, sandbox, { filename: sourcePath, timeout: 1000 })
const { fetchJson, ApiError } = sandbox.exports
const checks = []
async function rejected(name, status, value, malformed = false) {
  reply = async () => ({ ok: status >= 200 && status < 300, status, json: async () => { if (malformed) throw Error('synthetic invalid JSON'); return value } })
  await assert.rejects(fetchJson('/synthetic-income-read'), e => e instanceof ApiError && e.status === status)
  checks.push(name)
}
;(async () => {
  await rejected('HTML or malformed body on HTTP200', 200, null, true)
  await rejected('empty body on HTTP204', 204, null, true)
  for (const [name, value] of [['null', null], ['string', 'unexpected'], ['number', 1], ['false', false], ['true', true]]) await rejected('non-object JSON: ' + name, 200, value)
  for (const status of [401, 403, 404, 500]) await rejected('malformed error body preserves status ' + status, status, null, true)
  for (const [name, value] of [['empty object', {}], ['array', []], ['nullable issuer field', { issuer: null }], ['empty payments', { payments: [], openInvoices: [] }], ['normal action result', { ok: true }]]) {
    reply = async () => ({ ok: true, status: 200, json: async () => value })
    assert.deepEqual(await fetchJson('/synthetic-income-read'), value)
    checks.push('valid JSON preserved: ' + name)
  }
  reply = async () => { throw Error('synthetic offline') }
  await assert.rejects(fetchJson('/synthetic-income-read'), e => e instanceof ApiError && e.status === 0)
  checks.push('network error remains ApiError status0')
  reply = async () => ({ ok: false, status: 403, json: async () => ({ error: 'synthetic denied' }) })
  await assert.rejects(fetchJson('/synthetic-income-read'), e => e instanceof ApiError && e.status === 403 && e.message === 'synthetic denied')
  checks.push('JSON backend error message and status retained')
  assert.equal(calls, checks.length)
  console.log(JSON.stringify({ marker: 'income-json-response', passed: checks.length, checks, calls, externalNetworkCalls: 0 }))
})().catch(error => { console.error(error); process.exitCode = 1 })
