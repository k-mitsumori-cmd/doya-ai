const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ duringVerify, exists = true } = {}) {
  const row = {
    id: 'session', status: 'completed', updatedAt: new Date(Date.now() - 1000),
    startedAt: new Date(), endedAt: new Date(), purgeAfter: new Date(Date.now() + 86400000),
    consentedAt: new Date(), evaluatedAt: null, recordingPath: null,
    organization: { id: 'org', name: 'Synthetic', recordAudio: true },
    template: { level: 'mid', jobTitle: 'Synthetic', criteria: [], questions: [] },
    turns: [{ id: 'turn', speaker: 'candidate', text: 'Synthetic answer', ord: 1, startMs: 1 }],
  }
  const pending = []
  const db = {
    mensetsuSession: {
      findUnique: async () => ({ ...row }),
      update: async ({ data }) => { Object.assign(row, data, { updatedAt: new Date(row.updatedAt.getTime() + 50) }); return { ...row } },
      updateMany: async ({ where, data }) => {
        if (where.status !== row.status || where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 }
        if (where.OR && row.purgeAfter <= new Date()) return { count: 0 }
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() })
        return { count: 1 }
      },
    },
    $executeRaw: async (strings, ...values) => {
      const sql = strings.join('?')
      assert.match(sql, /UPDATE mensetsu_sessions AS s SET "recordingPath" = \?/)
      assert.doesNotMatch(sql, /updatedAt/)
      for (const name of ['consentedAt', 'startedAt', 'purgeAfter', 'organizationId', 'recordAudio']) assert.ok(sql.includes(name))
      assert.deepEqual(values, ['sessions/session/interview.webm', 'session'])
      if (!row.consentedAt || !row.startedAt || !row.organization.recordAudio || row.purgeAfter <= new Date() ||
          !['live', 'completed', 'evaluating', 'evaluated', 'aborted'].includes(row.status)) return 0
      row.recordingPath = values[0]
      return 1
    },
    mensetsuAnswerSample: { findMany: async () => [] },
    mensetsuTurn: { findMany: async () => row.turns.map((turn) => ({ ...turn })) },
    mensetsuScore: { deleteMany: async () => {}, createMany: async () => {} },
    $transaction: async (callback) => callback(db),
  }
  const evaluation = load('src/lib/mensetsu/run-evaluation.ts', {
    '@/lib/prisma': { prisma: db }, './types': { LEVEL_LABELS: { mid: '中途' }, EVALUATION_STALE_MS: 360000 },
    './evaluate': { evaluateSession: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  })
  const recording = load('src/app/api/mensetsu/live/[token]/recording/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/mensetsu/public': { loadSessionByToken: async () => ({ ...row }), assertUsable: () => ({ ok: true }) },
    '@/lib/mensetsu/storage': { recordingExists: async () => { duringVerify?.(row); return exists } },
  })
  return {
    row, pending, evaluate: () => evaluation.runEvaluation('session'),
    save: () => recording.PATCH({}, { params: Promise.resolve({ token: 'synthetic' }) }),
  }
}

const answer = { scores: [], verdict: 'hold', overallComment: 'Synthetic', candidateFeedback: 'Synthetic', recruiterReport: 'Synthetic' }

;(async () => {
  await check('recording acknowledgment does not invalidate a running evaluation', async () => {
    const f = fixture()
    const run = f.evaluate()
    await new Promise((resolve) => setImmediate(resolve))
    const lease = f.row.updatedAt.getTime()
    assert.equal((await f.save()).status, 200)
    assert.equal(f.row.updatedAt.getTime(), lease)
    f.pending[0].resolve(answer)
    assert.equal((await run).ok, true)
    assert.equal(f.row.status, 'evaluated')
    assert.equal(f.row.recordingPath, 'sessions/session/interview.webm')
  })
  await check('evaluation failure still releases ownership after recording saves', async () => {
    const f = fixture()
    const run = f.evaluate()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal((await f.save()).status, 200)
    f.pending[0].reject(new Error('synthetic provider failure'))
    await assert.rejects(run)
    assert.equal(f.row.status, 'completed')
  })
  await check('recording preserves a newer lease claimed while storage verification runs', async () => {
    const f = fixture({ duringVerify: (row) => { row.status = 'evaluating'; row.updatedAt = new Date(row.updatedAt.getTime() + 100) } })
    const original = f.row.updatedAt.getTime()
    assert.equal((await f.save()).status, 200)
    assert.equal(f.row.updatedAt.getTime(), original + 100)
    assert.equal(f.row.status, 'evaluating')
  })
  for (const status of ['completed', 'evaluated']) {
    await check(`late recording acknowledgment remains valid after transition to ${status}`, async () => {
      const f = fixture({ duringVerify: (row) => { row.status = status } })
      assert.equal((await f.save()).status, 200)
      assert.equal(f.row.status, status)
    })
  }
  for (const [name, change] of [
    ['retention expiry', (row) => { row.purgeAfter = new Date(Date.now() - 1000) }],
    ['purged session', (row) => { row.status = 'expired' }],
    ['consent removal', (row) => { row.consentedAt = null }],
    ['disabled recording', (row) => { row.organization.recordAudio = false }],
    ['unstarted session', (row) => { row.startedAt = null }],
  ]) {
    await check(`recording save rechecks ${name} after storage verification`, async () => {
      const f = fixture({ duringVerify: change })
      assert.equal((await f.save()).status, 409)
      assert.equal(f.row.recordingPath, null)
    })
  }
  await check('missing uploaded recording is not registered', async () => {
    const f = fixture({ exists: false })
    assert.equal((await f.save()).status, 400)
    assert.equal(f.row.recordingPath, null)
  })
  await check('repeated recording acknowledgment preserves session state', async () => {
    const f = fixture()
    const original = f.row.updatedAt.getTime()
    const responses = await Promise.all([f.save(), f.save()])
    assert.deepEqual(responses.map((r) => r.status), [200, 200])
    assert.equal(f.row.updatedAt.getTime(), original)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
