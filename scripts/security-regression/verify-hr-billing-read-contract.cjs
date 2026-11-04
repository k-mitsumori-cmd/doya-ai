const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const repo = path.resolve(__dirname,'../..')
const ts = require(repo + '/node_modules/typescript')
const names = ['src/lib/hr/billing-read-client.ts', 'src/lib/hr/plan-tier.ts', 'src/lib/unified-plan.ts', 'src/lib/hr/billing.ts', 'src/lib/plan-utils.ts']
const sources = Object.fromEntries(names.map(n => [n, fs.readFileSync(fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE || repo, n)) ? path.join(process.env.DOYA_TEST_BASELINE || repo, n) : path.join(repo, n), 'utf8')]))
const valid = { plan: 'pro', planLabel: 'Pro', employeeCount: 2, employeeLimit: 100, memberCount: 1, memberLimit: 999, aiUsageCount: 1, aiUsageLimit: 100, organizationId: 'synthetic-org', canManageBilling: false }
function loadFixture(mutator = s => s) {
  const cache = {}, timers = new Map(), cleared = [], delays = []; let next = 0
  function load(name) {
    if (cache[name]) return cache[name]
    const exports = {}; cache[name] = exports
    let source = sources[name]
    if (name === names[0]) source = mutator(source)
    if (name === names[3]) {
      const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
      source = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'getOrgPlanLimits').getText(ast)
    }
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, require: name => {
        if (name === '@/lib/hr/plan-tier') return load(names[1])
        if (name === '@/lib/unified-plan') return load(names[2]); if (name === '@/lib/plan-utils') return load(names[4])
        throw Error('Unexpected dependency ' + name)
      }, hrPlanTier: loadIfNeeded(name)?.hrPlanTier, AbortController,
      setTimeout: (fn, delay) => { const id = ++next; timers.set(id, fn); delays.push(delay); return id },
      clearTimeout: id => { cleared.push(id); timers.delete(id) },
    })
    return exports
  }
  function loadIfNeeded(name) { return name === names[3] ? load(names[1]) : undefined }
  return { client: load(names[0]), plan: load(names[1]), billing: () => load(names[3]), timers, cleared, delays }
}
async function contract(mutator) {
  const f = loadFixture(mutator), cases = []
  const check = (id, fn) => { fn(); cases.push(id) }
  check('valid-pro-fields-projected', () => { const parsed = f.client.parseHrBillingInfo({ ...valid, extra: 'ignored' }, 'synthetic-org'); assert.equal(parsed.plan, 'pro'); assert.equal(parsed.employeeCount, 2); assert.equal(parsed.extra, undefined); assert.equal(parsed.canManageBilling, false) })
  for (const [name, value] of [['null', null], ['array', []], ['empty', {}], ['missing-org', { ...valid, organizationId: undefined }], ['other-org', { ...valid, organizationId: 'other-org' }], ['unknown-plan', { ...valid, plan: 'future-unknown' }], ['object-plan', { ...valid, plan: {} }], ['empty-label', { ...valid, planLabel: ' ' }], ['string-permission', { ...valid, canManageBilling: 'false' }], ['null-permission', { ...valid, canManageBilling: null }]]) {
    check('reject-' + name, () => assert.throws(() => f.client.parseHrBillingInfo(value, 'synthetic-org')))
  }
  for (const field of ['employeeCount', 'employeeLimit', 'memberCount', 'memberLimit', 'aiUsageCount', 'aiUsageLimit']) {
    for (const [name, value] of [['missing', undefined], ['object', {}], ['string', '2'], ['negative', -1], ['fraction', 0.5], ['infinite', Infinity], ['unsafe', Number.MAX_SAFE_INTEGER + 1]]) {
      check('reject-' + field + '-' + name, () => assert.throws(() => f.client.parseHrBillingInfo({ ...valid, [field]: value }, 'synthetic-org')))
    }
  }
  check('valid-zero-and-unlimited-sentinel', () => { const value = f.client.parseHrBillingInfo({ ...valid, employeeCount: 0, employeeLimit: 999 }, 'synthetic-org'); assert.equal(value.employeeCount, 0); assert.equal(value.employeeLimit, 999) })
  for (const [code, tier, employeeLimit, aiLimit, memberLimit] of [['FREE', 'FREE', 5, 3, 2], ['GUEST', 'FREE', 5, 3, 2], ['LIGHT', 'LIGHT', 30, 30, 5], ['STARTER', 'PRO', 100, 100, -1], ['PRO', 'PRO', 100, 100, -1], ['BUNDLE', 'PRO', 100, 100, -1], ['BASIC', 'PRO', 100, 100, -1], ['BUSINESS', 'PRO', 100, 100, -1], ['PREMIUM', 'PRO', 100, 100, -1], ['ENTERPRISE', 'ENTERPRISE', -1, 500, -1]]) {
    check('server-client-plan-' + code, () => {
      assert.equal(f.plan.hrPlanTier(' ' + code.toLowerCase() + ' '), tier)
      const limits = f.billing().getOrgPlanLimits(' ' + code.toLowerCase() + ' ')
      assert.equal(limits.maxEmployees, employeeLimit); assert.equal(limits.maxAiUsage, aiLimit); assert.equal(limits.maxMembers, memberLimit)
      assert.equal(f.client.parseHrBillingInfo({ ...valid, plan: code }, 'synthetic-org').plan, tier.toLowerCase())
    })
  }
  check('unknown-plan-not-paid', () => { assert.equal(f.plan.hrPlanTier('UNKNOWN'), null); assert.equal(f.billing().getOrgPlanLimits('UNKNOWN').maxAiUsage, 3) })
  return cases
}
async function reads(mutator) {
  const cases = [], settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
  for (const kind of ['success', 'http-error', 'invalid-json', 'invalid-dto', 'http-timeout', 'body-timeout', 'pre-abort', 'http-abort', 'body-abort']) {
    const f = loadFixture(mutator), controller = new AbortController(); let called = 0, signal, bodyRead = false
    if (kind === 'pre-abort') controller.abort()
    const request = async (url, init) => {
      called++; assert.equal(url, '/api/hr/usage'); signal = init.signal
      if (kind === 'http-timeout' || kind === 'http-abort') return new Promise(() => {})
      return { ok: kind !== 'http-error', json: async () => { bodyRead = true; if (kind === 'body-timeout' || kind === 'body-abort') return new Promise(() => {}); if (kind === 'invalid-json') throw Error('Synthetic JSON failure'); return kind === 'invalid-dto' ? {} : valid } }
    }
    const outcome = f.client.readHrBillingInfo(request, 'synthetic-org', controller.signal).then(value => ({ value }), error => ({ error }))
    await settle()
    if (kind.endsWith('timeout')) { assert.equal(f.timers.size, 1); assert.deepEqual(f.delays, [35000]); if (kind === 'body-timeout') assert(bodyRead); [...f.timers.values()][0]() }
    if (kind === 'http-abort' || kind === 'body-abort') controller.abort()
    const result = await outcome
    if (kind === 'success') assert.equal(result.value.plan, 'pro'); else assert(result.error, kind)
    if (kind === 'pre-abort') assert.equal(called, 0)
    if (kind.endsWith('abort') && kind !== 'pre-abort' || kind.endsWith('timeout')) assert(signal.aborted)
    assert.equal(f.timers.size, 0); assert.equal(f.cleared.length, 1)
    if (kind === 'success') { controller.abort(); assert.equal(signal.aborted, false, 'completed read detaches its external abort listener') }
    cases.push(kind)
  }
  return cases
}
;(async () => {
  const dtoAndPlans = await contract(), deadlineAndCancel = await reads(), mutants = []
  for (const [name, from, to] of [['organization-check-removed', 'row.organizationId !== organizationId', 'false'], ['boolean-check-removed', "typeof row.canManageBilling !== 'boolean'", 'false'], ['safe-integer-check-removed', '!Number.isSafeInteger(number)', 'false'], ['negative-check-removed', 'number < 0', 'false']]) {
    assert(sources[names[0]].includes(from)); let rejected = false
    try { await contract(s => s.replace(from, to)) } catch { rejected = true }
    assert(rejected, name); mutants.push({ name, rejected })
  }
  for (const [name, from, to] of [['deadline-changed', '35_000', '15_000'], ['timer-cleanup-removed', 'clearTimeout(timer)', 'void timer'], ['abort-listener-cleanup-removed', "signal.removeEventListener('abort', cancel)", 'void signal'], ['timeout-abort-removed', "setTimeout(() => { controller.abort();", "setTimeout(() => { void controller;"]]) {
    assert(sources[names[0]].includes(from)); let rejected = false
    try { await reads(s => s.replace(from, to)) } catch { rejected = true }
    assert(rejected, name); mutants.push({ name, rejected })
  }
  const result = { checkedAt: new Date().toISOString(), sourceHashes: Object.fromEntries(names.map(n => [n, crypto.createHash('sha256').update(sources[n]).digest('hex')])), dtoAndPlanCases: dtoAndPlans, deadlineAndCancelCases: deadlineAndCancel, mutants, productWrites: 0, productionRequests: 0, scope: 'Actual external candidate parser/read helper and plan mapper plus AST-extracted actual candidate getOrgPlanLimits. Synthetic HTTP/body and controlled timers; no browser, actual quota reservation, payment or production malformed-data proof.' }
  for(const id of dtoAndPlans)console.log('PASS HR billing contract: '+id);for(const id of deadlineAndCancel)console.log('PASS HR billing read lifetime: '+id);if(process.env.DOYA_HR_BILLING_CONTRACT_RESULT)fs.writeFileSync(process.env.DOYA_HR_BILLING_CONTRACT_RESULT,JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ dtoAndPlanCases: dtoAndPlans.length, deadlineAndCancelCases: deadlineAndCancel.length, mutantsRejected: mutants.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
