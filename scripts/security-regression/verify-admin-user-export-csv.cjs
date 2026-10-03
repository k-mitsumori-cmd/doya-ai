const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let authorized = true
let reads = 0
let accountPlan = 'FREE'
let bannerPlan = null
const name = ' \t=HYPERLINK("https://example.test","x")\n担当'
const route = load('src/app/api/admin/users/export/route.ts', {
  'next/server': { NextResponse: Response },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic' }) }) },
  '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid: authorized }) },
  '@/lib/prisma': { prisma: { user: { findMany: async () => {
    reads++
    return [{ id: 'u1', name, email: 'person@example.test', plan: accountPlan, role: 'user',
      createdAt: new Date('2026-09-30T00:00:00Z'), updatedAt: new Date('2026-09-30T00:00:00Z'),
      serviceSubscriptions: bannerPlan ? [{ serviceId: 'banner', plan: bannerPlan }] : [], _count: { generations: 0 } }]
  } } } },
  '@/lib/admin/banner-quota': { summarizeBannerMonthlyQuota: () => ({ used: 0 }) },
  '@/lib/plan-utils': { higherPlan: (service, account) => {
    const rank = { FREE: 0, LIGHT: 1, PRO: 2, ENTERPRISE: 3 }
    return (rank[service] ?? 0) > (rank[account] ?? 0) ? service : account
  } },
})
const get = query => route.GET({ url: `https://local.test/api/admin/users/export${query}` })

;(async () => {
  await check('admin CSV keeps the name in one quoted cell without executing it', async () => {
    const response = await get('?format=csv')
    assert.equal(response.status, 200)
    const csv = Buffer.from(await response.arrayBuffer()).toString('utf8')
    assert(csv.startsWith('\uFEFF'))
    assert(csv.includes('"\' \t=HYPERLINK(""https://example.test"",""x"")\n担当"'))
  })
  await check('JSON export keeps the original name', async () => {
    const response = await get('?format=json')
    assert.equal(response.status, 200)
    assert.equal((await response.json())[0].name, name)
  })
  await check('CSV export shows paid account tier despite a stale free service row', async () => {
    accountPlan = 'PRO'
    bannerPlan = 'FREE'
    const response = await get('?format=csv')
    assert.equal(response.status, 200)
    const row = Buffer.from(await response.arrayBuffer()).toString('utf8')
    assert(row.includes(',"PRO","user","0","PRO","0",'))
    accountPlan = 'FREE'
    bannerPlan = null
  })
  await check('unauthorized export does not read user records', async () => {
    authorized = false
    const before = reads
    assert.equal((await get('?format=csv')).status, 401)
    assert.equal(reads, before)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
