const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { parseQuoteListPage, appendQuoteListPage } = load('src/lib/quote/list-pages.ts')

const makeRows = (size, prefix) => Array.from({ length: size }, (_, index) => ({
  id: `${prefix}-${String(size - index).padStart(3, '0')}`,
  organizationId: 'own-org',
  createdAt: new Date('2026-09-24T00:00:00Z'),
}))
const products = makeRows(251, 'product')
const documents = makeRows(451, 'document')
function model(rows, pageSize) {
  return {
    findFirst: async ({ where }) => rows.find(row => row.id === where.id && row.organizationId === where.organizationId) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.equal(where.organizationId, 'own-org')
      assert.equal(take, pageSize + 1)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
      const start = cursor ? rows.findIndex(row => row.id === cursor.id) + 1 : 0
      return rows.slice(start, start + take)
    },
    count: async ({ where }) => {
      assert.equal(where.organizationId, 'own-org')
      return rows.length
    },
  }
}
const prisma = { quoteProduct: model(products, 100), quoteDocument: model(documents, 200) }
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/quote/access': {
    getQuoteContext: async () => ({ organizationId: 'own-org' }),
    orgSlugFrom: () => 'own-org',
  },
}
const productRoute = load('src/app/api/quote/products/route.ts', common)
const documentRoute = load('src/app/api/quote/documents/route.ts', {
  ...common,
  '@/lib/quote/document': {},
  '@/lib/plan-limit': {},
  '@/lib/service-usage': {},
})

async function collect(route, key, pageSize, expectedCount) {
  let result = []
  let cursor = null
  let expectedTotal = null
  let pages = 0
  do {
    const url = new URL('http://offline.invalid/api/quote/' + key)
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await route.GET(new Request(url))
    assert.equal(response.status, 200)
    const page = parseQuoteListPage(await response.json(), key, pageSize)
    expectedTotal ??= page.total
    result = appendQuoteListPage(result, page, expectedTotal)
    cursor = page.nextCursor
    pages++
  } while (cursor)
  assert.equal(result.length, expectedCount)
  assert.equal(pages, 3)
  assert.equal(new Set(result.map(row => row.id)).size, expectedCount)
}

;(async () => {
  await check('all 251 quote products remain selectable across three pages', async () => {
    await collect(productRoute, 'products', 100, 251)
  })
  await check('all 451 quote documents remain visible across three pages', async () => {
    await collect(documentRoute, 'documents', 200, 451)
  })
  await check('foreign and malformed quote cursors are rejected', async () => {
    for (const route of [productRoute, documentRoute]) {
      for (const cursor of ['foreign-id', 'bad!', '']) {
        const response = await route.GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
        assert.equal(response.status, 400)
      }
    }
  })
  await check('failed or changed continuation preserves loaded quote rows', async () => {
    const rows = makeRows(100, 'existing')
    const first = { rows, nextCursor: rows.at(-1).id, total: 101 }
    const current = appendQuoteListPage([], first, 101)
    assert.equal(current.length, 100)
    assert.throws(() => appendQuoteListPage(current, { rows: [{ id: rows[0].id }], nextCursor: null, total: 101 }, 101), /更新/)
    assert.throws(() => appendQuoteListPage(current, { rows: [{ id: 'new' }], nextCursor: null, total: 102 }, 101), /更新/)
    assert.throws(() => appendQuoteListPage(current, { rows: [], nextCursor: null, total: 101 }, 101), /最後まで/)
    assert.throws(() => parseQuoteListPage({ products: [{ id: 'short' }], nextCursor: 'short', total: 2 }, 'products', 100), /確認/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
