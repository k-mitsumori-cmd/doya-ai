const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const crypto = require('node:crypto')

const identity = { userId: 'budget-user', guestId: null, plan: 'FREE' }
function fixture({ images = 0, concepts = 0, now = '2026-09-25T00:00:00Z' } = {}) {
  const rows = new Map()
  const writes = []
  let chain = Promise.resolve()
  let failNextWrite = false
  let current = Date.parse(now)
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [current])) }
    static now() { return current }
  }
  const db = {
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      create: async ({ data }) => {
        if (rows.has(data.key)) throw Object.assign(Error('unique'), { code: 'P2002' })
        rows.set(data.key, data.value)
      },
      update: async ({ where, data }) => {
        if (failNextWrite) { failNextWrite = false; throw Error('DB write failed') }
        rows.set(where.key, data.value)
      },
    },
    adImageCreative: { count: async () => images },
    adImageConcept: {
      count: async () => concepts,
      create: async ({ data }) => { writes.push(data); return { id: 'saved', creatives: data.creatives.create } },
    },
  }
  const prisma = {
    ...db,
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      const before = chain
      let unlock
      chain = new Promise(resolve => { unlock = resolve })
      await before
      const snapshot = new Map(rows)
      const writeLength = writes.length
      try { return await callback(db) }
      catch (error) { rows.clear(); for (const [key, value] of snapshot) rows.set(key, value); writes.length = writeLength; throw error }
      finally { unlock() }
    },
  }
  const access = {
    DAILY_CONCEPT_LIMIT: { FREE: 5, PRO: 40 },
    DAILY_IMAGE_LIMIT: { FREE: 3, PRO: 50 },
    MONTHLY_IMAGE_LIMIT: { FREE: 15, PRO: 300 },
    MAX_PLACEMENTS_PER_RUN: 10,
    ownerWhere: id => ({ userId: id.userId }),
    quotaDenied: (reason, code, plan, usage) => ({ ok: false, reason, code, plan, usage }),
    limitMessage: () => 'quota reached',
  }
  const budget = load('src/lib/adimage/image-budget.ts', {
    'node:crypto': crypto,
    '@/lib/prisma': { prisma },
    './access': access,
  }, { Date: FixedDate, crypto })
  return { ...budget, rows, writes, advance: ms => { current += ms }, failWrite: () => { failNextWrite = true } }
}
const save = tx => tx.adImageConcept.create({ data: { creatives: { create: [{ id: 'image' }] } } })
;(async () => {
  await check('concurrent claims admit only one final daily slot', async () => {
    const f = fixture({ images: 2 })
    const results = await Promise.all([f.claimImageBudget(identity, 1, true), f.claimImageBudget(identity, 1, true)])
    assert.equal(results.filter(result => result.ok).length, 1)
    assert.equal(results.find(result => !result.ok).code, 'DAILY_IMAGE_LIMIT')
    await f.settleImageBudget(results.find(result => result.ok).reservation, 1, save)
    assert.equal((await f.readImageBudgetUsage(identity.userId)).today, 3)
  })
  await check('deleting images cannot restore quota after settlement', async () => {
    const f = fixture()
    const claim = await f.claimImageBudget(identity, 3, true)
    await f.settleImageBudget(claim.reservation, 3, save)
    assert.equal((await f.claimImageBudget(identity, 1, true)).code, 'DAILY_IMAGE_LIMIT')
    assert.equal(f.writes.length, 1)
  })
  await check('partial output refunds unused image slots while keeping concept usage', async () => {
    const f = fixture()
    const claim = await f.claimImageBudget(identity, 3, true)
    await f.settleImageBudget(claim.reservation, 1, save)
    assert.equal((await f.readImageBudgetUsage(identity.userId)).today, 1)
    const next = await f.claimImageBudget(identity, 2, false)
    assert.equal(next.ok, true)
    await f.releaseImageBudget(next.reservation)
    assert.equal((await f.readImageBudgetUsage(identity.userId)).today, 1)
  })
  await check('failed save rolls back ledger and permits refund', async () => {
    const f = fixture()
    const claim = await f.claimImageBudget(identity, 3, true)
    f.failWrite()
    await assert.rejects(() => f.settleImageBudget(claim.reservation, 3, save), /DB write failed/)
    assert.equal(f.writes.length, 0)
    await f.releaseImageBudget(claim.reservation)
    assert.equal((await f.readImageBudgetUsage(identity.userId)).today, 0)
  })
  await check('stale reservation expires; JST day rollover keeps monthly usage', async () => {
    const f = fixture({ now: '2026-09-25T14:59:59Z' })
    const first = await f.claimImageBudget(identity, 2, true)
    f.advance(15 * 60 * 1000 + 1000)
    assert.deepEqual(JSON.parse(JSON.stringify(await f.readImageBudgetUsage(identity.userId))), { today: 0, month: 0 })
    const next = await f.claimImageBudget(identity, 2, false)
    await f.settleImageBudget(next.reservation, 2, save)
    f.advance(24 * 60 * 60 * 1000)
    assert.deepEqual(JSON.parse(JSON.stringify(await f.readImageBudgetUsage(identity.userId))), { today: 0, month: 2 })
    await f.releaseImageBudget(first.reservation)
  })
  await check('database failure rejects claim before generation', async () => {
    const f = fixture()
    const claim = await f.claimImageBudget(identity, 1, true)
    f.failWrite()
    await assert.rejects(() => f.claimImageBudget(identity, 1, true), /DB write failed/)
    await f.releaseImageBudget(claim.reservation)
  })
  await check('new concepts obey daily cap while refinements use their own image allowance', async () => {
    const f = fixture({ concepts: 5 })
    assert.equal((await f.claimImageBudget(identity, 1, true)).code, 'DAILY_CONCEPT_LIMIT')
    const refine = await f.claimImageBudget(identity, 1, false)
    assert.equal(refine.ok, true)
    await f.settleImageBudget(refine.reservation, 1, save)
  })
  await check('JST month rollover resets both image meters', async () => {
    const f = fixture({ now: '2026-09-30T14:59:59Z' })
    const claim = await f.claimImageBudget(identity, 1, true)
    await f.settleImageBudget(claim.reservation, 1, save)
    f.advance(1000)
    assert.deepEqual(JSON.parse(JSON.stringify(await f.readImageBudgetUsage(identity.userId))), { today: 0, month: 0 })
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
