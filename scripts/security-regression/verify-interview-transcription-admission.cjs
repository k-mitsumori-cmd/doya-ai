const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let providerCalls = 0
let durationCalls = 0
let processing = null
const material = { id: 'm1', projectId: 'p1', project: { id: 'p1', userId: 'u1', guestId: null },
  type: 'audio', filePath: 'private/audio.wav', fileSize: 1024n, mimeType: 'audio/wav' }
const prisma = {
  interviewMaterial: { findUnique: async () => material },
  interviewTranscription: { findFirst: async () => processing },
}
let admission = { state: 'limit', limitSeconds: 1800, usedSeconds: 1700, reservedSeconds: 0, requiredSeconds: 200 }
const shared = {
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': { getInterviewUser: async () => ({ userId: 'u1', plan: 'FREE' }),
    getGuestIdFromRequest: () => null, checkOwnership: () => null, requireDatabase: () => null },
  '@/lib/pricing': { getInterviewGuestLimits: () => ({ transcriptionMinutes: 5 }) },
  '@/lib/interview/media-duration': { inspectInterviewMediaDuration: async () => { durationCalls++; return 200 } },
  '@/lib/interview/transcription-budget': { reserveInterviewTranscription: async () => admission,
    settleInterviewTranscription: async () => { throw Error('unexpected settlement') },
    releaseInterviewTranscription: async () => { throw Error('unexpected release') } },
}
const globals = { process: { env: { INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED: '1', DATABASE_URL: 'mock', ASSEMBLYAI_API_KEY: 'mock' } },
  TextEncoder, ReadableStream, fetch: async () => { providerCalls++; throw Error('provider should not run') } }
const post = load('src/app/api/interview/materials/[id]/transcribe/route.ts', {
  ...shared,
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/interview/transcription': { transcribeFromUrl: async () => { providerCalls++; throw Error('provider should not run') } },
}, globals)
const stream = load('src/app/api/interview/materials/[id]/transcribe-stream/route.ts', {
  ...shared,
  'node:crypto': { randomUUID: () => 'uuid' },
  'next/server': {},
  '@/lib/interview/storage': { getSignedFileUrl: async () => { throw Error('storage should not run') } },
}, globals)
const context = { params: Promise.resolve({ id: 'm1' }) }

;(async () => {
  const blocked = await post.POST({ json: async () => ({}) }, context)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.body.code, 'TRANSCRIPTION_LIMIT')
  assert.equal(blocked.body.actionUrl, '/interview/pricing')

  const response = await stream.GET({}, context)
  const text = await response.text()
  assert.match(text, /event: fail/)
  assert.match(text, /TRANSCRIPTION_LIMIT/)
  assert.match(text, /interview\/pricing/)
  assert.equal(durationCalls, 2)
  assert.equal(providerCalls, 0)

  admission = { state: 'processing', transcriptionId: 't1', externalJobId: 'submitting:uuid' }
  processing = { id: 't1', externalJobId: 'submitting:uuid' }
  const duplicate = await stream.GET({}, context)
  const duplicateText = await duplicate.text()
  assert.match(duplicateText, /TRANSCRIPTION_SUBMISSION_UNKNOWN/)
  assert.equal(providerCalls, 0)
  console.log('PASS interview transcription blocks excess before provider and never resubmits an uncertain job')
})().catch(error => { console.error(error); process.exitCode = 1 })
