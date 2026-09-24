const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const sessions = Array.from({ length: 451 }, (_, index) => ({
  id: `session-${String(451 - index).padStart(3, '0')}`,
  organizationId: 'own-org',
  status: index % 2 ? 'evaluated' : 'pending',
  createdAt: new Date('2026-09-25T00:00:00Z'),
}))
const prisma = {
  mensetsuSession: {
    findFirst: async ({ where }) => sessions.find((row) => row.id === where.id && row.organizationId === where.organizationId && (!where.status || row.status === where.status)) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.equal(where.organizationId, 'own-org')
      assert.equal(take, 201)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
      const rows = sessions.filter((row) => !where.status || row.status === where.status)
      const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0
      return rows.slice(start, start + take)
    },
    count: async ({ where }) => sessions.filter((row) => row.organizationId === where.organizationId && (!where.status || row.status === where.status)).length,
  },
}
const route = load('src/app/api/mensetsu/sessions/route.ts', {
  crypto: { randomBytes: () => Buffer.alloc(24) },
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/mensetsu/interview-url': {},
  '@/lib/plan-limit': {},
  '@/lib/service-usage': {},
  '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'own-org' }), orgSlugFrom: () => 'own-org' },
})
const helpers = load('src/lib/mensetsu/session-pages.ts', {
  '@/lib/org-fetch': { fetchOrgJson: async () => { throw new Error('取得失敗') } },
})
const { parseMensetsuSessionPage, appendMensetsuSessionPage, fetchMensetsuSessionPage } = helpers

;(async () => {
  await check('all 451 interview sessions remain reachable across three pages', async () => {
    let result = []
    let cursor = null
    let expectedTotal = null
    let pages = 0
    do {
      const url = new URL('http://offline.invalid/api/mensetsu/sessions')
      if (cursor) url.searchParams.set('cursor', cursor)
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      const page = parseMensetsuSessionPage(await response.json())
      expectedTotal ??= page.total
      result = appendMensetsuSessionPage(result, page, expectedTotal)
      cursor = page.nextCursor
      pages++
    } while (cursor)
    assert.equal(result.length, 451)
    assert.equal(result.at(-1).id, 'session-001')
    assert.equal(pages, 3)
  })
  await check('status-filtered pages and cursors remain organization scoped', async () => {
    for (const cursor of ['foreign-id', 'bad!', '']) {
      const response = await route.GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
    const wrongStatus = await route.GET(new Request('http://offline.invalid/?status=evaluated&cursor=session-451'))
    assert.equal(wrongStatus.status, 400)
    const first = await route.GET(new Request('http://offline.invalid/?status=evaluated'))
    assert.equal(first.status, 200)
    const page = await first.json()
    assert.equal(page.total, 225)
    assert.equal(page.sessions.length, 200)
    assert.equal(page.nextCursor, page.sessions.at(-1).id)
  })
  await check('failed and inconsistent interview pages never become an empty success', async () => {
    await assert.rejects(fetchMensetsuSessionPage(), /取得失敗/)
    const firstRows = Array.from({ length: 200 }, (_, index) => ({ id: `session-${index}` }))
    const current = appendMensetsuSessionPage([], { sessions: firstRows, nextCursor: 'session-199', total: 201 }, 201)
    assert.equal(current.length, 200)
    assert.throws(() => appendMensetsuSessionPage(current, { sessions: [{ id: 'session-0' }], nextCursor: null, total: 201 }, 201), /更新/)
    assert.throws(() => appendMensetsuSessionPage(current, { sessions: [{ id: 'new' }], nextCursor: null, total: 202 }, 201), /更新/)
    assert.throws(() => appendMensetsuSessionPage(current, { sessions: [], nextCursor: null, total: 201 }, 201), /最後まで/)
    assert.throws(() => parseMensetsuSessionPage({ sessions: [{ id: 'short' }], nextCursor: 'short', total: 2 }), /正しく/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
