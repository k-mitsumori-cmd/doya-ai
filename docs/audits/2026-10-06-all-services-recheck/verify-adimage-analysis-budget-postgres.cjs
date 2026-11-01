const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { createRequire } = require('node:module')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const base = 'docs/audits/2026-10-06-all-services-recheck/', fixture = base + 'verify-adimage-operation-postgres.cjs'
const { db, setupDb, makeBudget } = new Function('require', '__dirname', fs.readFileSync(fixture, 'utf8').split(';(async()=>')[0] + '\nreturn {db,setupDb,makeBudget};')(createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)))
const access = load('src/lib/adimage/access.ts', { crypto, 'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db } })
const api = load('src/lib/adimage/analysis-budget.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './access': access })
const actor = 'analysis-user', key = 'adimage-analysis:v1:' + crypto.createHash('sha256').update(actor).digest('hex'), cases = []
let budget
const transaction = work => budget.withAdImageBudgetTransaction(work, true)
const read = async () => { const row = await db.systemSetting.findUnique({ where: { key } }); return row ? JSON.parse(row.value) : null }
const set = value => db.systemSetting.update({ where: { key }, data: { value: JSON.stringify(value) } })
const claim = () => transaction(tx => api.claimAnalysisBudgetInTransaction(tx, actor))
const finish = (lease, refund = false) => transaction(tx => api.finishAnalysisBudgetInTransaction(tx, lease, refund))
async function reset() {
  budget = await makeBudget()
  await db.$executeRawUnsafe(`INSERT INTO "User" (id,plan) VALUES ('analysis-user','FREE') ON CONFLICT(id) DO UPDATE SET plan='FREE'`)
}
async function record(name, work) { await reset(); await work(); cases.push(name); console.log('PASS ' + name) }
;(async () => {
  await setupDb()
  // Shared fixture keeps User minimal; Prisma plan updates also write @updatedAt.
  await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP')
  await record('Admission and operation receipt roll back together', async () => {
    await assert.rejects(transaction(async tx => {
      assert((await api.claimAnalysisBudgetInTransaction(tx, actor)).ok)
      await tx.systemSetting.create({ data: { key: 'synthetic-receipt', value: 'pending' } })
      throw Error('Synthetic admission rollback')
    }), /Synthetic admission rollback/)
    assert.equal(await read(), null); assert.equal(await db.systemSetting.findUnique({ where: { key: 'synthetic-receipt' } }), null)
  })
  await record('Ten concurrent serializable admissions consume one attempt', async () => {
    const settled = await Promise.allSettled(Array.from({ length: 10 }, claim))
    const failures = settled.filter(r => r.status === 'rejected')
    assert.equal(failures.length, 0, failures.map(r => String(r.reason)).join('\n'))
    const results = settled.map(r => r.value)
    assert.equal(results.filter(r => r.ok).length, 1); assert(results.filter(r => !r.ok).every(r => r.reason === 'busy'))
    assert.equal((await read()).count, 1)
  })
  await record('Canonical locked plan retains FREE20 and paid160 limits', async () => {
    for (const [plan, limit] of [['FREE', 20], ['PRO', 160]]) {
      await db.systemSetting.deleteMany({ where: { key } }); await db.user.update({ where: { id: actor }, data: { plan }, select: { id: true, plan: true } })
      for (let i = 0; i < limit; i++) { const r = await claim(); assert(r.ok); assert.equal(r.limit, limit); assert.equal(await finish(r.lease), true) }
      const capped = await claim(); assert.equal(capped.ok, false); assert.equal(capped.reason, 'limit'); assert.equal(capped.limit, limit); assert.equal((await read()).count, limit)
    }
  })
  await record('Brand insert, completed receipt and budget finalization roll back together', async () => {
    const r = await claim(); assert(r.ok)
    await assert.rejects(transaction(async tx => {
      assert.equal(await api.finishAnalysisBudgetInTransaction(tx, r.lease, false), true)
      await tx.adImageBrand.create({ data: { id: 'synthetic-result', userId: actor, name: 'Synthetic', valueProps: [], colors: [] } })
      await tx.systemSetting.create({ data: { key: 'synthetic-result-receipt', value: 'completed' } })
      throw Error('Synthetic result rollback')
    }), /Synthetic result rollback/)
    assert.equal((await read()).token, r.lease.token); assert.equal((await read()).count, 1)
    assert.equal(await db.adImageBrand.findUnique({ where: { id: 'synthetic-result' } }), null)
    assert.equal(await db.systemSetting.findUnique({ where: { key: 'synthetic-result-receipt' } }), null)
  })
  await record('Successful atomic completion retains one consumed attempt and clears lease', async () => {
    const r = await claim(); assert(r.ok)
    await transaction(async tx => {
      assert.equal(await api.finishAnalysisBudgetInTransaction(tx, r.lease, false), true)
      await tx.adImageBrand.create({ data: { id: 'synthetic-result', userId: actor, name: 'Synthetic', valueProps: [], colors: [] } })
      await tx.systemSetting.create({ data: { key: 'synthetic-result-receipt', value: 'completed' } })
    })
    assert.equal((await read()).count, 1); assert.equal((await read()).token, null)
    assert.equal(await finish(r.lease, true), false); assert.equal((await read()).count, 1)
  })
  await record('Source rejection refunds exactly once', async () => {
    const r = await claim(); assert(r.ok); assert.equal(await finish(r.lease, true), true)
    assert.equal((await read()).count, 0); assert.equal(await finish(r.lease, true), false); assert.equal((await read()).count, 0)
  })
  await record('Expired worker cannot finalize or refund even before replacement admission', async () => {
    const r = await claim(); assert(r.ok); await set({ ...await read(), until: 1 })
    assert.equal(await finish(r.lease), false); assert.equal(await finish(r.lease, true), false)
    assert.equal((await read()).count, 1); assert.equal((await read()).token, r.lease.token)
  })
  await record('Lease expiry uses wall clock even when transaction started before the deadline', async () => {
    const r = await claim(); assert(r.ok)
    await transaction(async tx => {
      await tx.$executeRaw`UPDATE "SystemSetting" SET "value" = ("value"::jsonb || jsonb_build_object('until', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP + INTERVAL '50 milliseconds') * 1000))::text WHERE "key" = ${key}`
      await tx.$queryRaw`SELECT 1 AS waited FROM pg_sleep(0.08)`
      assert.equal(await api.finishAnalysisBudgetInTransaction(tx, r.lease, true), false)
    })
    assert.equal((await read()).count, 1); assert.equal((await read()).token, r.lease.token)
  })
  await record('Old lease cannot release or refund a replacement attempt', async () => {
    const first = await claim(); assert(first.ok); await set({ ...await read(), until: 1 })
    const second = await claim(); assert(second.ok); assert.notEqual(first.lease.token, second.lease.token)
    assert.equal(await finish(first.lease, true), false); assert.equal((await read()).count, 2); assert.equal((await read()).token, second.lease.token)
  })
  await record('JST period rollover resets attempts after an expired prior lease', async () => {
    const r = await claim(); assert(r.ok); await set({ ...await read(), day: '2020-01-01', count: 20, until: 1 })
    const next = await claim(); assert(next.ok); assert.equal((await read()).count, 1)
    assert.equal((await read()).day, new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))
  })
  await record('Missing actor cannot create a budget record', async () => {
    const result = await transaction(tx => api.claimAnalysisBudgetInTransaction(tx, 'missing-actor'))
    assert.equal(result.ok, false); assert.equal(result.reason, 'unavailable'); assert.equal(await db.systemSetting.count(), 0)
  })
  await record('Database uncertainty propagates and rolls back receipt instead of partially admitting', async () => {
    await assert.rejects(transaction(async tx => {
      await tx.systemSetting.create({ data: { key: 'synthetic-receipt', value: 'pending' } })
      return api.claimAnalysisBudgetInTransaction(new Proxy(tx, { get(target, prop) { if (prop === '$queryRaw') return async () => { throw Error('Synthetic database uncertainty') }; return Reflect.get(target, prop) } }), actor)
    }), /Synthetic database uncertainty/)
    assert.equal(await db.systemSetting.count(), 0)
  })
  await record('Malformed counters cannot silently reset usage or admit paid work', async () => {
    const r = await claim(); assert(r.ok); const before = await read()
    for (const patch of [{ count: -1 }, { count: 0.5 }, { count: '0' }, { until: null }, { day: '2026-02-30' }, { token: null, until: 1 }, { token: 'forged' }]) {
      const corrupt = { ...before, ...patch }; await set(corrupt)
      await assert.rejects(claim, /Analysis budget state is invalid/); assert.deepEqual(await read(), corrupt)
    }
  })
  await record('User plan remains locked until admission transaction commits', async () => {
    let release, entered; const gate = new Promise(resolve => { release = resolve }); const started = new Promise(resolve => { entered = resolve })
    const admission = transaction(async tx => { const r = await api.claimAnalysisBudgetInTransaction(tx, actor); entered(); await gate; return r })
    await started
    let settled = false
    const upgrade = db.user.update({ where: { id: actor }, data: { plan: 'PRO' }, select: { plan: true } }).then(row => { settled = true; return row })
    await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(settled, false)
    release(); const r = await admission; assert(r.ok); assert.equal(r.limit, 20); assert.equal((await upgrade).plan, 'PRO')
  })
  const files = ['src/lib/adimage/analysis-budget.ts', 'src/lib/adimage/access.ts', 'src/lib/adimage/image-budget.ts']
  const result = { checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), scope: 'Actual analysis budget transaction helpers and locked User.plan, Prisma/private Unix-only PostgreSQL. Synthetic brand and receipt writes verify atomic primitives. Durable analyze operation and HTTP/client recovery are not yet connected or proved. No production DB/provider calls.' }
  fs.writeFileSync(base + 'adimage-analysis-budget-postgres-results.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result))
})().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1 })
