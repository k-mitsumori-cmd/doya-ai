const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ turns = 1, started = true, status = 'live', waitUntilFails = false } = {}) {
  let finish
  let evaluationCount = 0
  let background
  let nextStatus
  const pending = new Promise((resolve) => { finish = resolve })
  const api = load('src/app/api/mensetsu/live/[token]/end/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@vercel/functions': { waitUntil: (promise) => {
      if (waitUntilFails) throw new Error('synthetic unavailable context')
      background = promise
    } },
    '@/lib/prisma': { prisma: {
      mensetsuTurn: { count: async () => turns },
      mensetsuSession: { update: async ({ data }) => { nextStatus = data.status } },
    } },
    '@/lib/mensetsu/run-evaluation': { runEvaluation: () => { evaluationCount++; return pending } },
    '@/lib/mensetsu/public': { loadSessionByToken: async () => ({ id: 'session', status, startedAt: started ? new Date() : null }) },
  })
  return {
    run: () => api.POST({}, { params: Promise.resolve({ token: 'synthetic' }) }),
    finish: (result = { ok: true, verdict: 'hold' }) => finish(result),
    get background() { return background },
    get evaluationCount() { return evaluationCount },
    get nextStatus() { return nextStatus },
  }
}

;(async () => {
  await check('completed interview responds before evaluation and retains background work', async () => {
    const f = fixture()
    const response = await f.run()
    assert.equal(response.body.ok, true)
    assert.equal(response.body.status, 'completed')
    assert.equal(f.nextStatus, 'completed')
    assert.equal(f.evaluationCount, 1)
    assert.ok(f.background instanceof Promise)
    f.finish()
    await f.background
  })
  await check('empty interview does not start evaluation', async () => {
    const f = fixture({ turns: 0 })
    const response = await f.run()
    assert.equal(response.body.status, 'aborted')
    assert.equal(f.evaluationCount, 0)
    assert.equal(f.background, undefined)
  })
  await check('unavailable background context waits for evaluation before responding', async () => {
    const f = fixture({ waitUntilFails: true })
    let responded = false
    const response = f.run().then((value) => { responded = true; return value })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(responded, false)
    f.finish()
    assert.equal((await response).body.status, 'completed')
    assert.equal(f.evaluationCount, 1)
  })
  await check('unstarted interview stays available', async () => {
    const f = fixture({ started: false })
    const response = await f.run()
    assert.equal(response.body.skipped, 'not_started')
    assert.equal(f.nextStatus, undefined)
    assert.equal(f.evaluationCount, 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
