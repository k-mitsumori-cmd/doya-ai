const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, check } = require('./load-typescript.cjs')

const rows = Array.from({ length: 61 }, (_, index) => ({
  id: `shared-${String(60 - index).padStart(3, '0')}`,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  metadata: { shared: true },
  user: { name: 'Example', image: null },
}))
let listReads = 0
const api = load('src/app/api/banner/gallery/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { generation: {
    findFirst: async ({ where }) => rows.find((item) => item.id === where.id && where.serviceId === 'banner' && where.metadata.equals === true) || null,
    findMany: async (query) => {
      listReads++
      assert.equal(query.where.serviceId, 'banner')
      assert.equal(query.where.metadata.equals, true)
      assert(query.take <= 61)
      assert.equal(query.select.output, undefined)
      const start = query.cursor ? rows.findIndex((item) => item.id === query.cursor.id) + 1 : 0
      return rows.slice(start, start + query.take)
    },
  } } },
})
const req = (query) => ({ url: `https://doya.test/api/banner/gallery?${query}` })

;(async () => {
  await check('Banner gallery bounds and paginates public results', async () => {
    const ids = []
    let cursor = null
    do {
      const response = await api.GET(req(`take=24${cursor ? `&cursor=${cursor}` : ''}`))
      assert.equal(response.status, 200)
      const body = await response.json()
      assert(body.items.length <= 24)
      ids.push(...body.items.map((item) => item.id))
      cursor = body.nextCursor
    } while (cursor)
    assert.deepEqual(ids, rows.map((item) => item.id))
    assert.equal(listReads, 3)
  })
  for (const query of ['take=0', 'take=61', 'take=1.5', 'take=NaN', 'take=', 'cursor=', 'cursor=%20', 'cursor=foreign']) {
    await check(`Banner gallery rejects invalid ${query} before list read`, async () => {
      const before = listReads
      const response = await api.GET(req(query))
      assert.equal(response.status, 400)
      assert.equal(listReads, before)
    })
  }
  await check('Banner gallery failures do not log raw exceptions', async () => {
    const source = fs.readFileSync('src/app/api/banner/gallery/route.ts', 'utf8')
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:e|err|error)\b/.test(source))
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
