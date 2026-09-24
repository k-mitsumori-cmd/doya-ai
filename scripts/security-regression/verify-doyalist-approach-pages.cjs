const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { parseApproachPage, appendApproachPage } = load('src/lib/doyalist/approach-pages.ts')

const rows = Array.from({ length: 451 }, (_, index) => ({
  id: `approach-${String(451 - index).padStart(3, '0')}`,
  projectUserId: 'own-user',
  type: index % 3 === 0 ? 'form' : index % 3 === 1 ? 'email' : 'phone',
  subject: index === 450 ? 'old searchable subject' : `subject ${index}`,
  body: index === 450 ? 'old searchable body' : `body ${index}`,
  createdAt: new Date('2026-09-25T00:00:00Z'),
}))
let fail = false
function matches(row, where) {
  if (row.projectUserId !== where.project?.userId) return false
  if (where.id && row.id !== where.id) return false
  if (where.type && row.type !== where.type) return false
  if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) return false
  if (where.OR && !where.OR.some((part) => {
    const key = part.subject ? 'subject' : 'body'
    return row[key].toLowerCase().includes(part[key].contains.toLowerCase())
  })) return false
  return true
}
const prisma = { doyalistApproach: {
  findFirst: async ({ where }) => rows.find((row) => matches(row, where)) || null,
  findMany: async ({ where, orderBy, take, cursor }) => {
    assert.equal(take, 51)
    assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
    const filtered = rows.filter((row) => matches(row, where))
    const start = cursor ? filtered.findIndex((row) => row.id === cursor.id) + 1 : 0
    return filtered.slice(start, start + take)
  },
  count: async ({ where }) => {
    if (fail) throw new Error('private database details')
    return rows.filter((row) => matches(row, where)).length
  },
  groupBy: async ({ where }) => {
    const groups = new Map()
    for (const row of rows.filter((item) => matches(item, where))) groups.set(row.type, (groups.get(row.type) || 0) + 1)
    return [...groups].map(([type, count]) => ({ type, _count: { _all: count } }))
  },
} }
const route = load('src/app/api/doyalist/approaches/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'own-user' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date('2026-09-01T00:00:00Z') },
})

;(async () => {
  await check('451 sales texts remain reachable across ten owner-scoped pages', async () => {
    let all = [], cursor = null, pages = 0
    do {
      const url = new URL('http://offline.invalid/api/doyalist/approaches')
      if (cursor) url.searchParams.set('cursor', cursor)
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const page = parseApproachPage(await response.json())
      assert.equal(page.summary.allTotal, 451)
      all = appendApproachPage(all, page, 451)
      cursor = page.nextCursor
      pages++
    } while (cursor)
    assert.equal(all.length, 451)
    assert.equal(pages, 10)
    assert.equal(all.at(-1).id, 'approach-001')
  })
  await check('search and type filters reach older records, cursor cannot cross filters', async () => {
    const search = await route.GET(new Request('http://offline.invalid/?search=old%20searchable'))
    const found = parseApproachPage(await search.json())
    assert.equal(found.total, 1)
    assert.equal(found.approaches[0].id, 'approach-001')
    const filtered = await route.GET(new Request('http://offline.invalid/?type=form'))
    const page = parseApproachPage(await filtered.json())
    assert.equal(page.total, 151)
    assert.equal(page.summary.allTotal, 451)
    const wrongType = await route.GET(new Request('http://offline.invalid/?type=email&cursor=approach-451'))
    assert.equal(wrongType.status, 400)
    const wrongSearch = await route.GET(new Request('http://offline.invalid/?search=missing&cursor=approach-451'))
    assert.equal(wrongSearch.status, 400)
  })
  await check('invalid or foreign cursors and oversized searches are rejected', async () => {
    for (const cursor of ['', 'foreign-id', 'bad!']) {
      assert.equal((await route.GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))).status, 400)
    }
    assert.equal((await route.GET(new Request(`http://offline.invalid/?search=${'x'.repeat(201)}`))).status, 400)
  })
  await check('database failure is an error without leaking internals', async () => {
    fail = true
    const response = await route.GET(new Request('http://offline.invalid/'))
    fail = false
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: '履歴の取得に失敗しました' })
  })
  await check('inconsistent pagination never becomes a complete history', async () => {
    const first = Array.from({ length: 50 }, (_, index) => ({ id: `a-${index}` }))
    const summary = { allTotal: 51, thisMonth: 0, countsByType: { form: 51 } }
    const current = appendApproachPage([], { approaches: first, total: 51, nextCursor: 'a-49', summary }, 51)
    assert.throws(() => appendApproachPage(current, { approaches: [{ id: 'a-0' }], total: 51, nextCursor: null, summary }, 51), /更新/)
    assert.throws(() => appendApproachPage(current, { approaches: [{ id: 'new' }], total: 52, nextCursor: null, summary }, 51), /更新/)
    assert.throws(() => parseApproachPage({ approaches: [{ id: 'short' }], total: 2, nextCursor: 'short', summary }), /正しく/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
