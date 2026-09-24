const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

async function scenario({ nowMs, status = 'ended', owner = 'u', hasContent = true, acceptIncomplete = false, missingAudio = true, claimedAt = null, settleExpired = false }) {
  let providerCalls = 0
  let usageReads = 0
  let current = {
    id: 's', userId: owner, status, recordingVersion: 2, updatedAt: new Date(1000),
    mode: 'sales', personaNote: null, report: null,
    transcripts: hasContent ? [{ text: '保存済み', speaker: 'remote', createdAt: new Date(2000), audioReceivedAt: null, audioWindow: { sequence: 0 } }] : [],
    answers: [],
    audioWindows: missingAudio ? [{ speaker: 'remote', sequence: 1, transcriptId: null, transcript: null, claimedAt }] : [],
  }
  const lease = { userId: owner, stoppedAt: settleExpired ? null : new Date(10000), expiresAt: new Date(70000) }
  const model = {
    findUnique: async () => current,
    update: async ({ data }) => { current = { ...current, ...data }; return current },
    updateMany: async ({ where, data }) => {
      if (where.updatedAt.getTime() !== current.updatedAt.getTime()) return { count: 0 }
      current = { ...current, ...data }
      return { count: 1 }
    },
  }
  const tx = {
    $queryRaw: async (parts) => parts.join('').includes('clock_timestamp') ? [{ now: new Date(nowMs) }] : [{ id: 'u' }],
    cunningSession: model,
    cunningRecordingLease: { findUnique: async () => lease },
  }
  const api = load('src/app/api/cunning/sessions/[id]/report/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } },
    '@/lib/prisma': { prisma: { $transaction: async (fn) => fn(tx), cunningSession: model } },
    '@/lib/cunning/access': { getUserId: async () => 'u' },
    '@/lib/cunning/report-freshness': { cunningReportFingerprint: async () => 'fingerprint', cunningReportStatus: () => 'current' },
    '@/lib/cunning/session-write': { nextCunningRevision: (date) => new Date(date.getTime() + 1) },
    '@/lib/cunning/report': { generateReport: async () => { providerCalls++; return { title: '議事録' } } },
    '@/lib/cunning/recording-ledger': { readCunningRecordingUsage: async () => {
      usageReads++
      if (settleExpired && nowMs > lease.expiresAt.getTime()) {
        current = { ...current, status: 'ended' }
        lease.stoppedAt = lease.expiresAt
      }
    } },
  })
  const response = await api.POST({ json: async () => ({ acceptIncomplete }) }, { params: Promise.resolve({ id: 's' }) })
  return { status: response.status, body: await response.json(), providerCalls, usageReads, current }
}

;(async () => {
  await check('pending audio cannot be silently omitted', async () => {
    const result = await scenario({ nowMs: 10000 + 15 * 60000 + 1 })
    assert.equal(result.status, 409)
    assert.equal(result.body.canGeneratePartial, true)
    assert.equal(result.providerCalls, 0)
  })
  await check('explicit partial generation excludes missing audio and marks report', async () => {
    const result = await scenario({ nowMs: 10000 + 15 * 60000 + 1, acceptIncomplete: true })
    assert.equal(result.status, 200)
    assert.equal(result.providerCalls, 1)
    assert.equal(result.usageReads, 0)
    assert.equal(result.body.report.incompleteInput, true)
    assert.equal(result.body.report.sourceCoverage.transcripts, 1)
  })
  await check('expired active lease is settled before offering partial recovery', async () => {
    const result = await scenario({ nowMs: 70000 + 15 * 60000 + 1, status: 'active', settleExpired: true })
    assert.equal(result.status, 409)
    assert.equal(result.body.canGeneratePartial, true)
    assert.equal(result.usageReads, 1)
    assert.equal(result.providerCalls, 0)
  })
  await check('expired active lease may be explicitly recovered', async () => {
    const result = await scenario({ nowMs: 70000 + 15 * 60000 + 1, status: 'active', settleExpired: true, acceptIncomplete: true })
    assert.equal(result.status, 200)
    assert.equal(result.body.report.incompleteInput, true)
  })
  for (const [name, input, expected] of [
    ['before recovery deadline', { nowMs: 10000 + 15 * 60000, acceptIncomplete: true }, 409],
    ['active recording', { nowMs: 10000 + 15 * 60000 + 1, status: 'active', acceptIncomplete: true }, 409],
    ['provider still processing', { nowMs: 10000 + 15 * 60000 + 1, claimedAt: new Date(10000 + 14 * 60000), acceptIncomplete: true }, 409],
    ['no saved content', { nowMs: 10000 + 15 * 60000 + 1, hasContent: false, acceptIncomplete: true }, 409],
    ['foreign session', { nowMs: 10000 + 15 * 60000 + 1, owner: 'other', acceptIncomplete: true }, 404],
  ]) await check(name, async () => {
    const result = await scenario(input)
    assert.equal(result.status, expected)
    assert.equal(result.providerCalls, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
