const assert = require('node:assert/strict'), crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')
function fixture(errors) {
  let attempts = 0, writes = 0
  const api = load('src/lib/adimage/image-budget.ts', {
    'node:crypto': crypto, './access': {}, '@/lib/prisma': { prisma: { $transaction: async (work, options) => {
      assert.equal(options.isolationLevel, 'Serializable'); attempts++
      const error = errors[attempts - 1]; if (error) throw error
      return work({ write() { writes++ } })
    } } },
  })
  return { run: unique => api.withAdImageBudgetTransaction(async tx => { tx.write(); return 'saved' }, unique), attempts: () => attempts, writes: () => writes }
}
;(async () => {
  await check('Raw SQL serialization and deadlock failures retry whole aborted transactions', async () => {
    for (const code of ['40001', '40P01']) {
      const f = fixture([{ code: 'P2010', meta: { code } }, { code: 'P2010', meta: { code } }])
      assert.equal(await f.run(), 'saved'); assert.equal(f.attempts(), 3); assert.equal(f.writes(), 1)
    }
  })
  await check('ORM serialization retains bounded retry and unique retry remains opt-in', async () => {
    const normal = fixture([{ code: 'P2034' }]); assert.equal(await normal.run(), 'saved'); assert.equal(normal.attempts(), 2)
    const unique = fixture([{ code: 'P2002' }]); assert.equal(await unique.run(true), 'saved'); assert.equal(unique.attempts(), 2)
    const denied = fixture([{ code: 'P2002' }]); await assert.rejects(denied.run()); assert.equal(denied.attempts(), 1)
    const exhausted = fixture(Array.from({ length: 5 }, () => ({ code: 'P2010', meta: { code: '40001' } })))
    await assert.rejects(exhausted.run()); assert.equal(exhausted.attempts(), 5); assert.equal(exhausted.writes(), 0)
  })
  await check('Transport and ordinary SQL failures never automatically replay an uncertain commit', async () => {
    for (const error of [{ code: 'P2010', meta: { code: '08006' } }, { code: 'P2010', meta: { code: '23505' } }, { code: 'P2010' }, { code: 'P1001' }, Error('Connection lost after commit')]) {
      let attempts = 0, committed = 0
      const api = load('src/lib/adimage/image-budget.ts', { 'node:crypto': crypto, './access': {}, '@/lib/prisma': { prisma: { $transaction: async work => { attempts++; await work({}); committed++; throw error } } } })
      await assert.rejects(api.withAdImageBudgetTransaction(async () => 'saved', true)); assert.equal(attempts, 1); assert.equal(committed, 1)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
