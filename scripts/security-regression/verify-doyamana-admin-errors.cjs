const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_DATABASE_DETAIL'
let dbCalls = 0
let lastWhere
let fail = true
const throwOrReturn = (result, options) => {
  dbCalls++
  if (options?.where) lastWhere = options.where
  if (fail) throw new Error(secret)
  return result
}
const prisma = { bannerTemplate: {
  findMany: async (options) => throwOrReturn([], options),
  count: async (options) => throwOrReturn(0, options),
  findUnique: async (options) => throwOrReturn(null, options),
  create: async (options) => throwOrReturn(null, options),
  update: async (options) => throwOrReturn(null, options),
  delete: async (options) => throwOrReturn(null, options),
  deleteMany: async (options) => throwOrReturn({ count: 0 }, options),
  updateMany: async (options) => throwOrReturn({ count: 0 }, options),
}, doyamanaCategory: { findUnique: async () => null } }
const mocks = {
  'node:crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [{ id: 'known', genre: '既知' }], GENRES: [{ id: 'known', name: '既知', category: 'it' }] },
  '@/lib/admin-guard': { requireAdmin: async () => null },
  '@/lib/doyamana-categories': { listDoyamanaCategories: async () => throwOrReturn(null) },
  '@/lib/banner-admin-image-storage': { bannerAdminImageExists: async () => true },
  '@/lib/operational-json': { readOperationalJson: async req => req.json(), OperationalBodyError: class extends Error {} },
}
const base = 'src/app/api/admin/doyamana'
const images = load(`${base}/images/route.ts`, mocks)
const categories = load(`${base}/categories/route.ts`, mocks)
const detail = load(`${base}/images/[id]/route.ts`, mocks)
const detailContext = { params: Promise.resolve({ id: 'item' }) }
const req = (method, body) => ({ url: 'https://example.test/api/admin/doyamana/images', json: async () => body, method })

async function privateFailure(response) {
  assert.equal(response.status, 500)
  const body = await response.json()
  assert.equal(JSON.stringify(body).includes(secret), false)
  assert.equal('details' in body, false)
}

;(async () => {
  for (const query of ['page=0', 'page=1foo', 'page=100001', 'limit=-1', 'limit=101', `search=${'a'.repeat(201)}`]) {
    const before = dbCalls
    const response = await images.GET({ url: `https://example.test/api/admin/doyamana/images?${query}` })
    assert.equal(response.status, 400, query)
    assert.equal(dbCalls, before, query)
  }

  await privateFailure(await categories.GET(req('GET')))
  await privateFailure(await images.GET(req('GET')))
  await privateFailure(await images.POST(req('POST', { templateId: 'new', industry: 'test', category: 'it', prompt: 'test' })))
  await privateFailure(await images.PATCH(req('PATCH', { action: 'delete', ids: ['item'] })))
  await privateFailure(await detail.GET(req('GET'), detailContext))
  await privateFailure(await detail.PUT(req('PUT', { prompt: 'new' }), detailContext))
  await privateFailure(await detail.DELETE(req('DELETE'), detailContext))

  const before = dbCalls
  assert.equal((await images.PATCH(req('PATCH', { action: 'delete', ids: Array(101).fill('item') }))).status, 400)
  assert.equal(dbCalls, before)

  fail = false
  const unknown = await images.GET({ url: 'https://example.test/api/admin/doyamana/images?category=unknown' })
  assert.equal(unknown.status, 200)
  assert.equal(JSON.stringify(lastWhere), JSON.stringify({ industry: 'unknown' }))

  console.log('PASS Doyamana admin APIs bound reads and writes, filter unknown genres, and hide database details')
})().catch((error) => { console.error(error); process.exitCode = 1 })
