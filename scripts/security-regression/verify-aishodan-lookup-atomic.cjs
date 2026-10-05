const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
function fixture(change = () => {}, failSave = false) {
  const row = { id: 's', guestId: 'g', status: 'live', startedAt: new Date(), endedAt: null, consentedAt: new Date(), purgeAfter: null, room: { isActive: true, expiresAt: null, scenario: { product: { id: 'p', profile: { faq: [] } }, pricePolicy: 'allow' } } }
  let locked = false, writes = 0, saved
  const db = {
    aishodanSession: { findFirst: async () => row.guestId === 'g' ? { ...row, room: structuredClone(row.room) } : null },
    aishodanQuestion: { create: async ({ data }) => { assert.equal(locked, true); if (failSave) throw Error('PRIVATE_DATABASE_FAILURE'); writes++; saved = data; return data } },
    $queryRaw: async strings => { assert.ok(strings.join('').includes('FROM aishodan_sessions')); locked = true },
    $transaction: async fn => { try { return await fn(db) } finally { locked = false } },
  }
  const session = load('src/lib/aishodan/session.ts', { '@/lib/prisma': { prisma: db } })
  const api = load('src/app/api/aishodan/room/[token]/lookup/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, '@/lib/aishodan/session': session,
    '@/lib/aishodan/public': { toScenarioConfig: scenario => ({ guardrails: { pricePolicy: scenario.pricePolicy, noEvidenceBehavior: 'defer' } }) },
    '@/lib/aishodan/knowledge': { retrieve: async () => { assert.equal(locked, false); change(row); return [{ id: 'normal', text: 'Synthetic evidence' }, { id: 'price', text: '料金100円' }] } },
  })
  return { get writes() { return writes }, get saved() { return saved }, run: () => api.POST({ cookies: { get: () => ({ value: 'g' }) }, json: async () => ({ sessionId: 's', question: 'Synthetic question' }) }, { params: Promise.resolve({ token: 'room' }) }) }
}
;(async () => {
  for (const [label, change, status] of [
    ['ended', r => { r.endedAt = new Date(); r.status = 'completed' }, 410],
    ['consent revoked', r => { r.consentedAt = null }, 403],
    ['expired', r => { r.purgeAfter = new Date(0) }, 410],
    ['purged', r => { r.guestId = 'purged:s' }, 404],
    ['unpublished', r => { r.room.isActive = false }, 410],
    ['product changed', r => { r.room.scenario.product.id = 'other' }, 409],
    ['not started', r => { r.startedAt = null; r.status = 'pending' }, 409],
  ]) await check(`lookup refuses ${label} after search without returning evidence or recording`, async () => {
    const f = fixture(change), response = await f.run(), body = await response.json()
    assert.equal(response.status, status); assert.equal(f.writes, 0); assert.equal(body.evidence, undefined)
  })
  await check('question save failure cannot be reported as successful lookup', async () => {
    const f = fixture(undefined, true), response = await f.run(), text = await response.text()
    assert.equal(response.status, 503); assert.ok(!text.includes('PRIVATE_DATABASE_FAILURE')); assert.ok(!text.includes('Synthetic evidence'))
  })
  await check('current price policy removes both evidence and its citation', async () => {
    const f = fixture(r => { r.room.scenario.pricePolicy = 'withhold' }), response = await f.run(), body = await response.json()
    assert.equal(response.status, 200); assert.equal(body.found, true); assert.deepEqual(body.evidence, ['Synthetic evidence']); assert.deepEqual(Array.from(f.saved.citedChunkIds), ['normal']); assert.equal(f.writes, 1)
  })
  await check('unchanged live session records and returns search evidence', async () => {
    const f = fixture(), response = await f.run(), body = await response.json()
    assert.equal(response.status, 200); assert.equal(body.found, true); assert.equal(body.evidence.length, 2); assert.equal(f.writes, 1)
  })
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
