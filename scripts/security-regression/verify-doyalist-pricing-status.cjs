const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const file = 'src/app/doyalist/pricing/page.tsx'
const source = fs.readFileSync(file, 'utf8')
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let normalizeNode, loadNode
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'normalizePlan') normalizeNode = node
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadPlan') loadNode = node.initializer.arguments[0]
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(normalizeNode && loadNode)
const compile = (node) => ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const normalizePlan = vm.runInNewContext(compile(normalizeNode), {})

async function load(response) {
  const state = { plan: 'PRO', error: false }
  const loadPlan = vm.runInNewContext(compile(loadNode), {
    fetch: async () => response, Error, normalizePlan,
    setCurrentPlan: (value) => { state.plan = value },
    setPlanError: (value) => { state.error = value },
  })
  await loadPlan()
  return state
}

;(async () => {
  assert.equal(normalizePlan(undefined), null)
  assert.equal(normalizePlan('FREE'), 'FREE')
  assert.equal(normalizePlan('LIGHT'), 'PRO')
  assert.deepEqual(await load(Response.json({ error: 'unavailable' }, { status: 503 })), { plan: null, error: true })
  assert.deepEqual(await load(Response.json({ error: 'login' }, { status: 401 })), { plan: null, error: false })
  assert.deepEqual(await load(Response.json({})), { plan: null, error: true })
  assert.deepEqual(await load(Response.json({ plan: { tier: 'FREE' } })), { plan: 'FREE', error: false })
  assert.deepEqual(await load(Response.json({ plan: { tier: 'PRO' } })), { plan: 'PRO', error: false })
  console.log('PASS doyalist pricing: failed or malformed usage never becomes FREE')
})().catch((error) => { console.error(error); process.exitCode = 1 })
