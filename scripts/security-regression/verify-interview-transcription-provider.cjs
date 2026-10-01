const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const events = []
let providerResponseMode = 'normal'
const service = load('src/lib/interview/transcription.ts', {
  './storage': { getSignedFileUrl: async () => 'https://storage.example.test/audio.wav' },
}, {
  process: { env: { ASSEMBLYAI_API_KEY: 'test' } },
  AbortSignal,
  setTimeout: callback => callback(),
  fetch: async (url, init) => {
    assert.ok(init?.signal, 'provider request and body must have a deadline')
    if (init?.method === 'POST') {
      events.push('provider-submit')
      if (providerResponseMode === 'submit-oversized') {
        return new Response('x', { headers: { 'Content-Length': String(64 * 1024 + 1) } })
      }
      if (providerResponseMode === 'invalid-id') return Response.json({ id: 'bad/id' })
      return Response.json({ id: 'job1' })
    }
    assert.match(url, /\/transcript\/job1$/)
    events.push('provider-poll')
    if (providerResponseMode === 'poll-oversized') {
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); controller.close() },
      }))
    }
    if (providerResponseMode === 'poll-error') {
      return Response.json({ status: 'error', error: 'private provider detail' })
    }
    return Response.json({ status: 'completed', text: 'hello', words: [], utterances: [] })
  },
})

;(async () => {
  const first = await service.transcribeFromUrl({ storagePath: 'p/audio.wav', mimeType: 'audio/wav', fileSize: 1024,
    onBeforeSubmit: () => events.push('before-submit'),
    onJobSubmitted: async id => { assert.equal(id, 'job1'); events.push('job-id-persisted') },
  })
  assert.equal(first.text, 'hello')
  assert.deepEqual(events, ['before-submit', 'provider-submit', 'job-id-persisted', 'provider-poll'])
  events.length = 0
  const resumed = await service.transcribeExistingJob('job1')
  assert.equal(resumed.text, 'hello')
  assert.deepEqual(events, ['provider-poll'])
  events.length = 0
  providerResponseMode = 'submit-oversized'
  await assert.rejects(service.transcribeFromUrl({ storagePath: 'p/audio.wav', mimeType: 'audio/wav', fileSize: 1024,
    onBeforeSubmit: () => events.push('before-submit'),
    onJobSubmitted: async () => events.push('job-id-persisted'),
  }), /大きすぎます/)
  assert.deepEqual(events, ['before-submit', 'provider-submit'])

  events.length = 0
  providerResponseMode = 'invalid-id'
  await assert.rejects(service.transcribeFromUrl({ storagePath: 'p/audio.wav', mimeType: 'audio/wav', fileSize: 1024,
    onBeforeSubmit: () => events.push('before-submit'),
    onJobSubmitted: async () => events.push('job-id-persisted'),
  }), /トランスクリプトID/)
  assert.deepEqual(events, ['before-submit', 'provider-submit'])

  events.length = 0
  providerResponseMode = 'poll-oversized'
  await assert.rejects(service.transcribeExistingJob('job1'), /大きすぎます/)
  assert.deepEqual(events, ['provider-poll'])

  events.length = 0
  providerResponseMode = 'poll-error'
  await assert.rejects(service.transcribeExistingJob('job1'), error =>
    error instanceof service.InterviewTranscriptionTerminalError && !error.message.includes('private provider detail'))
  assert.deepEqual(events, ['provider-poll'])
  console.log('PASS interview provider persists job IDs, bounds requests and bodies, resumes without resubmission')
})().catch(error => { console.error(error); process.exitCode = 1 })
