const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load } = require('./load-typescript.cjs')

const rows = new Map(), transcripts = [], materials = new Map([['m1', 'COMPLETED'], ['m2', 'COMPLETED'], ['m3', 'COMPLETED']])
let sequence = 0, baselineCalls = 0, baselineDuration = 0
const systemSetting = {
  findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
  upsert: async ({ where, create, update }) => { rows.set(where.key, rows.has(where.key) ? update.value : create.value) },
  create: async ({ data }) => { if (rows.has(data.key)) throw Error('duplicate'); rows.set(data.key, data.value) },
  update: async ({ where, data }) => { if (!rows.has(where.key)) throw Error('missing'); rows.set(where.key, data.value) },
  delete: async ({ where }) => { if (!rows.has(where.key)) throw Error('missing'); rows.delete(where.key) },
}
const tx = {
  $executeRaw: async () => 1, systemSetting,
  interviewTranscription: {
    findFirst: async ({ where }) => transcripts.find(x => x.materialId === where.materialId && x.status === where.status) || null,
    create: async ({ data }) => { const row = { ...data, id: `t${++sequence}` }; transcripts.push(row); return row },
  },
  interviewMaterial: {
    aggregate: async () => { baselineCalls++; return { _sum: { duration: baselineDuration } } },
    updateMany: async ({ where, data }) => { const current = materials.get(where.id); if (!where.status.in.includes(current)) return { count: 0 }; materials.set(where.id, data.status); return { count: 1 } },
  },
}
const prisma = { $transaction: async callback => callback(tx), systemSetting, interviewMaterial: tx.interviewMaterial }
const month = load('src/lib/interview/month.ts')
const budget = load('src/lib/interview/transcription-budget.ts', {
  'node:crypto': require('node:crypto'),
  '@/lib/prisma': { prisma },
  '@/lib/pricing': { INTERVIEW_PRICING: { maxSingleTranscriptionMinutes: 180 }, getInterviewLimitsByPlan: () => ({ transcriptionMinutes: 30 }), getInterviewGuestLimits: () => ({ transcriptionMinutes: 5 }) },
  './month': month,
}, { process: { env: { INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED: '1' } } })
const source = fs.readFileSync(path.join(__dirname, '../../src/lib/interview/transcription-budget.ts'), 'utf8')
assert.match(source, /pg_advisory_xact_lock\(hashtext\('interview-transcription'\), hashtext\(\$\{config\.quotaKey\}\)\)/)
const identity = { userId: 'owner', guestId: null, plan: 'FREE' }
const at = new Date('2026-09-24T00:00:00.000Z')

;(async () => {
  assert.equal((await budget.reserveInterviewTranscription(identity, { id: 'm1', projectId: 'p1' }, 1201, at)).state, 'started')
  assert.equal((await budget.reserveInterviewTranscription(identity, { id: 'm1', projectId: 'p1' }, 1201, at)).state, 'processing')
  const blocked = await budget.reserveInterviewTranscription(identity, { id: 'm2', projectId: 'p1' }, 600, at)
  assert.equal(blocked.state, 'limit')
  assert.equal(blocked.usedSeconds, 0)
  assert.equal(blocked.reservedSeconds, 1201)
  assert.equal((await budget.getInterviewTranscriptionUsage(identity, at)).reservedSeconds, 1201)
  assert.equal(await budget.settleInterviewTranscription(tx, 'm1', 't1'), 1201)
  assert.deepEqual(JSON.parse(JSON.stringify(await budget.getInterviewTranscriptionUsage(identity, at))), { usedSeconds: 1201, reservedSeconds: 0, limitSeconds: 1800 })
  assert.equal((await budget.reserveInterviewTranscription(identity, { id: 'm2', projectId: 'p1' }, 599, at)).state, 'started')
  await budget.releaseInterviewTranscription(tx, 'm2', 't2')
  assert.deepEqual(JSON.parse(JSON.stringify(await budget.getInterviewTranscriptionUsage(identity, at))), { usedSeconds: 1201, reservedSeconds: 0, limitSeconds: 1800 })
  assert.equal((await budget.reserveInterviewTranscription(identity, { id: 'm3', projectId: 'p1' }, 10801, at)).state, 'too-long')
  assert.equal(baselineCalls, 1)
  baselineDuration = 240
  const secondOwner = { userId: 'other-owner', guestId: null, plan: 'FREE' }
  await budget.preserveInterviewTranscriptionUsageBeforeDelete(tx, secondOwner, at)
  baselineDuration = 0 // Source rows were deleted after the ledger was persisted.
  assert.equal((await budget.getInterviewTranscriptionUsage(secondOwner, at)).usedSeconds, 240)
  assert.equal(baselineCalls, 2)
  const nextMonth = await budget.getInterviewTranscriptionUsage(identity, new Date('2026-09-30T15:00:00.000Z'))
  assert.equal(nextMonth.usedSeconds, 0)
  console.log('PASS interview transcription reserves verified seconds, blocks excess, settles once and refunds failed work')
})().catch(error => { console.error(error); process.exitCode = 1 })
