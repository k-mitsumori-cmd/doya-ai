const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')

async function main() {
  const values = new Map()
  let accountPlan = 'FREE'
  let servicePlan = null
  const tx = {
    $executeRaw: async () => {},
    systemSetting: {
      findUnique: async ({ where }) => values.has(where.key) ? { value: values.get(where.key) } : null,
      upsert: async ({ where, create }) => { values.set(where.key, create.value) },
    },
  }
  const db = {
    user: { findUnique: async () => ({ plan: accountPlan }) },
    userServiceSubscription: { findUnique: async () => servicePlan ? { plan: servicePlan } : null },
    $transaction: async (fn) => fn(tx),
  }
  const budget = load('src/lib/banner/text-budget.ts', {
    'node:crypto': crypto,
    '@/lib/prisma': { prisma: db },
    '@/lib/plan-utils': load('src/lib/plan-utils.ts'),
    '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: 'https://example.com/contact' },
  })
  assert.equal(budget.bannerTextDailyLimit('FREE'), 10)
  assert.equal(budget.bannerTextDailyLimit('LIGHT'), 30)
  assert.equal(budget.bannerTextDailyLimit('PRO'), 100)
  assert.equal(budget.bannerTextDailyLimit('ENTERPRISE'), 1000)
  for (let n = 1; n <= 10; n++) {
    const admission = await budget.reserveBannerTextCall('member-1', db)
    assert.equal(admission.state, 'allowed')
    assert.equal(admission.usage.dailyUsed, n)
  }
  const denied = await budget.reserveBannerTextCall('member-1', db)
  assert.equal(denied.state, 'limit')
  assert.equal(denied.usage.dailyRemaining, 0)
  assert.equal(denied.upgradeAvailable, true)
  assert.equal(budget.bannerTextLimitPayload(denied.usage, denied.upgradeAvailable).upgradeUrl, '/banner/pricing')
  const ledgerKey = [...values.keys()].find(key => key.startsWith('banner-text:v1:'))
  assert(ledgerKey)
  values.set(ledgerKey, '2000-01-01:10')
  const reset = await budget.reserveBannerTextCall('member-1', db)
  assert.equal(reset.state, 'allowed')
  assert.equal(reset.usage.dailyUsed, 1)
  values.set(ledgerKey, 'invalid')
  await assert.rejects(budget.reserveBannerTextCall('member-1', db), /ledger invalid/)
  const other = await budget.reserveBannerTextCall('member-2', db)
  assert.equal(other.state, 'allowed')
  accountPlan = 'PRO'; servicePlan = 'FREE'
  const restoredPaid = await budget.reserveBannerTextCall('member-stale', db)
  assert.equal(restoredPaid.usage.dailyLimit, 100)
  accountPlan = 'FREE'; servicePlan = 'PRO'
  const individualGrant = await budget.reserveBannerTextCall('member-grant', db)
  assert.equal(individualGrant.usage.dailyLimit, 100)
  const paidKey = `banner-text:v1:${crypto.createHash('sha256').update('member-grant').digest('hex')}`
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  values.set(paidKey, `${today}:100`)
  const paidDenied = await budget.reserveBannerTextCall('member-grant', db)
  assert.equal(paidDenied.state, 'limit')
  assert.equal(paidDenied.upgradeAvailable, false)
  assert.equal(budget.bannerTextLimitPayload(paidDenied.usage, paidDenied.upgradeAvailable).contactUrl, 'https://example.com/contact')
  assert.equal(budget.bannerTextLimitPayload(paidDenied.usage, paidDenied.upgradeAvailable).upgradeUrl, undefined)

  for (const route of ['src/app/api/banner/chat/route.ts', 'src/app/api/banner/copy/route.ts']) {
    let providerCalled = false
    const routeModule = load(route, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'member-1' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/banner/text-http': require('./banner-text-http-fixture.cjs').textHttpFixture(async () => denied),
      '@/lib/banner/text-answer': { requestBannerTextAnswer: async () => { providerCalled = true; throw new Error('provider must not be called') } },
    }, {
      process: { env: { GOOGLE_AI_API_KEY: 'local-test-key' } },
      fetch: async () => { providerCalled = true; throw new Error('provider must not be called') },
    })
    const body = route.includes('/chat/')
      ? { messages: [{ role: 'user', content: 'バナーを相談したい' }] }
      : { category: 'marketing', purpose: 'sns_ad' }
    const response = await routeModule.POST(new Request('https://example.test/api/banner/text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    assert.equal(response.status, 429, route)
    assert.equal((await response.json()).code, 'DAILY_TEXT_LIMIT_REACHED', route)
    assert.equal(providerCalled, false, route)

    const unavailableRoute = load(route, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'member-1' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/banner/text-http': require('./banner-text-http-fixture.cjs').textHttpFixture(async () => { throw new Error('database unavailable') }),
      '@/lib/banner/text-answer': { requestBannerTextAnswer: async () => { providerCalled = true; throw new Error('provider must not be called') } },
    }, {
      process: { env: { GOOGLE_AI_API_KEY: 'local-test-key' } },
      fetch: async () => { providerCalled = true; throw new Error('provider must not be called') },
    })
    const unavailable = await unavailableRoute.POST(new Request('https://example.test/api/banner/text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    assert.equal(unavailable.status, 503, route)
    assert.equal(providerCalled, false, route)
  }
  console.log('PASS banner chat and copy share a daily quota and reject excess calls before the provider')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
