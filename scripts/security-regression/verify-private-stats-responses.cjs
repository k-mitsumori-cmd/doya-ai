const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function assertPrivate(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('vary'), 'Cookie')
}

function admin(mode) {
  return load('src/app/api/admin/stats/route.ts', {
    'next/server': { NextResponse: Response },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
    '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => {
      if (mode === 'auth-error') throw new Error('PRIVATE_AUTH_ERROR')
      return { valid: mode === 'data-error' }
    } },
    '@/lib/prisma': { prisma: {} },
    '@/lib/attribution': { serviceLabelOf: () => 'service' },
  })
}

function banner(mode) {
  return load('src/app/api/banner/stats/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => mode === 'guest' ? null : { user: { id: 'owner' } } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      generation: { count: async () => {
        if (mode === 'error') throw new Error('PRIVATE_DATABASE_ERROR')
        return 2
      } },
      userServiceSubscription: { findUnique: async () => ({ plan: 'FREE', monthlyUsage: 1, lastUsageReset: new Date() }) },
    } },
    '@/lib/pricing': { shouldResetMonthlyUsage: () => false, getBannerMonthlyLimitByUserPlan: () => 15 },
  })
}

;(async () => {
  for (const mode of ['unauthorized', 'auth-error', 'data-error']) {
    const result = await admin(mode).GET(new Request('https://example.test/api/admin/stats'))
    assert.equal(result.status, mode === 'unauthorized' ? 401 : 500)
    assertPrivate(result)
    assert.equal(JSON.stringify(await result.json()).includes('PRIVATE_'), false)
  }
  for (const mode of ['guest', 'owner', 'error']) {
    const result = await banner(mode).GET(new Request('https://example.test/api/banner/stats'))
    assert.equal(result.status, mode === 'error' ? 500 : 200)
    assertPrivate(result)
    assert.equal(JSON.stringify(await result.json()).includes('PRIVATE_'), false)
  }
  console.log('PASS admin and banner statistics stay private and hide internal errors')
})().catch((error) => { console.error(error); process.exitCode = 1 })
