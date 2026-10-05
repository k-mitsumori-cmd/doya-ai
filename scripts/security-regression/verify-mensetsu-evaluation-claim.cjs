const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture() {
  const clock = { now: Date.now() }
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])) }
    static now() { return clock.now }
  }
  const row = {
    id: 'session', status: 'completed', updatedAt: new Date(clock.now - 1000),
    startedAt: new Date(clock.now), endedAt: new Date(clock.now), purgeAfter: new Date(clock.now + 86400000),
    evaluatedAt: null,
    organization: { id: 'org', name: 'Synthetic' },
    template: { level: 'mid', jobTitle: 'Synthetic', criteria: [], questions: [] },
    turns: [{ id: 'turn', speaker: 'candidate', text: 'Synthetic answer', ord: 1, startMs: 1 }],
  }
  const stats = { aiCalls: 0, scoreDeletes: 0, scoreCreates: 0 }
  const pending = []
  const db = {
    mensetsuSession: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({ where, data }) => {
        if (where.id !== row.id || where.status !== row.status ||
            where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 }
        if (where.OR && row.purgeAfter <= new Date(clock.now)) return { count: 0 }
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date(clock.now) })
        return { count: 1 }
      },
    },
    mensetsuAnswerSample: { findMany: async () => [] },
    mensetsuTurn: { findMany: async () => row.turns.map((turn) => ({ ...turn })) },
    mensetsuScore: {
      deleteMany: async () => { stats.scoreDeletes++ },
      createMany: async () => { stats.scoreCreates++ },
    },
    $transaction: async (callback) => callback(db),
  }
  const api = load('src/lib/mensetsu/run-evaluation.ts', {
    '@/lib/prisma': { prisma: db },
    './types': { LEVEL_LABELS: { mid: '中途' }, EVALUATION_STALE_MS: 360000 },
    './evaluate': { evaluateSession: async () => {
      stats.aiCalls++
      const result = deferred()
      pending.push(result)
      return result.promise
    } },
  }, { Date: FakeDate })
  return { row, stats, pending, run: () => api.runEvaluation('session'), advance: (ms) => { clock.now += ms } }
}

const answer = { scores: [], verdict: 'hold', overallComment: 'Synthetic', candidateFeedback: 'Synthetic', recruiterReport: 'Synthetic' }

;(async () => {
  await check('simultaneous evaluations call AI once and save one result', async () => {
    const f = fixture()
    const first = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    const second = await f.run()
    assert.equal(second.status, 409)
    assert.equal(f.stats.aiCalls, 1)
    f.pending[0].resolve(answer)
    assert.equal((await first).ok, true)
    assert.equal(f.row.status, 'evaluated')
    assert.equal(f.stats.scoreDeletes, 1)
    assert.equal(f.stats.scoreCreates, 1)
  })

  await check('provider failure restores completed status and permits retry', async () => {
    const f = fixture()
    const first = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    const failedLease = f.row.updatedAt.getTime()
    f.pending[0].reject(new Error('synthetic provider failure'))
    await assert.rejects(first)
    assert.equal(f.row.status, 'completed')
    assert.ok(f.row.updatedAt.getTime() > failedLease)
    assert.equal(f.stats.scoreDeletes, 0)
    const retry = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    assert.ok(f.row.updatedAt.getTime() > failedLease)
    f.pending[1].resolve(answer)
    assert.equal((await retry).ok, true)
    assert.equal(f.stats.aiCalls, 2)
  })

  await check('expired ownership cannot overwrite a newer evaluation', async () => {
    const f = fixture()
    const first = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    f.advance(7 * 60 * 1000)
    const replacement = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(f.stats.aiCalls, 2)
    f.pending[0].resolve(answer)
    assert.equal((await first).status, 409)
    assert.equal(f.stats.scoreCreates, 0)
    f.pending[1].resolve(answer)
    assert.equal((await replacement).ok, true)
    assert.equal(f.stats.scoreCreates, 1)
  })

  await check('retention expiry during AI call cannot restore private report data', async () => {
    const f = fixture()
    const run = f.run()
    await new Promise((resolve) => setImmediate(resolve))
    f.advance(2 * 86400000)
    f.pending[0].resolve(answer)
    assert.equal((await run).status, 409)
    assert.equal(f.row.status, 'completed')
    assert.equal(f.stats.scoreDeletes, 0)
    assert.equal(f.stats.scoreCreates, 0)
  })

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
