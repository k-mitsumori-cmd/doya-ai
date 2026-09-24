const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function callback(file, name, context) {
  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let node
  function visit(current) {
    if (ts.isVariableDeclaration(current) && current.name.getText(ast) === name) node = current.initializer
    ts.forEachChild(current, visit)
  }
  visit(ast)
  assert.ok(node, `${name} not found`)
  const expression = ts.isCallExpression(node) ? node.arguments[0] : node
  const js = ts.transpileModule(`(${expression.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js, { ...context, Error, Boolean })
}

async function serverFailure() {
  const source = fs.readFileSync('src/app/api/kintai/usage/route.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  const mocks = {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { kintaiMember: { findFirst: async () => { throw new Error('database unavailable') } } } },
  }
  vm.runInNewContext(js, { exports, require: (name) => mocks[name], console: { error() {} } })
  return exports.GET()
}

async function layout(response) {
  const state = { usage: { organizationId: 'old' }, hasOrg: true, error: false }
  const loadUsage = callback('src/components/kintai/KintaiLayout.tsx', 'loadUsage', {
    usageRequest: { current: 0 }, fetch: async () => response,
    setUsage: (value) => { state.usage = value },
    setHasOrg: (value) => { state.hasOrg = value },
    setUsageError: (value) => { state.error = value },
  })
  await loadUsage()
  return state
}

async function pricing(response) {
  const state = { plan: 'FREE', error: false }
  const loadPlan = callback('src/app/kintai/pricing/page.tsx', 'loadPlan', {
    fetch: async () => response,
    setUserPlan: (value) => { state.plan = value },
    setPlanError: (value) => { state.error = value },
  })
  await loadPlan()
  return state
}

;(async () => {
  const api = await serverFailure()
  assert.equal(api.status, 503)
  assert.equal((await api.json()).organizationId, undefined)

  const failed = Response.json({ error: 'unavailable' }, { status: 503 })
  assert.deepEqual(await layout(failed), { usage: null, hasOrg: null, error: true })
  assert.deepEqual(await layout(Response.json({ organizationId: null })), { usage: null, hasOrg: false, error: false })
  assert.deepEqual(await layout(Response.json({ organizationId: 'owned', role: 'system_admin', plan: 'PRO' })), {
    usage: { organizationId: 'owned', role: 'system_admin', plan: 'PRO' }, hasOrg: true, error: false,
  })
  assert.deepEqual(await pricing(failed), { plan: null, error: true })
  assert.deepEqual(await pricing(Response.json({ organizationId: null })), { plan: null, error: false })
  assert.deepEqual(await pricing(Response.json({ organizationId: 'owned', plan: 'PRO' })), { plan: 'PRO', error: false })
  const pricingSource = fs.readFileSync('src/app/kintai/pricing/page.tsx', 'utf8')
  assert.ok(pricingSource.includes('対象者は30日間無料'))
  assert.ok(!pricingSource.includes('全プラン14日間'))
  console.log('PASS kintai usage: server failure never becomes onboarding or FREE')
})().catch((error) => { console.error(error); process.exitCode = 1 })
