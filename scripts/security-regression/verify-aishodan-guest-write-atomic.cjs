const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture(kind, change = () => {}) {
  const row = { id: 's', guestId: 'g', roomId: 'r', status: 'live', startedAt: new Date(), endedAt: null, consentedAt: new Date(), purgeAfter: null, updatedAt: new Date(), currentPhase: 'first', room: { isActive: true, expiresAt: null, scenario: {} } }
  let reads = 0, writes = 0, locked = false, queue = Promise.resolve()
  const slotValues = []
  const db = {
    aishodanSession: {
      findFirst: async ({ where }) => {
        assert.equal(where.id, 's'); assert.equal(where.guestId, 'g'); assert.equal(where.room.token, 'room')
        reads++
        if (!locked) { const snapshot = { ...row, room: { ...row.room } }; change(row); return snapshot }
        return row.guestId === 'g' ? { ...row, room: { ...row.room } } : null
      },
      update: async ({ data }) => { assert.equal(locked, true); writes++; Object.assign(row, data); return { ...row } },
    },
    aishodanSlotValue: {
      upsert: async ({ create, update }) => { assert.equal(locked, true); writes++; const prior = slotValues.find(v => v.key === create.key); if (prior) Object.assign(prior, update); else slotValues.push({ ...create }); return create },
      findMany: async () => { assert.equal(locked, true); return slotValues },
    },
    aishodanTurn: { count: async () => 0 },
    $queryRaw: async strings => { assert.ok(strings.join('').includes('FROM aishodan_sessions')); locked = true; return [{ id: 's' }] },
    $transaction: fn => {
      const result = queue.then(async () => { locked = false; try { return await fn(db) } finally { locked = false } })
      queue = result.catch(() => {})
      return result
    },
  }
  const session = load('src/lib/aishodan/session.ts', { '@/lib/prisma': { prisma: db } })
  const api = load(`src/app/api/aishodan/room/[token]/${kind}/route.ts`, {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: db },
    '@/lib/aishodan/session': session,
    '@/lib/aishodan/public': { toScenarioConfig: () => ({ slots: [{ key: 'need', label: 'Need', required: true, choices: ['a'] }], phases: [], durationMin: 15 }) },
    '@/lib/aishodan/defaults': { DEFAULT_SLOTS: [] },
    '@/lib/aishodan/engine': { advance: ({ currentPhaseKey }) => ({ phaseKey: currentPhaseKey + '-next', phaseName: 'Next', action: 'next', goal: '', askNext: '', remainingRequired: 0, shouldClose: false }) },
  })
  return {
    row, slotValues, get writes() { return writes }, get reads() { return reads },
    run: () => api.POST({ cookies: { get: () => ({ value: 'g' }) }, json: async () => ({ sessionId: 's', key: 'need', value: 'synthetic', intent: 'next' }) }, { params: Promise.resolve({ token: 'room' }) }),
  }
}
;(async () => {
  for (const kind of ['record', 'advance']) {
    for (const [label, change, status] of [
      ['ended', row => { row.status = 'completed'; row.endedAt = new Date() }, 410],
      ['consent revoked', row => { row.consentedAt = null }, 403],
      ['retention expired', row => { row.purgeAfter = new Date(0) }, 410],
      ['purged ownership', row => { row.guestId = 'purged:s' }, 404],
      ['room unpublished', row => { row.room.isActive = false }, 410],
      ['not started', row => { row.startedAt = null; row.status = 'pending' }, 409],
    ]) {
      await check(`${kind} refuses ${label} after the initial snapshot`, async () => {
        const f = fixture(kind, change)
        assert.equal((await f.run()).status, status); assert.equal(f.writes, 0)
      })
    }
    await check(`${kind} accepts a current live session using a fresh scoped read`, async () => {
      const f = fixture(kind)
      assert.equal((await f.run()).status, 200); assert.ok(f.reads >= 2); assert.ok(f.writes >= 1)
    })
  }
  await check('simultaneous progress calculates the second transition from the latest phase', async () => {
    const f = fixture('advance')
    assert.deepEqual((await Promise.all([f.run(), f.run()])).map(r => r.status), [200, 200])
    assert.equal(f.row.currentPhase, 'first-next-next')
  })
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
