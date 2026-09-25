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

async function pricing(service, response, org = '') {
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
  const state = { plan: 'previous', error: false, role: null, loading: true, url: null }
  const loadPlan = vm.runInNewContext(js, {
    fetch: async (url) => { state.url = url; return response }, Error, URLSearchParams, encodeURIComponent,
    window: { location: { search: org ? `?org=${encodeURIComponent(org)}` : '' } },
    setPlan: (value) => { state.plan = value },
    setPlanError: (value) => { state.error = value },
    setRole: (value) => { state.role = value },
    setLoading: (value) => { state.loading = value },
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
    const unavailable = await pricing(service, Response.json({ error: 'unavailable' }, { status: 503 }))
    assert.equal(unavailable.plan, null); assert.equal(unavailable.error, true)
    const valid = await pricing(service, Response.json({ plan: 'PRO', role: 'owner', onboarded: true }))
    assert.equal(valid.plan, 'PRO'); assert.equal(valid.error, false)
    assert.equal(sidebar(service, undefined, true), '未確認')
    assert.equal(sidebar(service, undefined, false), 'GUEST')
    assert.equal(sidebar(service, 'PRO', true), 'PRO')
    assert.equal(sidebar(service, 'FREE', true), 'FREE')
  }
  const guest = await pricing('sfa', Response.json({ onboarded: false, memberships: [] }))
  assert.equal(guest.plan, null); assert.equal(guest.error, false); assert.equal(guest.role, null)
  const member = await pricing('sfa', Response.json({ plan: 'FREE', role: 'member', onboarded: true }), 'team-a')
  assert.equal(member.url, '/api/sfa/usage?org=team-a'); assert.equal(member.role, 'member'); assert.equal(member.loading, false)
  const foreign = await pricing('sfa', Response.json({ onboarded: false, memberships: [] }), 'foreign')
  assert.equal(foreign.error, true, 'an invalid selected organization cannot be treated as a new account')
  assert.equal(sidebar('sfa', 'LIGHT', true), 'LIGHT')
  const planUtils = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/plan-utils.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: planUtils })
  assert.equal(planUtils.higherPlan('FREE', 'BUNDLE'), 'PRO')
  console.log('PASS service plan fallback: Cunning, SFA and DoyaSlide preserve unknown status; BUNDLE stays PRO')
})().catch((error) => { console.error(error); process.exitCode = 1 })
