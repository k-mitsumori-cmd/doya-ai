const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const active = { id: 's', guestId: 'g', status: 'live', consentedAt: new Date(), endedAt: null, purgeAfter: null, schedulingClickedAt: null, room: { isActive: true, expiresAt: null } }
const session = load('src/lib/aishodan/session.ts', { '@/lib/prisma': { prisma: {} } })
async function scheduling(current, initial = active) {
  let writes = 0, locked = false
  const route = load('src/app/api/aishodan/room/[token]/scheduling/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/aishodan/session': { loadGuestSession: async () => initial },
    '@/lib/prisma': { prisma: { $transaction: async fn => fn({
      $queryRaw: async strings => { assert.ok(strings.join('').includes('FROM aishodan_sessions')); locked = true; return [{ id: 's' }] },
      aishodanSession: {
        findFirst: async ({ where }) => { assert.equal(locked, true); assert.equal(where.id, 's'); assert.equal(where.guestId, 'g'); assert.equal(where.room.token, 'room'); return current },
        update: async () => { writes++; return current },
      },
    }) } },
  })
  const response = await route.POST(new Request('https://synthetic.invalid', { method: 'POST', body: JSON.stringify({ sessionId: 's' }) }), { params: Promise.resolve({ token: 'room' }) })
  return { status: response.status, writes }
}
;(async () => {
  await check('pending and live sessions cannot resume after retention expires', async () => {
    for (const status of ['pending', 'live']) {
      const result = session.assertSessionUsable({ ...active, status, purgeAfter: new Date(0) })
      assert.equal(result.ok, false); assert.equal(result.status, 410)
    }
  })
  await check('retention boundary is inclusive', async () => {
    const fixed = new Date('2026-10-06T00:00:00Z')
    class FixedDate extends Date { static now() { return fixed.getTime() } }
    const fixedSession = load('src/lib/aishodan/session.ts', { '@/lib/prisma': { prisma: {} } }, { Date: FixedDate })
    assert.equal(fixedSession.assertSessionUsable({ ...active, purgeAfter: fixed }).status, 410)
  })
  await check('unexpired and legacy sessions remain usable', async () => {
    for (const purgeAfter of [null, new Date('2100-01-01')]) assert.equal(session.assertSessionUsable({ ...active, purgeAfter }).ok, true)
  })
  await check('ended sessions can record scheduling within retention', async () => {
    assert.deepEqual(await scheduling({ ...active, status: 'evaluated', endedAt: new Date() }), { status: 200, writes: 1 })
  })
  await check('expired or revoked session cannot record scheduling after fresh lock', async () => {
    for (const current of [{ ...active, purgeAfter: new Date(0) }, { ...active, consentedAt: null }]) assert.deepEqual(await scheduling(current), { status: 410, writes: 0 })
  })
  await check('purged ownership cannot be resurrected by an earlier read', async () => {
    assert.deepEqual(await scheduling(null), { status: 404, writes: 0 })
  })
  await check('repeated scheduling preserves the first click', async () => {
    assert.deepEqual(await scheduling({ ...active, schedulingClickedAt: new Date() }), { status: 200, writes: 0 })
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
