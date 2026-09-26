const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const cursors = load('src/lib/banner/history-cursor.ts')
const base = Date.parse('2026-09-20T12:00:00.000Z')
const rows = Array.from({ length: 82 }, (_, index) => ({
  id: `image-${String(index).padStart(3, '0')}`, userId: 'owner', serviceId: 'banner', outputType: 'IMAGE',
  createdAt: new Date(base - index * 1000),
  input: { keyword: 'test', size: 'square' },
  metadata: { batchId: index === 29 || index === 31 ? 'shared-batch' : `batch-${index}` },
})).concat([{ id: 'other-image', userId: 'other', serviceId: 'banner', outputType: 'IMAGE', createdAt: new Date(base), input: {}, metadata: { batchId: 'other-batch' } }])
let plan = 'PRO'
let hasServiceSubscription = true
let accountPlan = 'FREE'
let queries = 0
const prisma = {
  userServiceSubscription: { findUnique: async () => hasServiceSubscription ? { plan } : null },
  user: { findUnique: async () => ({ plan: accountPlan }) },
  generation: { findMany: async ({ where, orderBy, take }) => {
    queries++
    assert.equal(JSON.stringify(orderBy), JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]))
    assert.equal(take, 361)
    return rows.filter(row => row.userId === where.userId && row.createdAt >= where.createdAt.gte)
      .filter(row => !where.OR || row.createdAt < where.OR[0].createdAt.lt || row.createdAt.getTime() === where.OR[1].createdAt.getTime() && row.id < where.OR[1].id.lt)
      .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, take)
  } },
}
const access = load('src/lib/banner/history-access.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/pricing': { BANNER_PRICING: { historyDays: { free: 0, pro: -1 } }, isWithinFreeHour: () => false },
})
const route = load('src/app/api/banner/history/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner', bannerPlan: 'PRO', plan: 'PRO' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/banner/history-access': access,
  '@/lib/banner/legacy-history': load('src/lib/banner/legacy-history.ts'),
  '@/lib/banner/history-cursor': cursors,
  sharp: () => { throw new Error('image processing is not needed') },
})
const get = cursor => route.GET({ url: `https://local.test/api/banner/history?take=30&images=0${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}` })

;(async () => {
  await check('all saved batches stay reachable across pages, including a split batch', async () => {
    const merged = new Map()
    let cursor
    for (let page = 0; page < 10; page++) {
      const response = await get(cursor)
      assert.equal(response.status, 200)
      const body = await response.json()
      for (const item of body.items) merged.set(item.id, (merged.get(item.id) || 0) + item.bannerCount)
      cursor = body.nextCursor
      if (!cursor) break
    }
    assert.equal(cursor, null)
    assert.equal(merged.size, 81)
    assert.equal([...merged.values()].reduce((sum, count) => sum + count, 0), 82)
    assert.equal(merged.get('shared-batch'), 2)
    assert.equal(merged.has('other-batch'), false)
  })
  await check('foreign and malformed cursors are rejected before reading images', async () => {
    for (const cursor of ['bad!', '', cursors.encodeBannerHistoryCursor(rows[0], 'other')]) {
      const before = queries
      const response = await get(cursor)
      assert.equal(response.status, 400)
      assert.equal(queries, before)
    }
  })
  await check('a stale paid session cannot unlock history after a database downgrade', async () => {
    plan = 'FREE'
    const before = queries
    const response = await get()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).requiresUpgrade, true)
    assert.equal(queries, before)
  })
  await check('a paid account without a service row keeps its paid history entitlement', async () => {
    hasServiceSubscription = false
    accountPlan = 'PRO'
    const response = await get()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).items.length, 30)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
