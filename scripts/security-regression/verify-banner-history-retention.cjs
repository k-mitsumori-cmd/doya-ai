const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const oldDate = new Date(Date.now() - 120 * 86400000)
const oldBanner = {
  id: 'paid-banner', createdAt: oldDate, input: { keyword: '保存済み' },
  metadata: { batchId: 'paid-batch' }, output: 'data:image/png;base64,AA==',
}
let deletions = 0
let plan = 'PRO'
const generation = {
  deleteMany: async () => { deletions++; throw new Error('GET must not delete history') },
  findMany: async ({ where }) => oldDate >= where.createdAt.gte ? [oldBanner] : [],
}
const prisma = {
  generation,
  userServiceSubscription: { findUnique: async () => ({ plan }) },
}
const nextServer = { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } }

const gallery = load('src/app/api/banner/gallery/route.ts', {
  'next/server': nextServer,
  '@/lib/prisma': { prisma },
  '@/lib/pricing': { BANNER_PRICING: {} },
})
const access = load('src/lib/banner/history-access.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/pricing': { BANNER_PRICING: { historyDays: { free: 7, pro: -1 } }, isWithinFreeHour: () => false },
})
const history = load('src/app/api/banner/history/route.ts', {
  'next/server': nextServer,
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner', plan: 'FREE' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/banner/history-access': access,
  '@/lib/banner/history-cursor': load('src/lib/banner/history-cursor.ts'),
  sharp: () => { throw new Error('image processing is not needed') },
})

;(async () => {
  await check('public gallery does not delete private or older banner history', async () => {
    const response = await gallery.GET({ url: 'https://example.test/api/banner/gallery' })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).items, [])
    assert.equal(deletions, 0)
  })
  await check('paid history can read a saved image older than 90 days', async () => {
    plan = 'PRO'
    const response = await history.GET({ url: 'https://example.test/api/banner/history?images=0' })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].bannerCount, 1)
    assert.equal(deletions, 0)
  })
  await check('free seven-day view does not destroy older paid history', async () => {
    plan = 'FREE'
    const response = await history.GET({ url: 'https://example.test/api/banner/history?images=0' })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).items, [])
    assert.equal(deletions, 0)
  })
  await check('older image remains available after returning to a paid plan', async () => {
    plan = 'PRO'
    const response = await history.GET({ url: 'https://example.test/api/banner/history?images=0' })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).items[0].bannerCount, 1)
    assert.equal(deletions, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
