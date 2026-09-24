const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const criterion = { id: 'criterion', key: 'fit', name: '適合度', weight: 1 }
const template = { id: 'template', name: '営業職', jobTitle: '営業', criteria: [criterion] }
const sessions = Array.from({ length: 121 }, (_, index) => ({
  id: `session-${String(index + 1).padStart(3, '0')}`,
  organizationId: 'own-org',
  templateId: 'template',
  status: 'evaluated',
  candidateName: `候補者${index + 1}`,
  verdict: 'hold',
  endedAt: new Date(Date.UTC(2026, 8, 25 - Math.floor(index / 24), 0, 0, index % 60)),
  overallComment: null,
  template,
  scores: [{ criterionId: 'criterion', score: index === 120 ? 5 : 2, insufficient: false }],
}))
const prisma = {
  mensetsuTemplate: { findFirst: async ({ where }) => where.id === 'template' && where.organizationId === 'own-org' ? template : null },
  mensetsuSession: { findMany: async ({ where, take, select }) => {
    assert.equal(take, undefined, 'the comparison must include every evaluated candidate')
    assert.equal(where.organizationId, 'own-org')
    assert.equal(where.status, 'evaluated')
    assert.equal(select.scores.orderBy.criterionId, 'asc')
    return sessions.filter((row) => !where.templateId || row.templateId === where.templateId)
  } },
}
const route = load('src/app/api/mensetsu/compare/route.ts', {
  'next/server': { NextResponse: Response },
  crypto: require('node:crypto'),
  '@/lib/prisma': { prisma },
  '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'own-org' }), orgSlugFrom: () => '' },
  '@/lib/mensetsu/evaluate': { weightedAverage: (scores) => scores[0]?.score ?? null },
})

;(async () => {
  await check('all 121 evaluated candidates are ranked and reachable, including the oldest top score', async () => {
    const ids = []
    let cursor = null
    let revision = null
    let pages = 0
    do {
      const url = new URL('http://offline.invalid/api/mensetsu/compare?templateId=template')
      if (cursor) {
        url.searchParams.set('cursor', cursor)
        url.searchParams.set('revision', revision)
      }
      const response = await route.GET(new Request(url))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const body = await response.json()
      assert.equal(body.total, 121)
      assert.equal(body.medians.fit, 2)
      if (revision) assert.equal(body.revision, revision)
      revision = body.revision
      ids.push(...body.candidates.map((candidate) => candidate.id))
      cursor = body.nextCursor
      pages++
    } while (cursor)
    assert.equal(pages, 3)
    assert.equal(ids.length, 121)
    assert.equal(new Set(ids).size, 121)
    assert.equal(ids[0], 'session-121')
  })
  await check('a changed evaluation invalidates a continuation before ranks can mix', async () => {
    const first = await (await route.GET(new Request('http://offline.invalid/?templateId=template'))).json()
    sessions[0].scores[0].score = 3
    const url = new URL('http://offline.invalid/?templateId=template')
    url.searchParams.set('cursor', first.nextCursor)
    url.searchParams.set('revision', first.revision)
    const response = await route.GET(new Request(url))
    sessions[0].scores[0].score = 2
    assert.equal(response.status, 409)
  })
  await check('invalid, filtered-out, and foreign cursors are rejected', async () => {
    for (const cursor of ['', 'foreign-session', 'bad!']) {
      const response = await route.GET(new Request(`http://offline.invalid/?templateId=template&cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
  })
  await check('other organizations cannot select a template', async () => {
    const response = await route.GET(new Request('http://offline.invalid/?templateId=other-template'))
    assert.equal(response.status, 404)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
