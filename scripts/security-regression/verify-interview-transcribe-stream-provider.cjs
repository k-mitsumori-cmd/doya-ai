// Offline SSE provider regression: bounded AssemblyAI bodies and visible recovery.
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture(mode) {
  const calls = []
  const writes = []
  const material = { id: 'material', type: 'audio', filePath: 'private/audio.wav', fileUrl: 'confirmed', fileSize: 1024n,
    mimeType: 'audio/wav', fileName: 'sample.wav', project: { id: 'project', userId: 'owner', guestId: null } }
  const prisma = {
    interviewMaterial: {
      findUnique: async () => material,
      update: async () => {},
      updateMany: async value => { writes.push(value); return { count: 1 } },
    },
    interviewTranscription: {
      findFirst: async () => null,
      create: async () => ({ id: 'transcription' }),
      update: async value => { writes.push(value); return {} },
      updateMany: async value => { writes.push(value); return { count: 1 } },
      deleteMany: async () => {},
    },
    interviewProject: { update: async value => { writes.push(value); return {} } },
  }
  prisma.$transaction = async fn => fn(prisma)
  const transcription = load('src/lib/interview/transcription.ts', { './storage': { getSignedFileUrl: async () => 'https://storage.invalid/audio' } })
  const stream = load('src/app/api/interview/materials/[id]/transcribe-stream/route.ts', {
    'next/server': {},
    'node:crypto': { randomUUID: () => 'uuid' },
    '@/lib/prisma': { prisma },
    '@/lib/interview/access': { getInterviewUser: async () => ({ userId: 'owner', plan: 'FREE' }), getGuestIdFromRequest: () => null, checkOwnership: () => null },
    '@/lib/interview/storage': { getSignedFileUrl: async () => 'https://storage.invalid/audio' },
    '@/lib/pricing': { getInterviewGuestLimits: () => ({ transcriptionMinutes: 5 }), SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
    '@/lib/interview/media-duration': { inspectInterviewMediaDuration: async () => 60 },
    '@/lib/interview/transcription-budget': {},
    '@/lib/interview/transcription': transcription,
  }, {
    process: { env: { DATABASE_URL: 'synthetic', ASSEMBLYAI_API_KEY: 'synthetic' } },
    TextEncoder, ReadableStream, AbortSignal,
    setTimeout: callback => { callback(); return 0 },
    fetch: async (_url, options) => {
      calls.push(options)
      assert.ok(options.signal)
      if (options.method === 'POST') {
        if (mode === 'submit-oversize') return new Response('x', { headers: { 'content-length': String(64 * 1024 + 1) } })
        if (mode === 'submit-error') return new Response('PRIVATE_PROVIDER_DETAIL', { status: 503 })
        return Response.json({ id: 'job-id' })
      }
      if (mode === 'poll-oversize') return new Response('x', { headers: { 'content-length': String(32 * 1024 * 1024 + 1) } })
      if (mode === 'poll-error') return Response.json({ status: 'error', error: 'PRIVATE_PROVIDER_DETAIL' })
      return Response.json({ status: 'completed', text: '文字起こし結果', utterances: [{ start: 0, end: 1000, text: '文字起こし結果' }] })
    },
  })
  return { calls, writes, run: async () => (await stream.GET({}, { params: Promise.resolve({ id: 'material' }) })).text() }
}

;(async () => {
  await check('Interview stream keeps submit and poll deadlines through JSON reads', async () => {
    const f = fixture('success')
    const result = await f.run()
    assert.match(result, /event: complete/)
    assert.equal(f.calls.length, 2)
    assert.equal(f.calls[0].signal.aborted, false)
    assert.equal(f.calls[1].signal.aborted, false)
  })
  for (const mode of ['submit-oversize', 'submit-error', 'poll-oversize', 'poll-error']) {
    await check(`Interview stream handles ${mode} without exposing provider data`, async () => {
      const f = fixture(mode)
      const result = await f.run()
      assert.match(result, /event: fail/)
      assert.equal(result.includes('PRIVATE_PROVIDER_DETAIL'), false)
      assert.equal(result.includes('xxxxx'), false)
      assert.equal(f.calls.length, mode.startsWith('submit') ? 1 : 2)
    })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
