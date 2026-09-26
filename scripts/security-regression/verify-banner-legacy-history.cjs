const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const legacy = load('src/lib/banner/legacy-history.ts')
const minute = Date.parse('2026-09-26T11:00:00.000Z')
const key = '2026-09-26T11:00|target|1080x1080'
const rows = Array.from({ length: 153 }, (_, index) => ({
  id: `image-${String(index).padStart(3, '0')}`, userId: 'owner', serviceId: 'banner', outputType: 'IMAGE',
  createdAt: new Date(minute + (153 - index) * 300),
  input: { keyword: index >= 150 ? 'target' : 'other', size: '1080x1080' }, metadata: {},
})).concat([
  { id: 'foreign', userId: 'other', serviceId: 'banner', outputType: 'IMAGE', createdAt: new Date(minute + 59_900), input: { keyword: 'target', size: '1080x1080' }, metadata: {} },
  { id: 'modern', userId: 'owner', serviceId: 'banner', outputType: 'IMAGE', createdAt: new Date(minute + 59_600), input: { keyword: 'target', size: '1080x1080' }, metadata: { batchId: 'separate-modern' } },
])
let scanned = 0
let deletedIds = []
const prisma = {
  generation: {
    findMany: async ({ where, orderBy, take, select }) => {
      if (where.metadata) return rows.filter(row => row.userId === where.userId && row.metadata.batchId === where.metadata.equals && !deletedIds.includes(row.id)).map(row => ({ id: row.id }))
      assert.equal(JSON.stringify(orderBy), JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]))
      assert.equal(take, 101)
      assert.equal(select.output, undefined)
      scanned++
      return rows.filter(row => row.userId === where.userId && !deletedIds.includes(row.id) && row.createdAt >= where.createdAt.gte && row.createdAt <= where.createdAt.lte)
        .filter(row => !where.OR || row.createdAt < where.OR[0].createdAt.lt || row.createdAt.getTime() === where.OR[1].createdAt.getTime() && row.id < where.OR[1].id.lt)
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, take)
    },
    deleteMany: async ({ where }) => {
      assert.equal(where.userId, 'owner')
      assert.equal(where.serviceId, 'banner')
      assert.equal(where.outputType, 'IMAGE')
      const ids = rows.filter(row => row.userId === where.userId && !deletedIds.includes(row.id) && where.OR.some(clause =>
        clause.metadata ? row.metadata.batchId === clause.metadata.equals : clause.id.in.includes(row.id)
      )).map(row => row.id)
      deletedIds.push(...ids)
      return { count: ids.length }
    },
  },
}
const route = load('src/app/api/banner/history/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/banner/history-access': { bannerHistoryCutoff: async () => new Date(0) },
  '@/lib/banner/history-cursor': load('src/lib/banner/history-cursor.ts'),
  '@/lib/banner/legacy-history': legacy,
  sharp: () => { throw new Error('image processing is not needed') },
})
const get = value => route.GET({ url: `https://local.test/api/banner/history?batchId=${encodeURIComponent(value)}` })
const remove = value => route.DELETE({ url: `https://local.test/api/banner/history?batchId=${encodeURIComponent(value)}` })

;(async () => {
  await check('legacy batch lookup reaches matching images after more than 20 unrelated images in one minute', async () => {
    const response = await get(key)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.bannerCount, 3)
    assert.equal(JSON.stringify(body.bannerIds), JSON.stringify(['image-150', 'image-151', 'image-152']))
    assert.ok(scanned >= 2)
  })
  await check('legacy batch deletion removes every matching owned image and no unrelated image', async () => {
    const response = await remove(key)
    assert.equal(response.status, 200)
    assert.equal(JSON.stringify(deletedIds), JSON.stringify(['image-150', 'image-151', 'image-152']))
    assert.equal(deletedIds.includes('modern'), false)
    assert.equal((await (await get(key)).json()).bannerCount, 0)
  })
  await check('a mixed modern and legacy batch ID returns and removes both groups', async () => {
    deletedIds = []
    rows.find(row => row.id === 'modern').metadata.batchId = key
    const body = await (await get(key)).json()
    assert.equal(body.bannerCount, 4)
    assert.equal(new Set(body.bannerIds).size, 4)
    assert.equal((await remove(key)).status, 200)
    assert.equal(new Set(deletedIds).size, 4)
    assert.equal((await (await get(key)).json()).bannerCount, 0)
  })
  await check('legacy parser accepts a pipe in the keyword and rejects invalid minutes', async () => {
    assert.equal(legacy.parseLegacyBannerBatchId('2026-09-26T11:00|target|special|1080x1080').keyword, 'target|special')
    assert.equal(legacy.parseLegacyBannerBatchId('2026-99-99T11:00|target|1080x1080'), null)
    assert.equal((await get('2026-99-99T11:00|target|1080x1080')).status, 400)
    const countBefore = deletedIds.length
    assert.equal((await remove('2026-99-99T11:00|target|1080x1080')).status, 400)
    assert.equal(deletedIds.length, countBefore)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
