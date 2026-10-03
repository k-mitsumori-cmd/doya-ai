const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const unified = load('src/lib/unified-plan.ts')
const pricing = load('src/lib/pricing.ts', { './unified-plan': unified })
const planUtils = load('src/lib/plan-utils.ts')
let authorized = true
let reads = 0
let ledgerReads = 0
const user = {
  id: 'paid-user', name: 'Paid user', email: 'paid@example.test', image: null,
  plan: 'PRO', role: 'USER', createdAt: new Date(), updatedAt: new Date(),
  stripeCustomerId: null, stripeSubscriptionId: null,
  serviceSubscriptions: [
    { id: 'banner-sub', serviceId: 'banner', plan: 'FREE', dailyUsage: 0, monthlyUsage: 15, lastUsageReset: new Date(), stripeSubscriptionId: null },
    { id: 'seo-sub', serviceId: 'seo', plan: 'FREE', dailyUsage: 0, monthlyUsage: 1, lastUsageReset: new Date(), stripeSubscriptionId: null },
  ],
  _count: { generations: 15 },
}
const prisma = { user: { findMany: async () => { reads++; return [user] } } }
const route = load('src/app/api/admin/users/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'admin-cookie' }) }) },
  '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid: authorized }) },
  '@/lib/stripe': { ACTIVE_LIKE_STATUSES: [], findActiveLikeSubscriptions: async () => [], isDoyaSubscriptionOwnedByUser: async () => true },
  '@/lib/billing-sync': {},
  '@/lib/prisma': { prisma },
  '@/lib/admin/banner-quota': { summarizeBannerMonthlyQuota: (sub, plan) => {
    const limit = pricing.getBannerMonthlyLimitByUserPlan(planUtils.higherPlan(sub?.plan, plan))
    return { used: sub.monthlyUsage, limit, remaining: limit - sub.monthlyUsage }
  } },
  '@/lib/pricing': pricing,
  '@/lib/seo-article-admission': { getSeoArticleMonthlyUsageForUsers: async (db, ids) => {
    assert.equal(db, prisma)
    assert.deepEqual(Array.from(ids), ['paid-user'])
    ledgerReads++
    return new Map([['paid-user', 8]])
  } },
  '@/lib/plan-utils': planUtils,
  stripe: class { constructor() { this.subscriptions = { retrieve: async () => { throw Error('unexpected Stripe call') } } } },
})

;(async () => {
  const response = await route.GET(new Request('https://local.test/api/admin/users'))
  assert.equal(response.status, 200)
  const [row] = await response.json()
  assert.deepEqual(row.bannerQuota, { used: 15, limit: 150, remaining: 135 })
  assert.deepEqual(row.seoQuota, { used: 8, limit: 30, remaining: 22 })
  assert.equal(ledgerReads, 1)

  authorized = false
  const priorReads = reads
  const denied = await route.GET(new Request('https://local.test/api/admin/users'))
  assert.equal(denied.status, 401)
  assert.equal(reads, priorReads)
  assert.equal(ledgerReads, 1)
  console.log('PASS admin user quotas use paid account rights, SEO ledger and authenticated reads')
})().catch(error => { console.error(error); process.exitCode = 1 })
