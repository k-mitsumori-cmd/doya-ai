const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const crypto = require('node:crypto')

function fixture({ claim = 'reserved', banners = ['data:image/png;base64,AAAA'], throwGeneration = false } = {}) {
  let modelCalls = 0
  let releases = []
  let historyWrites = 0
  let logged = []
  const reservation = {
    id: 'sub', lastUsageReset: new Date(), requested: 3, count: 3, plan: 'FREE',
    usage: { monthlyLimit: 15, monthlyUsed: 3, monthlyRemaining: 12 },
  }
  const api = load('src/app/api/banner/generate/route.ts', {
    'next/server': { NextResponse: { json: (body, opts) => Object.assign(
      new Response(JSON.stringify(body), { status: opts?.status ?? 200, headers: { 'content-type': 'application/json' } }),
      { cookies: { set() {} } },
    ) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u1' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/nanobanner': {
      isNanobannerConfigured: () => true,
      getModelDisplayName: () => 'model',
      generateBanners: async () => { modelCalls++; if (throwGeneration) throw Error('provider down'); return { banners, error: banners.length ? undefined : 'provider failed' } },
    },
    '@/lib/prisma': { prisma: { generation: { createMany: async () => { historyWrites++ } } } },
    '@/lib/pricing': { BANNER_PRICING: { guestLimit: 0 }, HIGH_USAGE_CONTACT_URL: '', getCurrentMonthJST: () => '2026-09' },
    '@/lib/banner/monthly-quota': {
      reserveBannerMonthlyImages: async () => {
        if (claim === 'throw') throw Error('database unavailable')
        if (claim === 'limit') return { state: 'limit', plan: 'FREE', usage: { monthlyLimit: 15, monthlyUsed: 15, monthlyRemaining: 0 } }
        return { state: 'reserved', reservation }
      },
      releaseBannerMonthlyImages: async (_, n) => { releases.push(n); return { monthlyLimit: 15, monthlyUsed: 3 - n, monthlyRemaining: 12 + n } },
    },
    '@/lib/notifications': { sendErrorNotification: async () => {} },
    '@/lib/service-usage': {
      isFirstServiceUse: async () => false,
      notifyFirstServiceUse: async () => {},
      notifyServiceActivity: async () => {},
    },
    crypto,
  }, { console: { log: (...args) => logged.push(args), error() {}, warn() {} }, crypto })
  const request = () => new Request('https://local.test/api/banner/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'other', keyword: 'private-canary', companyName: 'private-canary', imageDescription: 'private-canary', count: 3 }),
  })
  return { api, request, get modelCalls() { return modelCalls }, get releases() { return releases }, get historyWrites() { return historyWrites }, get logged() { return logged } }
}

;(async () => {
  let f = fixture({ claim: 'throw' })
  assert.equal((await f.api.POST(f.request())).status, 503)
  assert.equal(f.modelCalls, 0)

  f = fixture({ claim: 'limit' })
  const blocked = await f.api.POST(f.request())
  assert.equal(blocked.status, 429)
  assert.equal((await blocked.json()).code, 'MONTHLY_LIMIT_REACHED')
  assert.equal(f.modelCalls, 0)

  f = fixture()
  const success = await f.api.POST(f.request())
  assert.equal(success.status, 200)
  assert.equal(f.modelCalls, 1)
  assert.deepEqual(f.releases, [2])
  assert.equal(f.historyWrites, 1)
  assert.equal((await success.json()).usage.monthlyUsed, 1)
  assert(!JSON.stringify(f.logged).includes('private-canary'))

  f = fixture({ banners: [] })
  assert.equal((await f.api.POST(f.request())).status, 500)
  assert.deepEqual(f.releases, [3])
  assert.equal(f.historyWrites, 0)

  f = fixture({ throwGeneration: true })
  assert.equal((await f.api.POST(f.request())).status, 500)
  assert.deepEqual(f.releases, [3])
  console.log('PASS banner API blocks paid generation on quota failure/limit, refunds partial/failed output, and omits private request logs')
})().catch(error => { console.error(error); process.exitCode = 1 })
