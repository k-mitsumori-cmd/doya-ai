const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { appendKintaiRequestPage } = load('src/lib/kintai/load-requests.ts');

const rows = Array.from({ length: 251 }, (_, i) => ({
  id: `request-${String(251 - i).padStart(3, '0')}`,
  employeeId: 'employee-1', status: 'pending', submittedAt: new Date('2026-09-24T00:00:00Z'),
}))
const prisma = {
  kintaiEmployee: { findMany: async () => [{ id: 'employee-1' }] },
  kintaiRequest: {
    findFirst: async ({ where }) => rows.find((row) => row.id === where.id && where.employeeId.in.includes(row.employeeId)) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.deepEqual(JSON.parse(JSON.stringify(where.employeeId)), { in: ['employee-1'] })
      assert.equal(take, 101)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ submittedAt: 'desc' }, { id: 'desc' }])
      const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0
      return rows.slice(start, start + take)
    },
    count: async () => rows.length,
    groupBy: async () => [{ status: 'pending', _count: { _all: rows.length } }],
  },
}
const route = load('src/app/api/kintai/requests/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/access': { getKintaiContext: async () => ({ employeeId: 'viewer', organizationId: 'org', role: 'hr_admin' }), hasMinRole: () => true },
});

(async () => {
  await check('251 scoped requests are reachable across three stable cursor pages', async () => {
    const seenCursors = []
    let result = []
    let cursor = null
    let expectedTotal = null
    do {
      seenCursors.push(cursor)
      const url = new URL('http://offline.invalid/api/kintai/requests')
      if (cursor) url.searchParams.set('cursor', cursor)
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      const page = await response.json()
      expectedTotal ??= page.total
      result = appendKintaiRequestPage(result, page, expectedTotal)
      cursor = page.nextCursor
    } while (cursor)
    assert.equal(result.length, 251)
    assert.equal(result.at(-1).id, 'request-001')
    assert.equal(seenCursors.length, 3)
  })
  await check('foreign and malformed cursors cannot page through requests', async () => {
    for (const cursor of ['foreign-id', 'bad!', '']) {
      const response = await route.GET(new Request(`http://offline.invalid/api/kintai/requests?cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
  })
  await check('a failed or inconsistent continuation never resolves as complete', async () => {
    const firstRows = Array.from({ length: 100 }, (_, i) => ({ id: `request-${i}` }))
    const first = { requests: firstRows, nextCursor: 'request-99', total: 101, counts: { pending: 101 } }
    const current = appendKintaiRequestPage([], first, 101)
    assert.equal(current.length, 100)
    assert.throws(() => appendKintaiRequestPage(current, { requests: [{ id: 'request-0' }], nextCursor: null, total: 101, counts: { pending: 101 } }, 101), /Duplicate/)
    assert.throws(() => appendKintaiRequestPage(current, { requests: [{ id: 'new' }], nextCursor: null, total: 102, counts: { pending: 102 } }, 101), /changed/)
    assert.throws(() => appendKintaiRequestPage(current, { requests: [], nextCursor: null, total: 101, counts: { pending: 101 } }, 101), /Incomplete/)
    assert.throws(() => appendKintaiRequestPage([], { requests: [{ id: 'short' }], nextCursor: 'short', total: 2, counts: { pending: 2 } }, 2), /Invalid/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
