const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const file = 'src/components/hr/HrLayout.tsx'
const source = fs.readFileSync(file, 'utf8')
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let callback
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadUsage') callback = node.initializer.arguments[0]
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(callback)
const js = ts.transpileModule(`(${callback.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function load(response) {
  const state = { hasOrg: true, error: false, usage: { plan: 'FREE' } }
  const loadUsage = vm.runInNewContext(js, {
    usageRequest: { current: 0 }, fetch: async () => response, Error,
    setHasOrg: (value) => { state.hasOrg = value },
    setUsageError: (value) => { state.error = value },
    setUsage: (value) => { state.usage = value },
  })
  await loadUsage()
  return state
}

;(async () => {
  const serverFailure = await load(Response.json({ error: 'unavailable' }, { status: 503 }))
  assert.equal(serverFailure.hasOrg, null)
  assert.equal(serverFailure.error, true)
  const noOrg = await load(Response.json({ error: 'Unauthorized' }, { status: 401 }))
  assert.equal(noOrg.hasOrg, false)
  assert.equal(noOrg.error, false)
  const malformed = await load(Response.json({}))
  assert.equal(malformed.hasOrg, null)
  assert.equal(malformed.error, true)
  const success = await load(Response.json({ organizationId: 'own-org', plan: 'pro', employeeCount: 7, employeeLimit: 20 }))
  assert.equal(success.hasOrg, true)
  assert.equal(success.error, false)
  assert.equal(success.usage.plan, 'pro')
  console.log('PASS HR usage: 503 and malformed responses cannot open onboarding; 401 and valid usage remain distinct')
})().catch((error) => { console.error(error); process.exitCode = 1 })
