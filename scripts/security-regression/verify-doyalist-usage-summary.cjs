const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const planUtils = load('src/lib/plan-utils.ts')
const unified = load('src/lib/unified-plan.ts')
const pricing = load('src/lib/pricing.ts', { './unified-plan': unified })
let currentPlan = 'FREE'
let companies = 0
let companyQueries = 0
let subscriptionQueries = 0
const prisma = {
  user: { findUnique: async () => ({ plan: currentPlan }), findFirst: async () => ({ id: 'owner', plan: currentPlan }) },
  doyalistCompany: {
    count: async ({ where }) => {
      companyQueries++
      assert.equal(where.project.userId, 'owner')
      assert.ok(where.createdAt.gte instanceof Date)
      assert.ok(where.OR.some((item) => item.source?.contains === 'gbizinfo'))
      return companies
    },
  },
  userServiceSubscription: { findUnique: async () => { subscriptionQueries++; return { monthlyUsage: 999 } } },
}
const limits = load('src/lib/doyalist/limits.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/plan-utils': planUtils,
})
const { getUsageSummary } = load('src/lib/usage-summary.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/persona/usage': {},
  '@/lib/seo-article-admission': {},
  '@/lib/pricing': pricing,
  '@/lib/plan-limit': {},
  '@/lib/organization-billing': {},
  '@/lib/organization-quota-ledger': {},
  '@/lib/unified-plan': unified,
  '@/lib/shodan/types': {},
  '@/lib/shodan/billing': {},
  '@/lib/doyalist/limits': limits,
  '@/lib/plan-utils': planUtils,
})
const { GET } = load('src/app/api/usage/[service]/route.ts', {
  'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/aio/access': {},
  '@/lib/aio/usage': {},
  '@/lib/shodan/access': {},
  '@/lib/usage-summary': { getUsageSummary },
})

;(async () => {
  for (const [plan, used] of [['FREE', 12], ['LIGHT', 100], ['PRO', 4999], ['ENTERPRISE', 6000]]) {
    currentPlan = plan
    companies = used
    const actualLimits = await limits.getUserDoyalistLimits('owner')
    const response = await GET(new Request('http://localhost/api/usage/doyalist'), {
      params: Promise.resolve({ service: 'doyalist' }),
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
    const { summary } = await response.json()
    assert.equal(summary.meters[0].used, used, `${plan} must count the same company records as admission`)
    assert.equal(summary.meters[0].limit, actualLimits.maxCompaniesPerMonth < 0 ? null : actualLimits.maxCompaniesPerMonth)
    assert.equal(pricing.getDoyalistMonthlyLimitByUserPlan(plan), actualLimits.maxCompaniesPerMonth)
    assert.equal(pricing.DOYALIST_PRICING.plans.find((p) => p.id === `doyalist-${plan.toLowerCase()}`).description.includes(
      actualLimits.maxCompaniesPerMonth < 0 ? '無制限' : `月${actualLimits.maxCompaniesPerMonth.toLocaleString('ja-JP')}社`
    ), true, `${plan} pricing copy must match admission`)
  }
  assert.equal(companyQueries, 4)
  assert.equal(subscriptionQueries, 0, 'unrelated subscription ledger cannot represent collected companies')
  const freeCard = pricing.DOYALIST_PRICING.plans.find((plan) => plan.id === 'doyalist-free')
  assert.equal(freeCard.features.find((feature) => feature.text === 'CSV/Excelエクスポート')?.included, true,
    'the authenticated export routes do not require a paid plan')
  assert.equal(pricing.DOYALIST_PRICING.historyDays.free, -1,
    'project and approach history APIs do not apply a free-plan date cutoff')
  console.log('PASS Doyalist sidebar, pricing and collection admission agree for all plans and actual monthly company records')
})().catch((error) => { console.error(error); process.exitCode = 1 })
