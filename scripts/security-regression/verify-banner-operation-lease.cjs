const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')
const id = '10000000-0000-4000-8000-000000000001'
const inputHash = 'a'.repeat(64)
const lease = 15 * 60 * 1000
const started = Date.parse('2026-10-07T00:00:00Z')
let clock = started
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])) } static now() { return clock } }
function fixture(kind) {
  let receipt = { version: 1, state: 'pending', inputHash, startedAt: new Date(started).toISOString(), result: null, generationId: null, reservation: null }
  let updates = 0, providerCalls = 0
  let rejectSave = false
  const tx = {
    $queryRaw: async () => [{ id: 'actor' }], $executeRaw: async () => 0,
    systemSetting: { findUnique: async () => ({ value: JSON.stringify(receipt) }), update: async ({ data }) => { if (rejectSave) throw Error('Synthetic unavailable write'); receipt = JSON.parse(data.value); updates++ } },
    generation: { findFirst: async () => receipt.state === 'completed' ? { id: 'saved-image', output: 'data:image/png;base64,saved' } : null, create: async () => { throw Error('Expired work cannot create a generation') } }
  }
  // Model commit/rollback, so throwing inside a transaction cannot hide a missing terminal commit.
  const db = { $transaction: async fn => { const before = structuredClone(receipt); try { return await fn(tx) } catch (error) { receipt = before; throw error } } }
  const helper = kind === 'refine'
    ? load('src/lib/banner/refine-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './monthly-quota': {} }, { Date: Clock })
    : load('src/lib/banner/text-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './text-budget': { reserveBannerTextCallInTransaction: () => { throw Error('Expired operation cannot reserve again') } } }, { Date: Clock })
  const payload = kind === 'copy' ? { suggestions: ['有効な案'] } : { reply: '有効な返信です？' }
  const recover = cancel => kind === 'refine'
    ? (cancel ? helper.cancelMissingBannerRefinement : helper.recoverBannerRefinement)('actor', id, new Date(0), db)
    : helper.recoverBannerTextOperation('actor', kind, id, Boolean(cancel), db)
  const begin = () => kind === 'refine' ? helper.beginBannerRefinement('actor', id, inputHash, new Date(0), false, db) : helper.beginBannerTextOperation('actor', kind, id, inputHash, db)
  const complete = () => kind === 'refine' ? helper.completeBannerRefinement('actor', id, inputHash, 'data:image/png;base64,synthetic', { instruction: 'Synthetic' }, db) : helper.completeBannerTextOperation('actor', kind, id, inputHash, payload, db)
  return { helper, recover, begin, complete, payload, get receipt() { return receipt }, get updates() { return updates }, set rejectSave(value) { rejectSave = value }, completeReceipt() { receipt.state = 'completed'; if (kind === 'refine') receipt.generationId = 'saved-image'; else receipt.result = payload } }
}
;(async () => {
  let cases = 0
  for (const kind of ['chat', 'copy', 'refine']) {
    const f = fixture(kind)
    assert.equal(kind === 'refine' ? f.helper.BANNER_REFINE_OPERATION_LEASE_MS : f.helper.BANNER_TEXT_OPERATION_LEASE_MS, lease)
    clock = started + lease - 1
    assert.equal((await f.recover()).state, 'pending'); assert.equal(f.updates, 0); cases++
    for (const entry of ['recover', 'cancel', 'begin', 'complete']) {
      const f = fixture(kind); clock = started + lease
      if (entry === 'complete') await assert.rejects(f.complete(), e => e.status === 409)
      else assert.equal((await (entry === 'begin' ? f.begin() : f.recover(entry === 'cancel'))).state, 'failed')
      assert.equal(f.receipt.state, 'failed'); assert.equal(f.updates, 1)
      await assert.rejects(f.complete(), e => e.status === 409)
      assert.equal((await f.begin()).state, 'failed'); assert.equal(f.updates, 1); cases++
    }
    {
      const f = fixture(kind); f.completeReceipt(); clock = started + 30 * 86400000
      assert.equal((await f.recover()).state, 'completed'); assert.equal((await f.begin()).state, 'completed'); assert.equal(f.updates, 0); cases++
    }
    {
      const f = fixture(kind); clock = started + lease; f.rejectSave = true
      await assert.rejects(f.recover()); assert.equal(f.receipt.state, 'pending')
      f.rejectSave = false; assert.equal((await f.recover()).state, 'failed'); cases++
    }
  }
  assert.equal(cases, 21)
  console.log('PASS21 actual text/refinement helpers: millisecond lease boundary, durable terminal commit, late-save fence, immutable completed result and failed persistence recovery. Synthetic transactions; real lock/quota races covered by isolated PostgreSQL probes.')
})().catch(error => { console.error(error); process.exitCode = 1 })
