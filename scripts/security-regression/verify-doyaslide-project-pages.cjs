const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const projects = Array.from({ length: 75 }, (_, index) => ({
  id: `slide-project-${String(74 - index).padStart(3, '0')}`,
  title: `Project ${index}`,
  status: 'completed', docType: 'proposal', aspectRatio: 'wide',
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  slides: [{ imageUrl: `https://example.invalid/slide-${index}.png` }],
  _count: { slides: 12 },
}))
let reads = 0
const api = load('src/app/api/doyaslide/projects/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { doyaSlideProject: {
    findFirst: async ({ where }) => projects.find((project) => project.id === where.id && where.userId === 'owner'),
    findMany: async (query) => {
      reads++
      assert.equal(query.where.userId, 'owner')
      assert(query.take <= 31)
      assert.equal(query.select.slides.take, 1)
      assert.equal(query.select._count.select.slides.where.imageUrl.not, null)
      assert.equal(JSON.stringify(query.orderBy), JSON.stringify([{ updatedAt: 'desc' }, { id: 'desc' }]))
      const offset = query.cursor ? projects.findIndex((project) => project.id === query.cursor.id) + 1 : 0
      return projects.slice(offset, offset + query.take)
    },
    count: async ({ where }) => { assert.equal(where.userId, 'owner'); return projects.length },
  } } },
  '@/lib/doyaslide/access': { getUserId: async () => 'owner' },
  '@/lib/doyaslide/limits': {},
  '@/lib/doyaslide/constants': {},
  '@/lib/doyaslide/errors': {},
})
const req = (query) => ({ nextUrl: new URL(`https://doya.test/api/doyaslide/projects?${query}`) })

;(async () => {
  await check('DoyaSlide list pages summaries and reads only one cover per project', async () => {
    const seen = []
    let cursor = null
    for (let page = 0; page < 3; page++) {
      const response = await api.GET(req(`limit=30${cursor ? `&cursor=${cursor}` : ''}`))
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.total, 75)
      assert(body.projects.length <= 30)
      for (const project of body.projects) {
        assert.equal(project.generatedSlides, 12)
        assert(project.coverUrl.startsWith('https://example.invalid/'))
        assert.equal(project.slides, undefined)
        seen.push(project.id)
      }
      cursor = body.nextCursor
    }
    assert.deepEqual(seen, projects.map((project) => project.id))
    assert.equal(cursor, null)
    assert.equal(reads, 3)
  })
  await check('DoyaSlide list without a limit remains bounded', async () => {
    const response = await api.GET(req(''))
    const body = await response.json()
    assert.equal(body.projects.length, 30)
    assert.equal(body.total, 75)
    assert(body.nextCursor)
  })
  for (const query of ['limit=0', 'limit=31', 'limit=abc', 'limit=1.5', 'limit=30&cursor=foreign']) {
    await check(`DoyaSlide list rejects ${query} before page reads`, async () => {
      const before = reads
      const response = await api.GET(req(query))
      assert.equal(response.status, 400)
      assert.equal(reads, before)
    })
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
