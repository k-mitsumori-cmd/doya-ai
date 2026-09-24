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
  assert.ok(node, `${name} not found in ${file}`)
  const expression = ts.isCallExpression(node) ? node.arguments[0] : node
  const js = ts.transpileModule(`(${expression.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js, { ...context, Error, Array })
}

async function getUsage(failing) {
  const source = fs.readFileSync('src/app/api/doyaslide/usage/route.ts', 'utf8')
  const exports = {}
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/doyaslide/access': { getUserId: async () => 'user' },
    '@/lib/doyaslide/limits': {
      getUserTier: async () => { if (failing) throw new Error('database unavailable'); return 'PRO' },
      getUserDoyaSlideLimits: async () => ({ maxProjects: 10 }),
      countProjects: async () => 2,
      getMonthlyUsage: async () => 3,
    },
  }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js, { exports, require: (name) => mocks[name], console: { error() {} }, Promise })
  return exports.GET()
}

async function projectList(projectResponse, usageResponse) {
  const state = { projects: ['previous'], loading: false, projectsError: false, usageError: false, usage: null }
  const load = callback('src/app/doyaslide/projects/page.tsx', 'load', {
    loadRequest: { current: 0 },
    fetch: async (url) => url === '/api/doyaslide/projects' ? projectResponse : usageResponse,
    setLoading: (value) => { state.loading = value },
    setProjectsError: (value) => { state.projectsError = value },
    setUsageError: (value) => { state.usageError = value },
    setProjects: (value) => { state.projects = value },
    setUsage: (value) => { state.usage = value },
  })
  load()
  await new Promise(setImmediate)
  return state
}

async function pricing(response) {
  const state = { plan: 'previous', error: false }
  const loadPlan = callback('src/app/doyaslide/pricing/page.tsx', 'loadPlan', {
    fetch: async () => response,
    setPlanError: (value) => { state.error = value },
    setPlan: (value) => { state.plan = value },
  })
  await loadPlan()
  return state
}

;(async () => {
  const failedUsage = await getUsage(true)
  assert.equal(failedUsage.status, 503)
  assert.equal((await failedUsage.json()).plan, undefined)
  const goodUsage = await getUsage(false)
  assert.equal(goodUsage.status, 200)
  assert.equal((await goodUsage.json()).plan, 'PRO')

  const failure = Response.json({ error: 'unavailable' }, { status: 503 })
  const validUsage = Response.json({ plan: 'PRO', limits: { maxProjects: 10 }, usage: { projects: 2 } })
  const failedProjects = await projectList(failure, validUsage)
  assert.equal(failedProjects.projectsError, true)
  assert.deepEqual(failedProjects.projects, ['previous'])
  assert.equal(failedProjects.loading, false)
  const emptyProjects = await projectList(Response.json({ projects: [] }), validUsage)
  assert.equal(emptyProjects.projectsError, false)
  assert.deepEqual(emptyProjects.projects, [])
  const failedUsageList = await projectList(Response.json({ projects: [] }), failure)
  assert.equal(failedUsageList.usageError, true)
  assert.equal(failedUsageList.usage, null)

  assert.deepEqual(await pricing(failure), { plan: null, error: true })
  assert.deepEqual(await pricing(Response.json({ plan: 'PRO' })), { plan: 'PRO', error: false })
  console.log('PASS doyaslide load errors: API failure, project list, usage and pricing remain distinct from FREE/empty')
})().catch((error) => { console.error(error); process.exitCode = 1 })
