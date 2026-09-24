const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { parseCunningProfilePage, appendCunningProfilePage } = load('src/lib/cunning/profile-pages.ts')

const rows = (kind) => Array.from({ length: 121 }, (_, index) => ({
  id: `${kind}-${String(121 - index).padStart(3, '0')}`,
  userId: 'own-user',
  updatedAt: new Date('2026-09-25T00:00:00Z'),
}))
const data = { company: rows('company'), profiles: rows('profile') }
function model(kind) {
  return {
    findFirst: async ({ where }) => data[kind].find((row) => row.userId === where.userId && row.id === where.id) || null,
    findMany: async ({ where, cursor, take, orderBy }) => {
      assert.equal(where.userId, 'own-user')
      assert.equal(take, 51)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ updatedAt: 'desc' }, { id: 'desc' }])
      const start = cursor ? data[kind].findIndex((row) => row.id === cursor.id) + 1 : 0
      return data[kind].slice(start, start + take)
    },
    count: async ({ where }) => {
      assert.equal(where.userId, 'own-user')
      return data[kind].length
    },
  }
}
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { cunningCompanyProfile: model('company'), cunningApplicantProfile: model('profiles') } },
  '@/lib/cunning/access': { getUserId: async () => 'own-user' },
}
const routes = {
  company: load('src/app/api/cunning/company/route.ts', common),
  profiles: load('src/app/api/cunning/profiles/route.ts', common),
}

;(async () => {
  for (const kind of ['company', 'profiles']) {
    await check(`all 121 ${kind} profiles are reachable`, async () => {
      let all = [], cursor = null
      do {
        const url = new URL(`http://offline.invalid/api/cunning/${kind}`)
        if (cursor) url.searchParams.set('cursor', cursor)
        const response = await routes[kind].GET(new Request(url))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('cache-control'), 'private, no-store')
        const page = parseCunningProfilePage(await response.json())
        all = appendCunningProfilePage(all, page, 121)
        cursor = page.nextCursor
      } while (cursor)
      assert.equal(all.length, 121)
      assert.equal(new Set(all.map((row) => row.id)).size, 121)
    })
    await check(`${kind} rejects foreign or malformed cursors`, async () => {
      for (const cursor of ['', 'foreign-id', 'bad!']) {
        const response = await routes[kind].GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
        assert.equal(response.status, 400)
      }
    })
  }
  await check('profile page rejects inconsistent totals and duplicate continuations', async () => {
    const first = Array.from({ length: 50 }, (_, index) => ({ id: `p-${index}` }))
    const current = appendCunningProfilePage([], { profiles: first, total: 51, nextCursor: 'p-49' }, 51)
    assert.throws(() => appendCunningProfilePage(current, { profiles: [{ id: 'p-0' }], total: 51, nextCursor: null }, 51), /更新/)
    assert.throws(() => appendCunningProfilePage(current, { profiles: [{ id: 'new' }], total: 52, nextCursor: null }, 51), /更新/)
    assert.throws(() => parseCunningProfilePage({ profiles: [{ id: 'p' }], total: 2, nextCursor: 'p' }), /正しく/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
