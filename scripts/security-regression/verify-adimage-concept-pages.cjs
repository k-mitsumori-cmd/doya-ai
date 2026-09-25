const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const records = Array.from({ length: 51 }, (_, index) => ({
  id: `concept-${String(51 - index).padStart(3, '0')}`,
  ownerId: 'owner',
  label: '広告',
  copy: {},
  generation: 1,
  createdAt: new Date('2026-09-25T00:00:00Z'),
  campaign: { name: 'campaign', brand: { name: 'brand' } },
  creatives: [],
}))
const prisma = { adImageConcept: {
  findFirst: async ({ where }) => records.find((row) => row.id === where.id && row.ownerId === where.campaign.userId) || null,
  findMany: async ({ where, orderBy, take, cursor }) => {
    assert.equal(where.campaign.userId, 'owner')
    assert.equal(take, 21)
    assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
    const start = cursor ? records.findIndex((row) => row.id === cursor.id) + 1 : 0
    return records.slice(start, start + take)
  },
  count: async ({ where }) => {
    assert.equal(where.campaign.userId, 'owner')
    return records.length
  },
} }
const route = load('src/app/api/adimage/concepts/route.ts', {
  'next/server': { NextResponse: Response },
  sharp: {},
  '@/lib/prisma': { prisma },
  '@/lib/adimage/image-budget': {},
  '@/lib/adimage/access': {
    getIdentity: async () => ({ userId: 'owner' }),
    requireUser: () => ({ ok: true }),
    ownerWhere: () => ({ userId: 'owner' }),
  },
  '@/lib/adimage/placements': {},
  '@/lib/service-usage': {},
  '@/lib/adimage/ref-palette': {},
  '@/lib/adimage/generate': {},
  '@/lib/adimage/logo': {},
  '@/lib/adimage/copy': {},
  '@seo/lib/gemini': {},
  '@/lib/adimage/storage': {},
})

;(async () => {
  await check('all 51 ad image concepts remain reachable in owner-scoped pages', async () => {
    const seen = []
    let cursor = null
    do {
      const url = new URL('http://offline.invalid/api/adimage/concepts')
      if (cursor) url.searchParams.set('cursor', cursor)
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const page = await response.json()
      assert.equal(page.total, 51)
      seen.push(...page.concepts.map((row) => row.id))
      cursor = page.nextCursor
    } while (cursor)
    assert.equal(seen.length, 51)
    assert.equal(new Set(seen).size, 51)
    assert.equal(seen.at(-1), 'concept-001')
  })
  await check('foreign and malformed cursors cannot read other owners', async () => {
    for (const cursor of ['', 'other-owner', 'bad!']) {
      const response = await route.GET(new Request(`http://offline.invalid/?cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
