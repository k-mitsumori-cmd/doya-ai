const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { appendPreparationPage, parsePreparationPage, mergePreparationUpdates } = load('src/lib/shodan/preparation-pages.ts')

const rows = Array.from({ length: 251 }, (_, index) => ({
  id: `prep-${String(251 - index).padStart(3, '0')}`,
  organizationId: 'own-org',
  targetUrl: 'https://example.com',
  targetName: null,
  status: index === 150 ? 'processing' : 'done',
  createdAt: new Date('2026-09-24T00:00:00Z'),
  updatedAt: new Date('2026-09-24T00:00:00Z'),
}))
const prisma = {
  shodanPreparation: {
    findFirst: async ({ where }) => rows.find((row) => row.id === where.id && row.organizationId === where.organizationId) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.equal(where.organizationId, 'own-org')
      if (where.id) return rows.filter((row) => where.id.in.includes(row.id) && row.organizationId === where.organizationId)
      assert.equal(take, 101)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
      const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0
      return rows.slice(start, start + take)
    },
    count: async ({ where }) => {
      assert.equal(where.organizationId, 'own-org')
      return rows.length
    },
  },
}
const route = load('src/app/api/shodan/preparations/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'own-org' }), orgSlugFrom: () => 'own-org' },
  '@/lib/shodan/research': {},
  '@/lib/shodan/types': { effectivePrepStatus: (status) => status, PREP_STALE_MS: 360000, SHODAN_MONTHLY_LIMIT: { FREE: 5, PRO: 50, ENTERPRISE: 300 } },
  '@/lib/plan-limit': {},
})

;(async () => {
  await check('251 Shodan preparations are reachable across three scoped pages', async () => {
    let result = []
    let cursor = null
    let expectedTotal = null
    let pages = 0
    do {
      const url = new URL('http://offline.invalid/api/shodan/preparations')
      if (cursor) url.searchParams.set('cursor', cursor)
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      const page = parsePreparationPage(await response.json())
      expectedTotal ??= page.total
      result = appendPreparationPage(result, page, expectedTotal)
      cursor = page.nextCursor
      pages++
    } while (cursor)
    assert.equal(result.length, 251)
    assert.equal(pages, 3)
    assert.equal(result.at(-1).id, 'prep-001')
  })
  await check('malformed and foreign Shodan cursors and watch IDs are rejected or scoped', async () => {
    for (const cursor of ['foreign-id', 'bad!', '']) {
      const response = await route.GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
    for (const watch of ['', 'bad!', Array(101).fill('prep-001').join(',')]) {
      const response = await route.GET(new Request(`http://offline.invalid/?watch=${encodeURIComponent(watch)}`))
      assert.equal(response.status, 400)
    }
    const response = await route.GET(new Request('http://offline.invalid/?watch=prep-101,foreign-id'))
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).items.map((item) => item.id), ['prep-101'])
  })
  await check('status refresh updates an older preparation without dropping loaded pages', async () => {
    const existing = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
    const target = existing.find((row) => row.id === 'prep-101')
    assert.equal(target.status, 'processing')
    const updated = mergePreparationUpdates(existing, [{ ...target, status: 'done', targetName: '更新済み' }])
    assert.equal(updated.length, 251)
    assert.equal(updated.find((row) => row.id === 'prep-101').status, 'done')
    assert.equal(updated.at(-1).id, 'prep-001')
    assert.equal(mergePreparationUpdates(updated, [{ ...target, status: 'done', targetName: '更新済み' }]), updated)
  })
  await check('failed or inconsistent continuation does not become a complete Shodan list', async () => {
    const firstRows = Array.from({ length: 100 }, (_, index) => ({ id: `prep-${index}` }))
    const current = appendPreparationPage([], { items: firstRows, nextCursor: 'prep-99', total: 101 }, 101)
    assert.throws(() => appendPreparationPage(current, { items: [{ id: 'prep-0' }], nextCursor: null, total: 101 }, 101), /更新/)
    assert.throws(() => appendPreparationPage(current, { items: [{ id: 'new' }], nextCursor: null, total: 102 }, 101), /更新/)
    assert.throws(() => appendPreparationPage(current, { items: [], nextCursor: null, total: 101 }, 101), /最後まで/)
    assert.throws(() => parsePreparationPage({ items: [{ id: 'short' }], nextCursor: 'short', total: 2 }), /正しく/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
