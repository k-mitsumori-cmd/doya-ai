const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const cursors = load('src/lib/aio/scan-cursor.ts')
const createdAt = new Date('2026-09-20T12:00:00.000Z')
const rows = Array.from({ length: 121 }, (_, i) => ({
  id: `scan-${String(121 - i).padStart(3, '0')}`, organizationId: 'org-main',
  status: i === 15 ? 'deleted' : 'done', createdAt: new Date(createdAt.getTime() - Math.floor(i / 3) * 1000), updatedAt: createdAt,
})).concat([{ id: 'foreign', organizationId: 'org-other', status: 'done', createdAt, updatedAt: createdAt }])
let databaseCalls = 0
const prisma = { aioScan: { findMany: async ({ where, orderBy, take }) => {
  databaseCalls++
  assert.equal(take, 61)
  assert.equal(JSON.stringify(orderBy), JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]))
  return rows.filter(row => row.organizationId === where.organizationId && row.status !== 'deleted')
    .filter(row => !where.OR || row.createdAt < where.OR[0].createdAt.lt || row.createdAt.getTime() === where.OR[1].createdAt.getTime() && row.id < where.OR[1].id.lt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(0, take)
} } }
const route = load('src/app/api/aio/scans/route.ts', {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
  '@/lib/aio/access': { getAioContext: async slug => ({ organizationId: slug === 'other' ? 'org-other' : 'org-main' }), orgSlugFrom: req => req.nextUrl.searchParams.get('org') },
  '@/lib/aio/types': { effectiveScanStatus: status => status },
  '@/lib/aio/run': {}, '@/lib/service-usage': {}, '@/lib/aio/scan-cursor': cursors,
})
const get = (org = 'main', cursor) => {
  const url = new URL(`https://local.test/api/aio/scans?org=${org}`)
  if (cursor !== undefined) url.searchParams.set('cursor', cursor)
  return route.GET({ nextUrl: url, url: url.href })
}

;(async () => {
  const seen = []
  let cursor
  for (let page = 0; page < 3; page++) {
    const response = await get('main', cursor)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    seen.push(...body.items.map(row => row.id))
    cursor = body.nextCursor
    assert.equal(body.items.length, page < 2 ? 60 : 0)
    if (!cursor) break
  }
  assert.equal(seen.length, 120)
  assert.equal(new Set(seen).size, 120)
  assert.equal(cursor, null)
  console.log('PASS all 120 retained scans remain reachable across stable cursor pages')

  const other = await get('other')
  assert.deepEqual((await other.json()).items.map(row => row.id), ['foreign'])
  const first = await (await get()).json()
  for (const invalid of ['bad!', '', first.nextCursor]) {
    const before = databaseCalls
    const response = await get(invalid === first.nextCursor ? 'other' : 'main', invalid)
    assert.equal(response.status, 400)
    assert.equal(databaseCalls, before)
  }
  console.log('PASS foreign and malformed scan cursors are rejected before database access')
})().catch(error => { console.error(error); process.exitCode = 1 })
