const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

class TerminalError extends Error {}
const material = { id: 'm1', projectId: 'p1', project: { id: 'p1', userId: 'u1', guestId: null },
  type: 'audio', filePath: 'private/audio.wav', fileSize: 1024n, mimeType: 'audio/wav' }
let externalJobId = null
let status = 'PROCESSING'
let admission = { state: 'started', transcriptionId: 't1' }
let submitCalls = 0, resumeCalls = 0, settled = 0, released = 0
let behavior = 'timeout'
let claimBlocked = false
const result = { text: 'transcribed', segments: [{ start: 0, end: 200, text: 'transcribed' }],
  summary: null, provider: 'assemblyai', confidence: 0.9 }
const db = {
  interviewMaterial: {
    findUnique: async () => material,
    update: async () => ({}),
    updateMany: async () => ({ count: 1 }),
  },
  interviewProject: { update: async () => ({}) },
  interviewTranscription: {
    findFirst: async () => null,
    findUnique: async () => ({ status, externalJobId }),
    updateMany: async ({ where, data }) => {
      if (claimBlocked && where.externalJobId === null) return { count: 0 }
      if (where.externalJobId !== undefined && where.externalJobId !== externalJobId) return { count: 0 }
      if (where.status !== undefined && where.status !== status) return { count: 0 }
      if (data.externalJobId !== undefined) externalJobId = data.externalJobId
      if (data.status !== undefined) status = data.status
      return { count: 1 }
    },
    update: async ({ data }) => { if (data.status) status = data.status; return {} },
  },
  $transaction: async fn => fn(db),
}
const { POST } = load('src/app/api/interview/materials/[id]/transcribe/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  'node:crypto': { randomUUID: () => 'uuid' },
  '@/lib/prisma': { prisma: db },
  '@/lib/interview/access': { getInterviewUser: async () => ({ userId: 'u1', plan: 'FREE' }),
    getGuestIdFromRequest: () => null, checkOwnership: () => null, requireDatabase: () => null },
  '@/lib/interview/transcription': {
    InterviewTranscriptionTerminalError: TerminalError,
    transcribeFromUrl: async opts => {
      submitCalls++
      assert.equal(opts.maxWaitMs, 210000)
      opts.onBeforeSubmit?.()
      if (behavior === 'unknown') throw Error('network lost')
      await opts.onJobSubmitted?.('job1')
      if (behavior === 'timeout') throw Error('poll timeout')
      return result
    },
    transcribeExistingJob: async (id, maxWaitMs) => {
      resumeCalls++
      assert.equal(id, 'job1')
      assert.equal(maxWaitMs, 210000)
      if (behavior === 'terminal') throw new TerminalError('private audio URL https://storage.example.test/private.wav')
      return result
    },
  },
  '@/lib/pricing': { getInterviewGuestLimits: () => ({ transcriptionMinutes: 5 }) },
  '@/lib/interview/media-duration': { inspectInterviewMediaDuration: async () => 200 },
  '@/lib/interview/transcription-budget': {
    reserveInterviewTranscription: async () => admission,
    settleInterviewTranscription: async () => { settled++ },
    releaseInterviewTranscription: async () => { released++ },
  },
}, { process: { env: { INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED: '1' } } })
const request = { json: async () => ({}) }
const context = { params: Promise.resolve({ id: 'm1' }) }

;(async () => {
  const interrupted = await POST(request, context)
  assert.equal(interrupted.body.status, 'PROCESSING')
  assert.equal(externalJobId, 'job1')
  assert.equal(submitCalls, 1)
  assert.equal(released, 0)
  assert.equal(settled, 0)

  admission = { state: 'processing', transcriptionId: 't1', externalJobId: 'job1' }
  behavior = 'complete'
  const resumed = await POST(request, context)
  assert.equal(resumed.body.status, 'COMPLETED')
  assert.equal(submitCalls, 1)
  assert.equal(resumeCalls, 1)
  assert.equal(settled, 1)
  assert.equal(released, 0)

  status = 'PROCESSING'
  externalJobId = null
  admission = { state: 'started', transcriptionId: 't2' }
  behavior = 'unknown'
  const unknown = await POST(request, context)
  assert.equal(unknown.status, 503)
  assert.equal(unknown.body.code, 'TRANSCRIPTION_SUBMISSION_UNKNOWN')
  assert.equal(released, 0)

  externalJobId = null
  admission = { state: 'started', transcriptionId: 't3' }
  claimBlocked = true
  const duplicateStart = await POST(request, context)
  assert.equal(duplicateStart.body.status, 'PROCESSING')
  assert.equal(submitCalls, 2)
  claimBlocked = false

  externalJobId = 'job1'
  admission = { state: 'processing', transcriptionId: 't2', externalJobId: 'job1' }
  behavior = 'terminal'
  const terminal = await POST(request, context)
  assert.equal(terminal.status, 500)
  assert.doesNotMatch(JSON.stringify(terminal.body), /private\.wav/)
  assert.equal(released, 1)
  assert.equal(status, 'ERROR')
  console.log('PASS interview transcription stores provider ID, resumes without resubmission, holds uncertain work, releases terminal failure')
})().catch(error => { console.error(error); process.exitCode = 1 })
