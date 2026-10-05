const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ branch = null, status = 'live', started = true, beforeSave, duringBranch } = {}) {
  const row = {
    id: 'session', templateId: 'template', status, currentIndex: 0, followUpCount: 0,
    startedAt: started ? new Date(Date.now() - 1000) : null, endedAt: null,
    consentedAt: new Date(), expiresAt: new Date(Date.now() + 60000), updatedAt: new Date(),
    template: { questions: [{ ord: 0, text: 'first' }, { ord: 1, text: 'second' }], durationMin: 15 },
  }
  let writes = 0
  const db = {
    mensetsuSession: {
      // 旧実装も実行できるようにし、同時進行の動作差で失敗を検出する。
      update: async ({ data }) => {
        beforeSave?.(row)
        Object.assign(row, data)
        writes++
        return { ...row }
      },
      updateMany: async ({ where, data }) => {
      beforeSave?.(row)
      assert.equal(where.status, 'live')
      assert.equal(where.endedAt, null)
      assert.equal(where.startedAt.not, null)
      assert.equal(where.consentedAt.not, null)
      assert.ok(data.updatedAt > where.updatedAt)
      if (row.status !== where.status || row.endedAt || !row.startedAt || !row.consentedAt ||
          row.expiresAt <= where.expiresAt.gt || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 }
      Object.assign(row, data)
      writes++
      return { count: 1 }
    } },
    mensetsuQuestion: {
      findFirst: async ({ select }) => select ? { text: 'second' } : { branches: branch ? [branch] : [] },
      count: async () => 2,
    },
    mensetsuTurn: { findFirst: async () => ({ text: 'answer' }) },
  }
  const api = load('src/app/api/mensetsu/live/[token]/advance/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/mensetsu/public': {
      loadSessionByToken: async () => ({ ...row }),
      assertUsable: () => ({ ok: true }),
    },
    '@/lib/mensetsu/interview': { advance: () => ({
      action: 'close', questionOrd: 1, followUpCount: 0, questionText: 'second', shouldClose: true, remainingCount: 0,
    }) },
    '@/lib/mensetsu/branch': { chooseBranch: async () => {
      duringBranch?.(row)
      return { branch, reason: 'synthetic' }
    } },
  })
  return {
    row, get writes() { return writes },
    run: (intent = 'next') => api.POST({ json: async () => ({ intent }) }, { params: Promise.resolve({ token: 'synthetic' }) }),
  }
}

;(async () => {
  await check('ordinary progress saves once without rewriting live status', async () => {
    const f = fixture()
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.equal(response.body.should_close, true)
    assert.equal(f.row.currentIndex, 1)
    assert.equal(f.row.status, 'live')
    assert.equal(f.writes, 1)
  })
  await check('concurrent progress requests cannot advance the same snapshot twice', async () => {
    const f = fixture()
    const responses = await Promise.all([f.run(), f.run()])
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
    assert.equal(f.writes, 1)
  })
  for (const status of ['completed', 'evaluating', 'evaluated', 'aborted']) {
    await check(`late ordinary progress preserves ${status}`, async () => {
      const f = fixture({ beforeSave: (row) => { row.status = status; row.endedAt = new Date() } })
      assert.equal((await f.run()).status, 409)
      assert.equal(f.row.status, status)
      assert.equal(f.row.currentIndex, 0)
      assert.equal(f.writes, 0)
    })
  }
  for (const branch of [{ label: 'follow', text: 'follow-up', skipToOrd: null }, { label: 'skip', text: 'skip', skipToOrd: 1 }]) {
    await check(`branch ${branch.label} advances a live session`, async () => {
      const f = fixture({ branch })
      const response = await f.run('follow_up')
      assert.equal(response.status, 200)
      assert.equal(response.body.action, branch.skipToOrd ? 'next_question' : 'follow_up')
      assert.equal(f.writes, 1)
    })
    await check(`branch ${branch.label} cannot overwrite an ended session`, async () => {
      const f = fixture({ branch, duringBranch: (row) => { row.status = 'evaluating'; row.endedAt = new Date() } })
      assert.equal((await f.run('follow_up')).status, 409)
      assert.equal(f.row.status, 'evaluating')
      assert.equal(f.row.followUpCount, 0)
      assert.equal(f.row.currentIndex, 0)
      assert.equal(f.writes, 0)
    })
    await check(`branch ${branch.label} cannot overwrite newer progress`, async () => {
      const f = fixture({ branch, duringBranch: (row) => {
        row.currentIndex = 1
        row.updatedAt = new Date(row.updatedAt.getTime() + 1)
      } })
      assert.equal((await f.run('follow_up')).status, 409)
      assert.equal(f.row.currentIndex, 1)
      assert.equal(f.writes, 0)
    })
  }
  await check('unstarted interview cannot advance', async () => {
    const f = fixture({ status: 'consented', started: false })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.writes, 0)
  })
  await check('expiry during progress prevents the late write', async () => {
    const f = fixture({ beforeSave: (row) => { row.expiresAt = new Date(Date.now() - 1000) } })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.writes, 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
