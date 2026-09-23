const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const events = []
const service = load('src/lib/interview/transcription.ts', {
  './storage': { getSignedFileUrl: async () => 'https://storage.example.test/audio.wav' },
}, {
  process: { env: { ASSEMBLYAI_API_KEY: 'test' } },
  setTimeout: callback => callback(),
  fetch: async (url, init) => {
    if (init?.method === 'POST') {
      events.push('provider-submit')
      return Response.json({ id: 'job1' })
    }
    assert.match(url, /\/transcript\/job1$/)
    events.push('provider-poll')
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
  console.log('PASS interview provider job ID is persisted before polling and resume never resubmits')
})().catch(error => { console.error(error); process.exitCode = 1 })
