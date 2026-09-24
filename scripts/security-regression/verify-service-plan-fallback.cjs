const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function expression(file, variable) {
  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let value
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === variable) value = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(value, `${variable} not found in ${file}`)
  return ts.transpileModule(`(${value.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}

async function pricing(service, response) {
  const file = `src/app/${service}/pricing/page.tsx`
  // useCallback wraps the actual async callback.
  const source = fs.readFileSync(file, 'utf8')
  const original = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(original) === 'loadPlan') callback = node.initializer.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(original)
  assert.ok(callback)
  const js = ts.transpileModule(`(${callback.getText(original)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const state = { plan: 'previous', error: false }
  const loadPlan = vm.runInNewContext(js, {
    fetch: async () => response, Error,
    setPlan: (value) => { state.plan = value },
    setPlanError: (value) => { state.error = value },
  })
  await loadPlan()
  return state
}

function sidebar(service, plan, isLoggedIn) {
  const component = { sfa: 'SfaSidebar', cunning: 'CunningSidebar', doyaslide: 'DoyaSlideSidebar' }[service]
  const file = `src/components/${service}/${component}.tsx`
  return vm.runInNewContext(expression(file, 'planLabel'), { plan, isLoggedIn })
}

;(async () => {
  for (const service of ['cunning', 'sfa', 'doyaslide']) {
    assert.deepEqual(await pricing(service, Response.json({ error: 'unavailable' }, { status: 503 })), { plan: null, error: true })
    assert.deepEqual(await pricing(service, Response.json({ plan: 'PRO', onboarded: true })), { plan: 'PRO', error: false })
    assert.equal(sidebar(service, undefined, true), '未確認')
    assert.equal(sidebar(service, undefined, false), 'GUEST')
    assert.equal(sidebar(service, 'PRO', true), 'PRO')
    assert.equal(sidebar(service, 'FREE', true), 'FREE')
  }
  assert.deepEqual(await pricing('sfa', Response.json({ onboarded: false, memberships: [] })), { plan: null, error: false })
  console.log('PASS service plan fallback: Cunning, SFA and DoyaSlide never infer FREE from failed or missing usage')
})().catch((error) => { console.error(error); process.exitCode = 1 })
