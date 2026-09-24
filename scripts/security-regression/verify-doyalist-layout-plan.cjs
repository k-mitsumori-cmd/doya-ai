const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const file = 'src/components/doyalist/DoyalistLayout.tsx'
const source = fs.readFileSync(file, 'utf8')
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const nodes = new Map()
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['loadUsage', 'planRaw', 'planTier', 'plan'].includes(node.name.getText(ast))) {
    nodes.set(node.name.getText(ast), node.initializer)
  }
  ts.forEachChild(node, visit)
}
visit(ast)
for (const name of ['loadUsage', 'planRaw', 'planTier', 'plan']) assert.ok(nodes.has(name))
const compile = (node) => ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function load(response) {
  const state = { usage: { plan: { tier: 'FREE' } }, error: false }
  const loader = vm.runInNewContext(compile(nodes.get('loadUsage').arguments[0]), {
    usageRequest: { current: 0 }, fetch: async () => response, Error,
    setUsage: (value) => { state.usage = value },
    setUsageError: (value) => { state.error = value },
  })
  await loader()
  return state
}

function displayedPlan(usage) {
  const planRaw = vm.runInNewContext(compile(nodes.get('planRaw')), { usage })
  const planTier = vm.runInNewContext(compile(nodes.get('planTier')), { planRaw })
  return vm.runInNewContext(compile(nodes.get('plan')), { planTier })
}

;(async () => {
  const failure = await load(Response.json({ error: 'unavailable' }, { status: 503 }))
  assert.deepEqual(failure, { usage: null, error: true })
  assert.equal(displayedPlan(failure.usage), 'UNKNOWN')
  const malformed = await load(Response.json({}))
  assert.equal(malformed.error, true)
  const success = await load(Response.json({ plan: { tier: 'PRO' } }))
  assert.equal(success.error, false)
  assert.equal(displayedPlan(success.usage), 'PRO')
  assert.equal(displayedPlan(null), 'UNKNOWN')
  console.log('PASS doyalist layout: usage failure never displays FREE')
})().catch((error) => { console.error(error); process.exitCode = 1 })
