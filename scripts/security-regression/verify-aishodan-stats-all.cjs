const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const sessions = Array.from({ length: 701 }, (_, index) => {
  const startedAt = new Date('2026-09-25T00:00:00Z')
  const minutes = index < 500 ? 10 : 20
  return {
    id: `session-${String(index + 1).padStart(3, '0')}`,
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60000),
    currentPhase: index < 500 ? 'closing' : 'discovery',
    status: index < 500 ? 'evaluated' : 'aborted',
  }
})
let pageCalls = 0
const questions = Array.from({ length: 522 }, (_, index) => ({
  id: `question-${String(index + 1).padStart(3, '0')}`,
  sessionId: index < 500 ? `meeting-${index}` : `meeting-${Math.min(index, 520)}`,
  text: index < 500 ? `単独質問${index + 1}` : '価格は？',
  createdAt: new Date(index < 500 ? '2026-09-25T00:00:00Z' : '2026-09-01T00:00:00Z'),
}))
let questionPageCalls = 0
const prisma = {
  aishodanSession: {
    count: async ({ where }) => {
      assert.equal(where.organizationId, 'own-org')
      assert.equal(where.room.isPreview, false)
      return where.status === 'evaluated' ? 500 : where.schedulingClickedAt ? 100 : 701
    },
    findMany: async ({ where, orderBy, take, cursor, select }) => {
      assert.equal(where.organizationId, 'own-org')
      assert.equal(where.room.isPreview, false)
      assert.equal(where.startedAt.not, null)
      assert.equal(where.endedAt.not, null)
      assert.equal(take, 501)
      assert.equal(orderBy.id, 'asc')
      assert.equal(select.id, true)
      pageCalls++
      const start = cursor ? sessions.findIndex((session) => session.id === cursor.id) + 1 : 0
      return sessions.slice(start, start + take)
    },
  },
  aishodanOutcome: { groupBy: async () => [{ verdict: 'recommend', _count: { verdict: 500 } }] },
  aishodanQuestion: { findMany: async ({ where, orderBy, take, cursor }) => {
    assert.equal(where.session.organizationId, 'own-org')
    assert.equal(where.session.room.isPreview, false)
    assert.equal(where.unanswered, true)
    assert.equal(orderBy.id, 'asc')
    assert.equal(take, 501)
    questionPageCalls++
    const start = cursor ? questions.findIndex((question) => question.id === cursor.id) + 1 : 0
    return questions.slice(start, start + take)
  } },
}
const route = load('src/app/api/aishodan/stats/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/aishodan/access': { getAishodanContext: async () => ({ organizationId: 'own-org' }), orgSlugFrom: () => '' },
})

;(async () => {
  await check('duration and dropoff use all 701 real sessions, not an arbitrary 500', async () => {
    const response = await route.GET(new Request('http://offline.invalid/api/aishodan/stats'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    assert.equal(body.total, 701)
    assert.equal(body.evaluated, 500)
    assert.equal(body.avgMin, 12.9)
    assert.equal(body.dropoff.discovery, 201)
    assert.equal(body.unanswered[0].text, '価格は？')
    assert.equal(body.unanswered[0].count, 21)
    assert.equal(body.unanswered.length, 12)
    assert.equal(pageCalls, 2)
    assert.equal(questionPageCalls, 2)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
