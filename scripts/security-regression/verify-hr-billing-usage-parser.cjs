const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const root = path.resolve(__dirname,'../..')
// Existing DOYA_TEST_BASELINE, when present, supplies a reviewed source overlay.
const { load } = require(root + '/scripts/security-regression/load-typescript.cjs')
const tier = load('src/lib/hr/plan-tier.ts', { '@/lib/unified-plan': load('src/lib/unified-plan.ts'), '@/lib/plan-utils': load('src/lib/plan-utils.ts') })
const client = load('src/lib/hr/billing-read-client.ts', { '@/lib/hr/plan-tier': tier }, { AbortController, setTimeout, clearTimeout })
let code = 'FREE', role = 'OWNER', authenticated = true, dbError = false
const prisma = {
  user: { findUnique: async ({ where }) => { assert.equal(where.id, 'synthetic-owner'); return { plan: code } } },
  hrOrganizationMember: { findFirst: async ({ where }) => { assert.equal(where.organizationId, 'synthetic-org'); assert.equal(where.role, 'OWNER'); return { userId: 'synthetic-owner' } }, count: async ({ where }) => { assert.equal(where.organizationId, 'synthetic-org'); return 1 } },
  hrEmployee: { count: async ({ where }) => { assert.equal(where.organizationId, 'synthetic-org'); if (dbError) throw Error('Synthetic DB failure'); return 2 } },
  hrOrganization: { findUnique: async ({ where }) => { assert.equal(where.id, 'synthetic-org'); return { aiUsageCount: 1, aiUsageResetAt: new Date() } } },
}
const billing = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma }, '@/lib/hr/plan-tier': tier })
const api = load('src/app/api/hr/usage/route.ts', {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/hr/billing': billing,
  '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } },
  '@/lib/hr/access': { getHrContext: async () => authenticated ? { organizationId: 'synthetic-org', userId: role === 'OWNER' ? 'synthetic-owner' : 'synthetic-viewer', role } : null, hasMinRole: () => role === 'OWNER' || role === 'ADMIN' },
})
;(async () => {
  const cases = []
  for (const plan of ['FREE', 'GUEST', 'LIGHT', 'STARTER', 'PRO', 'BUNDLE', 'BASIC', 'BUSINESS', 'PREMIUM', 'ENTERPRISE']) for (const membership of ['OWNER', 'ADMIN', 'MEMBER']) {
    code = plan; role = membership
    const response = await api.GET(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie')
    const payload = await response.json(), parsed = client.parseHrBillingInfo(payload, 'synthetic-org'), limits = billing.getOrgPlanLimits(plan)
    assert.equal(parsed.plan, tier.hrPlanTier(plan).toLowerCase()); assert.equal(parsed.canManageBilling, membership === 'OWNER')
    assert.equal(parsed.employeeLimit, limits.maxEmployees === -1 ? 999 : limits.maxEmployees); assert.equal(parsed.aiUsageLimit, limits.maxAiUsage); assert.equal(parsed.memberLimit, limits.maxMembers === -1 ? 999 : limits.maxMembers)
    assert.equal(parsed.employeeCount, 2); assert.equal(parsed.memberCount, 1); assert.equal(parsed.aiUsageCount, 1)
    assert.throws(() => client.parseHrBillingInfo(payload, 'other-org'))
    cases.push(plan + ':' + membership + ':actual-api-to-parser')
  }
  authenticated = false
  const anonymous = await api.GET(); assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get('cache-control'), 'private, no-store'); assert.throws(() => client.parseHrBillingInfo({}, 'synthetic-org')); cases.push('anonymous-401')
  authenticated = true; dbError = true
  const failed = await api.GET(); assert.equal(failed.status, 503); assert.equal(failed.headers.get('vary'), 'Cookie'); assert.throws(() => client.parseHrBillingInfo({}, 'synthetic-org')); cases.push('database-failure-503')
  const names = ['src/app/api/hr/usage/route.ts', 'src/lib/hr/billing.ts', 'src/lib/hr/plan-tier.ts', 'src/lib/hr/billing-read-client.ts', 'src/lib/unified-plan.ts', 'src/lib/plan-utils.ts']
  const out = { checkedAt: new Date().toISOString(), cases, count: cases.length, sourceHashes: Object.fromEntries(names.map(n => { const candidate = path.join(process.env.DOYA_TEST_BASELINE || root, n); return [n, crypto.createHash('sha256').update(fs.readFileSync(fs.existsSync(candidate) ? candidate : path.join(root, n))).digest('hex')] })), actualDatabaseCalls: 0, productionRequests: 0, scope: 'Actual unchanged usage route -> actual candidate owner-plan/limits -> actual candidate client parser. Synthetic session/context and Prisma counts. OWNER/ADMIN/MEMBER flag mapping and other-org parser rejection; not real authentication/role authorization, SQL, native browser or production proof.' }
  for(const id of cases)console.log('PASS HR usage API parser: '+id);if(process.env.DOYA_HR_BILLING_API_RESULT)fs.writeFileSync(process.env.DOYA_HR_BILLING_API_RESULT,JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ actualApiToParserCases: cases.length, productionRequests: 0 }))
})().catch(error => { console.error(error); process.exitCode = 1 })
