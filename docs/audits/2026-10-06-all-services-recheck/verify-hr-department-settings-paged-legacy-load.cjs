const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
process.env.DOYA_TEST_BASELINE = path.resolve('docs/audits/2026-10-06-all-services-recheck/hr-department-read-repair-overlay')
const { check, load, results } = require('../../../scripts/security-regression/load-typescript.cjs')
const { parseSettingsDepartmentList } = load('src/lib/hr/department-settings-client.ts')

function extract(file, functionName) {
  const candidate = path.join(process.env.DOYA_TEST_BASELINE, file)
  const source = fs.readFileSync(fs.existsSync(candidate) ? candidate : file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let code
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) code = node.getText(ast)
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === functionName &&
        node.initializer && ts.isCallExpression(node.initializer)) {
      code = node.initializer.arguments[0].getText(ast)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert(code, `${functionName} not found in ${file}`)
  return ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}

function run(code, response) {
  const state = { loading: false, loadError: false, auditLogsError: false, canCreatePeriods: false, stats: null, periods: null, settings: null, departments: null }
  const controller = new AbortController()
  const candidateFetch = async (...args) => typeof response === 'function' ? response(...args) : response
  const { loadHrDepartmentList } = load('src/lib/hr/department-list-client.ts', {}, { fetch: candidateFetch, AbortController, TextDecoder, Uint8Array, setTimeout, clearTimeout })
  const env = {
    loadHrDepartmentList,
    fetch: candidateFetch,
    controller,
    Promise, Error, Array,
    parseSettingsDepartmentList,
    ROLE_RANK: { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 },
    setLoading: value => { state.loading = value },
    setLoadError: value => { state.loadError = value },
    setAuditLogsError: value => { state.auditLogsError = value },
    setStats: value => { state.stats = value },
    setRecentOneOnOnes: () => {},
    setEvaluationPeriods: () => {},
    setPeriods: value => { state.periods = value },
    setCanCreatePeriods: value => { state.canCreatePeriods = value },
    setSettings: value => { state.settings = value },
    setMembers: () => {},
    setMyRole: () => {},
    setMyMemberId: () => {},
    setDepartments: value => { state.departments = value },
    setAuditLogs: () => {},
  }
  const fn = vm.runInNewContext(code, env)
  return fn().then(() => state)
}

;(async () => {
  const pages = [
    ['dashboard', 'fetchDashboard', 'src/app/hr/dashboard/page.tsx'],
    ['evaluations', 'fetchPeriods', 'src/app/hr/evaluations/page.tsx'],
    ['settings', 'fetchSettings', 'src/app/hr/settings/page.tsx'],
  ]
  for (const [name, fn, file] of pages) {
    const code = extract(file, fn)
    await check(`${name}: failed request is an error, not an empty organization`, async () => {
      const state = await run(code, Response.json({ error: 'Failed' }, { status: 500 }))
      assert.equal(state.loading, false)
      assert.equal(state.loadError, true)
      assert.equal(state.stats, null)
      assert.equal(state.periods, null)
      assert.equal(state.settings, null)
      assert.equal(state.departments, null)
    })
    await check(`${name}: malformed success is an error, not an empty organization`, async () => {
      const state = await run(code, Response.json({}))
      assert.equal(state.loading, false)
      assert.equal(state.loadError, true)
    })
  }
  await check('dashboard: valid zero counts are genuinely empty', async () => {
    const code = extract('src/app/hr/dashboard/page.tsx', 'fetchDashboard')
    const state = await run(code, Response.json({ orgName: 'Example', canManageEmployees: false, canCreatePeriods: false, employeeCount: 0, departmentCount: 0, activeEvaluations: 0, monthlyOneOnOnes: 0, recentOneOnOnes: [], evaluationPeriods: [] }))
    assert.equal(state.loadError, false)
    assert.equal(state.stats.orgName, 'Example')
    assert.equal(state.stats.employeeCount, 0)
    assert.equal(state.stats.canCreatePeriods, false)
  })
  await check('evaluations: valid empty list is distinct from an outage', async () => {
    const code = extract('src/app/hr/evaluations/page.tsx', 'fetchPeriods')
    const state = await run(code, Response.json({ success: true, periods: [], canCreatePeriods: false }))
    assert.equal(state.loadError, false)
    assert.equal(state.periods.length, 0)
    assert.equal(state.canCreatePeriods, false)
  })
  await check('settings: audit outage does not hide valid organization and departments', async () => {
    const code = extract('src/app/hr/settings/page.tsx', 'fetchSettings')
    const state = await run(code, async url => {
      if (url === '/api/hr/settings') return Response.json({ settings: { id: 'synthetic-org', name: 'Example' }, members: [], myRole: 'OWNER', myMemberId: 'member' })
      if (url === '/api/hr/departments?format=pages') return Response.json({ success: true, format: 'hr-department-page-v1', organizationId: 'synthetic-org', revision: 'a'.repeat(64), total: 0, fragments: [], nextCursor: null })
      return Response.json({ error: 'Failed' }, { status: 500 })
    })
    assert.equal(state.loadError, false)
    assert.equal(state.settings.name, 'Example')
    assert.equal(state.departments.length, 0)
    assert.equal(state.auditLogsError, true)
  })
  assert.equal(results.length,9)
  fs.writeFileSync(path.join(__dirname,'hr-department-settings-paged-legacy-load-overlay.json'), JSON.stringify({checkedAt:new Date().toISOString(),passed:9,expected:9,cases:results,scope:'Original9 initial loader assertions retained; candidate settings source, actual parser and actual paged transport with synthetic HTTP. Other two pages unchanged. No production runtime claim.'},null,2)+'\n')
})().catch(error => { console.error(error); process.exitCode = 1 })
