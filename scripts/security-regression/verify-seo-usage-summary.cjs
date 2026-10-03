const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const unified = load('src/lib/unified-plan.ts')
const pricing = load('src/lib/pricing.ts', { './unified-plan': unified })
const planUtils = load('src/lib/plan-utils.ts')
let accountPlan = 'PRO'
let servicePlan = 'FREE'
let ledgerUsage = 7
let queriedUser = null
const prisma = {
  userServiceSubscription: {
    findUnique: async ({ where }) => {
      assert.equal(where.userId_serviceId.serviceId, 'seo')
      return { plan: servicePlan, monthlyUsage: 1, lastUsageReset: new Date() }
    },
  },
}
const { getUsageSummary } = load('src/lib/usage-summary.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/persona/usage': {},
  '@/lib/seo-article-admission': { getSeoArticleMonthlyUsage: async (db, userId) => {
    assert.equal(db, prisma)
    queriedUser = userId
    return ledgerUsage
  } },
  '@/lib/pricing': pricing,
  '@/lib/plan-limit': {},
  '@/lib/organization-billing': {},
  '@/lib/unified-plan': unified,
  '@/lib/shodan/types': {},
  '@/lib/doyalist/limits': {},
  '@/lib/plan-utils': planUtils,
})

;(async () => {
  const summary = await getUsageSummary('seo', 'seo-owner', accountPlan)
  assert.equal(queriedUser, 'seo-owner')
  assert.deepEqual(Array.from(summary.meters, meter => ({ ...meter })), [{ label: '今月', used: 7, limit: 30 }])
  assert.equal(summary.planLabel, 'プロ')

  accountPlan = 'FREE'
  servicePlan = 'LIGHT'
  ledgerUsage = 3
  const granted = await getUsageSummary('seo', 'seo-owner', accountPlan)
  assert.equal(granted.meters[0].limit, 10)
  assert.equal(granted.planLabel, 'ライト')
  console.log('PASS SEO usage summary follows the article admission ledger and highest plan grant')
})().catch(error => { console.error(error); process.exitCode = 1 })
