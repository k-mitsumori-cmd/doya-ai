const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(mode, state = 'started') {
  const calls = { provider: 0, settle: 0, finish: 0, recover: 0 }
  let phase = 'pending'
  const worker = load('src/lib/doyaslide/generation-worker.ts', {
    './generation-operation': {
      beginDoyaSlideOperation: async () => ({ state, project: { id: 'project' }, slides: [{ id: 'slide', visualPrompt: 'Synthetic' }] }),
      settleDoyaSlideOperationSlot: async () => {
        calls.settle++
        if (mode === 'outage') throw Error('Synthetic save outage')
        phase = 'completed'
        if (mode === 'lost-ack') throw Error('Synthetic lost acknowledgment')
      },
      finishDoyaSlideOperation: async () => { calls.finish++; if (phase === 'pending') phase = 'failed'; if (mode === 'finish-lost-ack') throw Error('Synthetic finish acknowledgment') },
      recoverDoyaSlideOperation: async () => { calls.recover++; return { state: phase } },
    },
    './generate': { composeSlideImage: async () => { calls.provider++; if (mode === 'provider-failure') throw Error('Synthetic provider failure'); return { imageUrl: 'https://local.test/image', rawImageUrl: 'https://local.test/raw', model: 'synthetic' } } },
    './vision': { reviseSlidePrompt: async () => { throw Error('Unexpected vision call') } },
    './logo': { fetchBuffer: async () => { throw Error('Unexpected remote fetch') } },
    '@/lib/fetch-timeout': { raceTimeout: async (_label, _timeout, value) => value },
  })
  return { calls, run: () => worker.runDoyaSlideOperation({ actor: 'actor', projectId: 'project', operationId: '10000000-0000-4000-8000-000000000001', kind: 'batch' }) }
}

;(async () => {
  for (const state of ['pending', 'completed', 'failed', 'cancelled', 'busy', 'limit', 'empty', 'unavailable']) {
    const f = fixture('normal', state); assert.equal((await f.run()).state, state)
    assert.deepEqual(f.calls, { provider: 0, settle: 0, finish: 0, recover: 0 })
  }
  console.log('PASS DoyaSlide operation: only fresh admission can invoke AI; all replay states bypass providers')
  for (const mode of ['normal', 'finish-lost-ack']) {
    const f = fixture(mode); assert.equal((await f.run()).state, 'completed')
    assert.deepEqual(f.calls, { provider: 1, settle: 1, finish: 1, recover: 1 })
  }
  console.log('PASS DoyaSlide operation: success and lost finish acknowledgment recover without AI retry')
  const lost = fixture('lost-ack'); assert.equal((await lost.run()).state, 'completed')
  assert.deepEqual(lost.calls, { provider: 1, settle: 3, finish: 0, recover: 1 })
  console.log('PASS DoyaSlide operation: lost save acknowledgments retry persistence only and recover committed output')
  const outage = fixture('outage'); assert.equal((await outage.run()).state, 'pending')
  assert.deepEqual(outage.calls, { provider: 1, settle: 3, finish: 0, recover: 1 })
  console.log('PASS DoyaSlide operation: unresolved save never triggers speculative terminal refund or provider replay')
  const failure = fixture('provider-failure'); assert.equal((await failure.run()).state, 'failed')
  assert.deepEqual(failure.calls, { provider: 1, settle: 0, finish: 1, recover: 1 })
  console.log('PASS DoyaSlide operation: definite provider failure closes owned operation once')
})().catch(error => { console.error(error); process.exitCode = 1 })
