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
  '@/lib/cunning/recording-ledger': { stopCunningRecordingForDeletion: async (_, id) => { assert.equal(id, 'session'); calls.push('stop-recording') } },
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
  assert.deepEqual(calls, ['stop-recording', 'windows', 'answers', 'transcripts', 'session'])
  console.log('PASS owned session deletion removes dependent audio windows and final answers before transcripts')

  const interval = load('src/lib/cunning/usage-interval.ts')
  const ledger = load('src/lib/cunning/recording-ledger.ts', {
    crypto: { randomUUID: () => 'unused' },
    '@/lib/plan-utils': {},
    './limit-config': {},
    './usage-interval': interval,
    './legacy-usage': {},
  })
  let activeLease = {
    sessionId: 'session', settledThrough: new Date('2026-10-04T00:00:00.000Z'),
    expiresAt: new Date('2026-10-04T00:01:00.000Z'), stoppedAt: null,
  }
  let usedMs = 0n, reservedMs = 60000n, durationSec = 0
  const operations = []
  const ledgerTx = {
    $queryRaw: async () => [{ now: new Date('2026-10-04T00:00:11.000Z') }],
    cunningRecordingLease: {
      findUnique: async () => activeLease,
      update: async ({ data }) => { operations.push(data.stoppedAt ? 'stop-lease' : 'settle-lease'); activeLease = { ...activeLease, ...data } },
    },
    cunningUsageAllocation: {
      update: async ({ data }) => { operations.push('settle'); usedMs += data.usedMs.increment; reservedMs += data.reservedMs.decrement },
      updateMany: async ({ data }) => { operations.push('release'); reservedMs = data.reservedMs },
      aggregate: async () => ({ _sum: { usedMs } }),
    },
    cunningSession: { update: async ({ data }) => { durationSec = data.durationSec } },
  }
  await ledger.stopCunningRecordingForDeletion(ledgerTx, 'session')
  assert.equal(usedMs, 11000n)
  assert.equal(reservedMs, 0n)
  assert.equal(durationSec, 11)
  assert.equal(activeLease.stoppedAt.toISOString(), '2026-10-04T00:00:11.000Z')
  assert.deepEqual(operations, ['settle', 'settle-lease', 'release', 'stop-lease'])
  await ledger.stopCunningRecordingForDeletion(ledgerTx, 'session')
  assert.deepEqual(operations, ['settle', 'settle-lease', 'release', 'stop-lease'])
  activeLease = null
  await ledger.stopCunningRecordingForDeletion(ledgerTx, 'session')
  assert.deepEqual(operations, ['settle', 'settle-lease', 'release', 'stop-lease'])
  console.log('PASS deletion settles only elapsed recording time and releases the unused reservation')
})().catch(error => { console.error(error); process.exitCode = 1 })
