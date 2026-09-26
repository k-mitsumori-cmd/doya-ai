const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let plan = 'FREE'
let userId = 'owner'
let imageDate = new Date(Date.now() - 12 * 86_400_000)
const prisma = {
  userServiceSubscription: { findUnique: async () => ({ plan }) },
  generation: { findFirst: async ({ where }) => where.userId === 'owner' && where.id === 'owned-image' && imageDate >= where.createdAt.gte ? { output: 'data:image/png;base64,AA==' } : null },
}
const access = load('src/lib/banner/history-access.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/pricing': { BANNER_PRICING: { historyDays: { free: 7, pro: -1 } }, isWithinFreeHour: () => false },
})
const route = load('src/app/api/banner/history/image/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
  'next-auth': { getServerSession: async () => userId ? { user: { id: userId } } : null },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/banner/history-access': access,
})
const get = id => route.GET({ url: `https://local.test/api/banner/history/image?id=${id}` })

;(async () => {
  await check('free banner history excludes images older than seven days', async () => {
    plan = 'FREE'
    assert.equal((await get('owned-image')).status, 404)
  })
  await check('free banner history still permits recent owned images', async () => {
    imageDate = new Date(Date.now() - 3 * 86_400_000)
    const response = await get('owned-image')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  })
  await check('paid banner history keeps older owned images, never foreign images', async () => {
    plan = 'PRO'
    imageDate = new Date(Date.now() - 120 * 86_400_000)
    assert.equal((await get('owned-image')).status, 200)
    assert.equal((await get('foreign-image')).status, 404)
    userId = 'other'
    assert.equal((await get('owned-image')).status, 404)
  })
  await check('anonymous image access is rejected', async () => {
    userId = ''
    assert.equal((await get('owned-image')).status, 401)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
