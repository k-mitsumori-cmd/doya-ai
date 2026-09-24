const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { parseAishodanPage, appendAishodanPage } = load('src/lib/aishodan/list-pages.ts')

const rows = (name, count) => Array.from({ length: count }, (_, index) => ({
  id: `${name}-${String(count - index).padStart(3, '0')}`,
  organizationId: 'own-org',
  createdAt: new Date('2026-09-25T00:00:00Z'),
  isPreview: index % 2 === 0,
  outcome: { verdict: index % 2 === 0 ? 'hot' : 'cold' },
}))
const data = { products: rows('product', 251), rooms: rows('room', 251), sessions: rows('session', 451) }
function matches(row, where) {
  if (row.organizationId !== where.organizationId) return false
  if (where.id && row.id !== where.id) return false
  if (where.isPreview !== undefined && row.isPreview !== where.isPreview) return false
  if (where.room?.isPreview !== undefined && row.isPreview !== where.room.isPreview) return false
  if (where.outcome?.verdict && row.outcome.verdict !== where.outcome.verdict) return false
  if (where.status && row.status !== where.status) return false
  return true
}
function model(key) {
  return {
    findFirst: async ({ where }) => data[key].find((row) => matches(row, where)) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.equal(where.organizationId, 'own-org')
      assert.equal(take, key === 'sessions' ? 201 : 101)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
      const filtered = data[key].filter((row) => matches(row, where))
      const start = cursor ? filtered.findIndex((row) => row.id === cursor.id) + 1 : 0
      return filtered.slice(start, start + take)
    },
    count: async ({ where }) => data[key].filter((row) => matches(row, where)).length,
  }
}
const prisma = {
  aishodanProduct: model('products'),
  aishodanRoom: model('rooms'),
  aishodanSession: model('sessions'),
}
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/aishodan/access': { getAishodanContext: async () => ({ organizationId: 'own-org' }), orgSlugFrom: () => 'own-org' },
}
const routes = {
  products: load('src/app/api/aishodan/products/route.ts', { ...common,
    '@/lib/aishodan/knowledge': {}, '@/lib/aishodan/defaults': {}, '@/lib/plan-limit': {}, '@/lib/service-usage': {},
  }),
  rooms: load('src/app/api/aishodan/rooms/route.ts', { ...common, crypto: { randomBytes: () => Buffer.alloc(24) }, '@/lib/service-usage': {} }),
  sessions: load('src/app/api/aishodan/sessions/route.ts', common),
}

;(async () => {
  for (const [key, expected, pageSize] of [['products', 251, 100], ['rooms', 125, 100], ['sessions', 451, 200]]) {
    await check(`all ${key} records remain reachable across pages`, async () => {
      let all = [], cursor = null, total = null
      do {
        const url = new URL('http://offline.invalid/')
        if (cursor) url.searchParams.set('cursor', cursor)
        const response = await routes[key].GET(new Request(url))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('cache-control'), 'private, no-store')
        const page = parseAishodanPage(await response.json(), key, pageSize)
        total ??= page.total
        all = appendAishodanPage(all, page, total)
        cursor = page.nextCursor
      } while (cursor)
      assert.equal(all.length, expected)
      assert.equal(new Set(all.map((row) => row.id)).size, expected)
    })
    await check(`${key} rejects malformed or foreign cursors`, async () => {
      for (const cursor of ['foreign-id', 'bad!', '']) {
        const response = await routes[key].GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
        assert.equal(response.status, 400)
      }
    })
  }
  await check('session cursor must match preview and verdict filters', async () => {
    const wrongPreview = await routes.sessions.GET(new Request('http://offline.invalid/?scope=preview&cursor=session-450'))
    assert.equal(wrongPreview.status, 400)
    const wrongVerdict = await routes.sessions.GET(new Request('http://offline.invalid/?verdict=cold&cursor=session-451'))
    assert.equal(wrongVerdict.status, 400)
  })
  await check('inconsistent pages are errors, not an empty or complete list', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ id: `p-${index}` }))
    const current = appendAishodanPage([], { items: first, total: 101, nextCursor: 'p-99' }, 101)
    assert.throws(() => appendAishodanPage(current, { items: [{ id: 'p-0' }], total: 101, nextCursor: null }, 101), /更新/)
    assert.throws(() => appendAishodanPage(current, { items: [{ id: 'new' }], total: 102, nextCursor: null }, 101), /更新/)
    assert.throws(() => parseAishodanPage({ products: [{ id: 'short' }], total: 2, nextCursor: 'short' }, 'products', 100), /正しく/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
