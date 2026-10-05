const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ minutesOld, evaluated = false, takeover = false, liveCloseFails = false }) {
  const row = {
    id: 'session', status: 'evaluating',
    updatedAt: new Date(Date.now() - minutesOld * 60000),
    evaluatedAt: evaluated ? new Date(Date.now() - 3600000) : null,
  }
  const db = {
    mensetsuSession: {
      findMany: async ({ where }) => {
        if (where.status === 'live') return liveCloseFails ? [{ id: 'live', _count: { turns: 1 } }] : []
        if (where.status === 'evaluating') {
          return row.status === 'evaluating' && row.updatedAt < where.updatedAt.lt ? [{ ...row }] : []
        }
        return []
      },
      updateMany: async ({ where, data }) => {
        if (where.status === 'live' && liveCloseFails) throw new Error('synthetic close failure')
        if (where.status !== 'evaluating') return { count: 0 }
        if (takeover) row.updatedAt = new Date()
        if (row.status !== where.status || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 }
        row.status = data.status
        return { count: 1 }
      },
      count: async () => 0,
    },
  }
  const api = load('src/app/api/cron/mensetsu-purge/route.ts', {
    '@/lib/mensetsu/recording-purge-queue': { purgeQueuedMensetsuRecordings: async () => ({ processed: 0, finalized: 0, deferred: 0, failed: 0, queued: 0 }) },
    'next/server': { NextResponse: { json: (body) => ({ body }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/mensetsu/types': { EVALUATION_STALE_MS: 360000 },
  }, { process: { env: { CRON_SECRET: 'synthetic' } } })
  return { row, run: () => api.GET({ headers: { get: () => 'Bearer synthetic' } }) }
}

;(async () => {
  await check('active evaluation is not recovered', async () => {
    const f = fixture({ minutesOld: 2 })
    const res = await f.run()
    assert.equal(res.body.recoveredEvaluations, 0)
    assert.equal(f.row.status, 'evaluating')
  })
  for (const evaluated of [false, true]) {
    await check(`stale evaluation recovers previous result state ${evaluated}`, async () => {
      const f = fixture({ minutesOld: 7, evaluated })
      const res = await f.run()
      assert.equal(res.body.recoveredEvaluations, 1)
      assert.equal(f.row.status, evaluated ? 'evaluated' : 'completed')
    })
  }
  await check('cron cannot reset a newly claimed evaluation', async () => {
    const f = fixture({ minutesOld: 7, takeover: true })
    const res = await f.run()
    assert.equal(res.body.recoveredEvaluations, 0)
    assert.equal(f.row.status, 'evaluating')
  })
  await check('one stale live failure does not skip evaluation recovery', async () => {
    const f = fixture({ minutesOld: 7, liveCloseFails: true })
    const res = await f.run()
    assert.equal(res.body.closedStaleLive, 0)
    assert.equal(res.body.recoveredEvaluations, 1)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
