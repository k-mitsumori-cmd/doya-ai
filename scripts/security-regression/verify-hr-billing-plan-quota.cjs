const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const root = path.resolve(__dirname,'../..')
// Existing DOYA_TEST_BASELINE, when present, supplies a reviewed source overlay.
const { load } = require(root + '/scripts/security-regression/load-typescript.cjs')
const tier = load('src/lib/hr/plan-tier.ts', { '@/lib/unified-plan': load('src/lib/unified-plan.ts'), '@/lib/plan-utils': load('src/lib/plan-utils.ts') })
const now = new Date('2026-11-03T12:00:00Z'), resetAt = new Date('2026-10-31T15:00:00Z')
;(async () => {
  const cases = []
  for (const [code, aiCap, employeeCap] of [['FREE', 3, 5], ['GUEST', 3, 5], ['LIGHT', 30, 30], ['STARTER', 100, 100], ['PRO', 100, 100], ['BUNDLE', 100, 100], ['BASIC', 100, 100], ['BUSINESS', 100, 100], ['PREMIUM', 100, 100], ['ENTERPRISE', 500, -1]]) {
    let aiCount = aiCap, employees = employeeCap, aiWrites = 0, employeeWrites = 0, locks = 0
    const tx = {
      $queryRaw: async (strings, organizationId) => { assert.equal(organizationId, 'synthetic-org'); assert(strings.join('').includes('FOR UPDATE')); locks++; return [{ id: organizationId }] },
      hrOrganizationMember: { findFirst: async ({ where }) => { assert.equal(where.organizationId, 'synthetic-org'); assert.equal(where.role, 'OWNER'); assert.equal(where.status, 'ACTIVE'); return { userId: 'synthetic-owner' } } },
      user: { findUnique: async ({ where, select }) => { assert.equal(where.id, 'synthetic-owner'); assert.equal(select.plan, true); return { plan: ' ' + code.toLowerCase() + ' ' } } },
      hrOrganization: { findUnique: async () => ({ aiUsageCount: aiCount, aiUsageResetAt: resetAt }), update: async ({ data }) => { aiWrites++; assert.equal(data.aiUsageCount.increment, 1); aiCount++; return {} } },
      hrEmployee: { count: async ({ where }) => { assert.equal(where.organizationId, 'synthetic-org'); assert.equal(where.status, 'ACTIVE'); return employees } },
    }
    const billing = load('src/lib/hr/billing.ts', { '@/lib/hr/plan-tier': tier, '@/lib/prisma': { prisma: { $transaction: fn => fn(tx) } } })
    const denied = await billing.reserveAiUsageInTransaction(tx, 'synthetic-org', now)
    assert.equal(denied.granted, false); assert.equal(aiWrites, 0); assert(denied.error.includes(String(aiCap)))
    if (['PRO', 'STARTER', 'BUNDLE', 'BASIC', 'BUSINESS', 'PREMIUM', 'ENTERPRISE'].includes(code)) assert(denied.error.includes('お問い合わせ'))
    cases.push(code + ':ai-cap-denied-no-write')
    aiCount = aiCap - 1
    const admitted = await billing.reserveAiUsageInTransaction(tx, 'synthetic-org', now)
    assert.equal(admitted.granted, true); assert.equal(aiCount, aiCap); assert.equal(aiWrites, 1); assert.equal(admitted.reservation.organizationId, 'synthetic-org')
    cases.push(code + ':last-ai-slot-admitted-once')
    const create = async () => { employeeWrites++; return 'synthetic-created' }
    const employeeResult = await billing.createWithinEmployeeLimit('synthetic-org', create)
    assert.equal(employeeResult.allowed, employeeCap === -1); assert.equal(employeeWrites, employeeCap === -1 ? 1 : 0)
    if (employeeCap !== -1) assert.equal(employeeResult.limit, employeeCap)
    cases.push(code + ':employee-cap-policy')
    employeeWrites = 0; employees = employeeCap === -1 ? 1000000 : employeeCap - 1
    const below = await billing.createWithinEmployeeLimit('synthetic-org', create)
    assert.equal(below.allowed, true); assert.equal(employeeWrites, 1); assert.equal(below.value, 'synthetic-created'); assert.equal(locks, 4)
    cases.push(code + ':employee-allowed-under-cap')
    if (['PRO', 'STARTER', 'BUNDLE', 'BASIC', 'BUSINESS', 'PREMIUM', 'ENTERPRISE'].includes(code)) assert(billing.employeeLimitMessage(code, employeeCap).includes('お問い合わせ'))
    else assert(billing.employeeLimitMessage(code, employeeCap).includes('プランを変更'))
    cases.push(code + ':contact-copy-consistent')
  }
  const files = ['src/lib/hr/billing.ts', 'src/lib/hr/plan-tier.ts', 'src/lib/unified-plan.ts', 'src/lib/plan-utils.ts']
  const out = { checkedAt: new Date().toISOString(), cases, count: cases.length, sourceHashes: Object.fromEntries(files.map(n => { const candidate = path.join(process.env.DOYA_TEST_BASELINE || root, n); return [n, crypto.createHash('sha256').update(fs.readFileSync(fs.existsSync(candidate) ? candidate : path.join(root, n))).digest('hex')] })), productionRequests: 0, actualDatabaseWrites: 0, scope: 'Actual candidate billing module, canonical plan mapper and isPaidPlan. Synthetic transaction/owner/count fixtures verify admission and failure copy for10 plan codes. Not actual SQL row-lock concurrency, real quota consumption, billing or production customer proof.' }
  for(const id of cases)console.log('PASS HR billing quota: '+id);if(process.env.DOYA_HR_BILLING_QUOTA_RESULT)fs.writeFileSync(process.env.DOYA_HR_BILLING_QUOTA_RESULT,JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ actualCandidateQuotaFlowCases: cases.length, productionRequests: 0 }))
})().catch(error => { console.error(error); process.exitCode = 1 })
