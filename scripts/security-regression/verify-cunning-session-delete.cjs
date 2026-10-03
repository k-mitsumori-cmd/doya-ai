const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let actor = 'owner'
let calls = []
let windowsRemain = true
let answersRemain = true
const tx = {
  cunningAudioWindow: { deleteMany: async ({ where }) => {
    assert.equal(where.sessionId, 'session')
    calls.push('windows')
    windowsRemain = false
  } },
  cunningAnswer: { deleteMany: async ({ where }) => {
    assert.equal(where.sessionId, 'session')
    calls.push('answers')
    answersRemain = false
  } },
  cunningTranscript: { deleteMany: async ({ where }) => {
    assert.equal(where.sessionId, 'session')
    assert.equal(windowsRemain, false, 'linked audio windows restrict transcript deletion')
    assert.equal(answersRemain, false, 'final answers must be removed first')
    calls.push('transcripts')
  } },
  cunningSession: { update: async ({ where, data }) => {
    assert.equal(where.id, 'session')
    assert.equal(data.status, 'deleted')
    calls.push('session')
  } },
}
const prisma = { cunningSession: { findUnique: async () => ({ id: 'session', userId: 'owner', status: 'active' }) } }
const api = load('src/app/api/cunning/sessions/[id]/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@prisma/client': { Prisma: { DbNull: null } },
  '@/lib/cunning/history-read': {},
  '@/lib/cunning/history-cursor': {},
  '@/lib/cunning/report-freshness': {},
  '@/lib/cunning/session-write': { writeCunningSession: async (_, __, write) => { await write(tx); return true } },
  '@/lib/prisma': { prisma },
  '@/lib/cunning/access': { getUserId: async () => actor },
  '@/lib/cunning/modes': { MODE_IDS: ['sales'] },
})
const request = new Request('https://example.test/api/cunning/sessions/session', { method: 'DELETE' })
const context = { params: Promise.resolve({ id: 'session' }) }

;(async () => {
  actor = null
  assert.equal((await api.DELETE(request, context)).status, 401)
  assert.deepEqual(calls, [])
  actor = 'other-user'
  assert.equal((await api.DELETE(request, context)).status, 404)
  assert.deepEqual(calls, [])
  actor = 'owner'
  assert.equal((await api.DELETE(request, context)).status, 200)
  assert.deepEqual(calls, ['windows', 'answers', 'transcripts', 'session'])
  console.log('PASS owned session deletion removes dependent audio windows and final answers before transcripts')
})().catch(error => { console.error(error); process.exitCode = 1 })
