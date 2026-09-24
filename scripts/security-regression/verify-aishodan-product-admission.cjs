const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const pendingName = '__doya_aishodan_ingesting_v1__'
const products = []
let sequence = 0
let crawlCalls = 0
let profileCalls = 0
let failScenario = false
let releaseCrawl
let waitForCrawl

function matches(row, where) {
  if (where.organizationId && row.organizationId !== where.organizationId) return false
  if (where.id && row.id !== where.id) return false
  if (where.name?.not && row.name === where.name.not) return false
  if (typeof where.name === 'string' && row.name !== where.name) return false
  if (where.createdAt?.lt && !(row.createdAt < where.createdAt.lt)) return false
  return true
}
const productModel = {
  findFirst: async ({ where }) => products.find((row) => matches(row, where)) || null,
  findMany: async ({ where }) => products.filter((row) => matches(row, where)),
  count: async ({ where }) => products.filter((row) => matches(row, where)).length,
  create: async ({ data }) => {
    const row = { id: `product-${++sequence}`, createdAt: new Date(), ...data }
    products.push(row)
    return row
  },
  update: async ({ where, data }) => {
    const row = products.find((item) => item.id === where.id)
    Object.assign(row, data)
    return row
  },
  deleteMany: async ({ where }) => {
    for (let i = products.length - 1; i >= 0; i--) if (matches(products[i], where)) products.splice(i, 1)
  },
}
const prisma = {
  aishodanProduct: productModel,
  aishodanScenario: { create: async () => {
    if (failScenario) throw Error('scenario write failed')
    return { id: 'scenario-1' }
  } },
  $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    return callback({ aishodanProduct: productModel })
  },
}
const route = load('src/app/api/aishodan/products/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/aishodan/access': { getAishodanContext: async () => ({ organizationId: 'org', userId: 'user' }), orgSlugFrom: () => 'org' },
  '@/lib/aishodan/knowledge': {
    crawlProductSite: async () => {
      crawlCalls++
      if (waitForCrawl) await waitForCrawl
      return [{ url: 'https://example.com/', title: 'Example', text: 'content' }]
    },
    generateProfile: async () => { profileCalls++; return { oneLiner: 'Example product' } },
    ingestPages: async () => 2,
  },
  '@/lib/aishodan/defaults': { DEFAULT_GUARDRAILS: {}, DEFAULT_ICP: {}, DEFAULT_PERSONA: {}, DEFAULT_PHASES: [], DEFAULT_SLOTS: [] },
  '@/lib/plan-limit': { FREE_LIMITS: { aishodanProducts: 1 }, assertFreeLimit: async (_key, count) => {
    const used = await count()
    return used >= 1 ? { ok: false, used, limit: 1, reason: '無料枠に達しました' } : { ok: true, used, limit: 1 }
  } },
  '@/lib/service-usage': { recordServiceUsage: () => {} },
})
const post = () => route.POST(new Request('http://offline.invalid/api/aishodan/products', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/' }),
}))

;(async () => {
  await check('pending import is hidden and another import spends no crawl or AI call', async () => {
    waitForCrawl = new Promise((resolve) => { releaseCrawl = resolve })
    const first = post()
    for (let i = 0; i < 20 && crawlCalls === 0; i++) await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(crawlCalls, 1)
    assert.equal(products[0].name, pendingName)
    const listing = await route.GET(new Request('http://offline.invalid/api/aishodan/products'))
    assert.equal((await listing.json()).total, 0)
    const second = await post()
    assert.equal(second.status, 409)
    assert.equal((await second.json()).code, 'IMPORT_IN_PROGRESS')
    assert.equal(crawlCalls, 1)
    assert.equal(profileCalls, 0)
    releaseCrawl()
    waitForCrawl = null
    assert.equal((await first).status, 200)
    assert.equal(products[0].name, 'Example product')
  })
  await check('free cap rejects before crawl or AI generation and gives pricing link', async () => {
    const response = await post()
    assert.equal(response.status, 402)
    assert.equal((await response.json()).upgradeUrl, '/aishodan/pricing')
    assert.equal(crawlCalls, 1)
    assert.equal(profileCalls, 1)
  })
  await check('failed save removes reserved product and allows retry', async () => {
    products.length = 0
    failScenario = true
    const response = await post()
    assert.equal(response.status, 503)
    assert.equal(products.length, 0)
    failScenario = false
    assert.equal((await post()).status, 200)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
