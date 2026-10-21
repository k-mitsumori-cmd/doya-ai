// Actual Tenjikai generate route and lifecycle store against an owned PostgreSQL socket.
// Session and AI output are synthetic; no HTTP server, provider, or production connection.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Module = require('node:module')
const repo = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(repo, 'package.json'))
const ts = req('typescript')
const { PrismaClient, Prisma } = req('@prisma/client')
const { NextRequest } = req('next/server')
const folder = process.env.DOYA_TENJIKAI_C3B_ROOT, socket = process.env.DOYA_TENJIKAI_C3B_SOCKET, port = Number(process.env.DOYA_TENJIKAI_C3B_PORT)
assert.match(path.basename(folder || ''), /^doya-tenjikai-c3b-[a-z0-9]{8}$/)
assert.equal(socket, path.join(folder, 'socket'))
assert.equal(fs.realpathSync(repo), fs.realpathSync(process.cwd()))
const url = `postgresql://doya_tenjikai_c3b@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=tenjikai_fixture`
const db = new PrismaClient({ datasources: { db: { url } } })
const locker = new PrismaClient({ datasources: { db: { url } } })
const reserver = new PrismaClient({ datasources: { db: { url } } })
const actor = 'tenjikai_c3b_actor', digest = crypto.createHash('sha256').update('tenjikai-c3b-retirement').digest('hex')
const source = new Set(), cache = new Map(), cases = []
let session = { user: { id: actor } }, aiWait = null, provider = 0
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const file = path.join(repo, relative), mod = new Module(file)
  source.add(relative); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(relative, mod)
  mod.require = id => {
    if (id === 'next-auth') return { getServerSession: async () => session }
    if (id === '@/lib/auth') return { authOptions: {} }
    if (id === '@/lib/prisma') return { prisma: db }
    if (id === '@/lib/tenjikai/ai') return { aiGeneratePlan: async input => { provider++; if (aiWait) await aiWait; return engine.mockGeneratedPlan(input) } }
    if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
    if (id.startsWith('.')) return load(path.relative(repo, path.resolve(path.dirname(file), id)) + '.ts')
    return req(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}
const engine = load('src/lib/tenjikai/engine.ts')
const lifecycleState = load('src/lib/account-lifecycle/state.ts')
const store = load('src/lib/account-lifecycle/store.ts')
const route = load('src/app/api/tenjikai/generate/route.ts')
const generation = load('src/lib/tenjikai/generation-operation.ts')
const generationReceipts = load('src/lib/tenjikai/generation-receipts.ts')
const statusRoute = load('src/app/api/tenjikai/generate/status/route.ts')
const quote = value => '"' + value.replaceAll('"', '""') + '"'
async function setup() {
  const info = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder")
  assert.equal(info[0].address, null); assert.equal(info[0].role, 'doya_tenjikai_c3b'); assert.equal(info[0].folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA tenjikai_fixture')
  for (const name of ['User', 'SystemSetting', 'TenjikaiProject', 'TenjikaiSiteAnalysis']) {
    const model = Prisma.dmmf.datamodel.models.find(item => item.name === name)
    assert(model, name)
    const cols = model.fields.filter(field => field.kind !== 'object').map(field => {
      let type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      if (field.isList) type += '[]'
      let def = ''
      if (field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now')) def = ' DEFAULT CURRENT_TIMESTAMP'
      else if (field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default)) def = ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default))
      return quote(field.dbName || field.name) + ' ' + type + (field.isRequired ? ' NOT NULL' : '') + def + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) cols.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    if (model.primaryKey?.fields?.length) cols.push('PRIMARY KEY (' + model.primaryKey.fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + cols.join(',') + ')')
  }
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User","SystemSetting",tenjikai_project,tenjikai_site_analysis')
  await db.user.create({ data: { id: actor, email: 'tenjikai-c3b@example.invalid', plan: 'FREE' } })
  session = { user: { id: actor } }; aiWait = null; provider = 0
}
const opId = () => generation.createGenerationOperationId()
const request = (operationId = opId(), input = engine.SAMPLE_INPUT) => new NextRequest('https://example.invalid/api/tenjikai/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  ...input, expectedActor: actor, clientRequestId: crypto.randomUUID(), operationId,
}) })
async function post(operationId, input) { const response = await route.POST(request(operationId, input)); return { status: response.status, body: await response.json() } }
async function status(operationId, expectedActor = actor) {
  const url = new URL('https://example.invalid/api/tenjikai/generate/status')
  url.searchParams.set('operationId', operationId); url.searchParams.set('expectedActor', expectedActor)
  const response = await statusRoute.GET(new NextRequest(url)); return { status: response.status, body: await response.json(), headers: response.headers }
}
async function cancel(operationId) {
  const response = await statusRoute.POST(new NextRequest('https://example.invalid/api/tenjikai/generate/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedActor: actor, operationId, action: 'cancel' }) }))
  return { status: response.status, body: await response.json() }
}
const identity = () => ({ operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: actor, operationId: crypto.randomUUID(), kind: 'retirement' })
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitForLocks() {
  for (let i = 0; i < 60; i++) {
    const rows = await db.$queryRawUnsafe("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%\"User\"%'")
    if (rows[0].n >= 2) return rows[0].n
    await sleep(50)
  }
  throw Error('Two competing User row-lock waiters not observed')
}
async function check(name, run) { await reset(); await run(); cases.push(name) }
;(async () => {
  try {
    await setup()
    await check('normal route creates one owned project and one analysis', async () => {
      const result = await post()
      assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.state, 'generated')
      assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1); assert.equal(await db.tenjikaiSiteAnalysis.count(), 1)
    })
    await check('preexisting real retirement fence denies project before AI', async () => {
      await store.reserveLifecycleOperation(reserver, identity(), digest)
      const result = await post()
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
    })
    await check('missing real User denies project before AI', async () => {
      await db.user.delete({ where: { id: actor } })
      const result = await post()
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
    })
    await check('malformed real retirement fence fails closed before AI', async () => {
      await db.systemSetting.create({ data: { key: lifecycleState.lifecycleFenceKey(actor), value: '{bad' } })
      const result = await post()
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
    })
    await check('retirement during synthetic AI denies analysis and final success', async () => {
      const gate = defer(); aiWait = gate.promise
      const requestPromise = post()
      for (let i = 0; i < 60 && provider === 0; i++) await sleep(50)
      assert.equal(provider, 1)
      await store.reserveLifecycleOperation(reserver, identity(), digest)
      gate.resolve()
      const result = await requestPromise
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(await db.tenjikaiProject.count(), 1); assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
    })
    await check('owned project removed during synthetic AI denies analysis and success', async () => {
      const gate = defer(); aiWait = gate.promise
      const requestPromise = post()
      for (let i = 0; i < 60 && provider === 0; i++) await sleep(50)
      assert.equal(provider, 1)
      await db.tenjikaiProject.deleteMany({ where: { userId: actor } })
      gate.resolve()
      const result = await requestPromise
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(await db.tenjikaiProject.count(), 0); assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
    })
    await check('queued retirement reservation wins locked User race over route admission', async () => {
      const held = defer(), release = defer()
      const blocker = locker.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`
        held.resolve(); await release.promise
      }, { maxWait: 10000, timeout: 20000 })
      await held.promise
      const retiring = store.reserveLifecycleOperation(reserver, identity(), digest)
      await sleep(100)
      const creating = post()
      const waiters = await waitForLocks()
      release.resolve(); await blocker
      const reserved = await retiring, result = await creating
      assert(reserved.claim)
      assert.equal(result.status, 409, JSON.stringify(result.body)); assert.equal(result.body.state, 'rejected')
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
      cases.push(`observed ${waiters} PostgreSQL lock waiters`)
    })
    await check('same operation concurrent posts commit one project and dispatch once', async () => {
      const id = opId()
      const [a, b] = await Promise.all([post(id), post(id)])
      assert([200, 202].includes(a.status), JSON.stringify(a)); assert([200, 202].includes(b.status), JSON.stringify(b))
      assert.equal([a, b].filter(x => x.status === 200).length, 1)
      assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1); assert.equal(await db.tenjikaiSiteAnalysis.count(), 1)
      const seen = await status(id)
      assert.equal(seen.status, 200); assert.equal(seen.body.state, 'completed'); assert.equal(seen.body.analysis, 'saved')
      assert.equal(seen.headers.get('cache-control'), 'private, no-store')
    })
    await check('same operation changed input is rejected without another dispatch', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      const changed = await post(id, { ...engine.SAMPLE_INPUT, eventName: '別の展示会' })
      assert.equal(changed.status, 409, JSON.stringify(changed)); assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1)
    })
    await check('foreign actor cannot adopt existing global operation ID', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      await db.user.create({ data: { id: 'other_tenjikai_actor', email: 'other-tenjikai@example.invalid', plan: 'FREE' } })
      await assert.rejects(generation.admitGeneration('other_tenjikai_actor', id, engine.SAMPLE_INPUT, db), error => error.code === 'FOREIGN_OPERATION')
      assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1)
    })
    await check('durable reserved status permits the original explicit operation only', async () => {
      const id = opId(); const admitted = await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      assert.equal(admitted.operation.state, 'reserved'); assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 1)
      const seen = await status(id); assert.equal(seen.body.state, 'reserved'); assert.equal(seen.body.dispatchAllowed, true)
      const result = await post(id); assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(provider, 1)
    })
    await check('claimed operation after process loss never dispatches again', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const claimed = await generation.claimGeneration(actor, id, engine.SAMPLE_INPUT, db)
      assert(claimed.claim); const result = await post(id)
      assert.equal(result.status, 202, JSON.stringify(result)); assert.equal(provider, 0)
      assert.equal((await status(id)).body.state, 'processing')
    })
    await check('missing cancel tombstone blocks delayed original POST', async () => {
      const id = opId(); const canceled = await cancel(id)
      assert.equal(canceled.status, 200); assert.equal(canceled.body.state, 'canceled')
      const delayed = await post(id); assert.equal(delayed.status, 202, JSON.stringify(delayed))
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
    })
    await check('old unknown operation ID cannot admit or cancel', async () => {
      const id = `${Date.now() - 25 * 60 * 60 * 1000}.${crypto.randomUUID()}`
      assert.equal((await status(id)).body.state, 'unknown')
      assert.equal((await post(id)).status, 409); assert.equal((await cancel(id)).status, 409)
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
    })
    await check('orphan global owner index fails closed before dispatch', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      await db.systemSetting.deleteMany({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const result = await post(id); assert.equal(result.status, 409, JSON.stringify(result))
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 1)
    })
    await check('receipt insert failure rolls project and quota reservation back', async () => {
      await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" ADD CONSTRAINT deny_tenjikai_owner CHECK (key NOT LIKE \'tenjikai-generate-owner:v1:%\')')
      try { const result = await post(opId()); assert.equal(result.status, 503, JSON.stringify(result)); assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0) }
      finally { await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT deny_tenjikai_owner') }
    })
    await check('analysis insert failure becomes durable degraded without repeating AI', async () => {
      await db.$executeRawUnsafe('ALTER TABLE tenjikai_site_analysis ADD CONSTRAINT deny_tenjikai_analysis CHECK (FALSE)')
      const id = opId()
      try {
        const result = await post(id)
        assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body.state, 'generated')
        assert.equal(result.body.save.analysis, 'unknown')
        assert.equal((await status(id)).body.state, 'degraded')
        assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1); assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
        const duplicate = await post(id); assert.equal(duplicate.status, 202); assert.equal(provider, 1)
      } finally { await db.$executeRawUnsafe('ALTER TABLE tenjikai_site_analysis DROP CONSTRAINT deny_tenjikai_analysis') }
    })
    await check('externally removed analysis is not reported as saved by completed status', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      await db.tenjikaiSiteAnalysis.deleteMany({ where: { projectId: (await db.tenjikaiProject.findFirst({ where: { userId: actor } })).id } })
      const seen = await status(id)
      assert.equal(seen.status, 200); assert.equal(seen.body.state, 'superseded'); assert.equal(seen.body.analysis, 'unknown')
      assert.equal((await post(id)).status, 409); assert.equal(provider, 1)
    })
    await check('project mutation without User lock blocks stale claim', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      await db.tenjikaiProject.updateMany({ where: { userId: actor }, data: { eventName: '別の現在値' } })
      const result = await post(id); assert.equal(result.status, 409, JSON.stringify(result)); assert.equal(provider, 0)
      assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
    })
    await check('late old claim cannot write analysis after project generation changed', async () => {
      const old = opId(); await generation.admitGeneration(actor, old, engine.SAMPLE_INPUT, db)
      const claimed = await generation.claimGeneration(actor, old, engine.SAMPLE_INPUT, db); assert(claimed.claim)
      await db.tenjikaiProject.updateMany({ where: { userId: actor }, data: { eventName: 'new generation' } })
      await assert.rejects(generation.finalizeGeneration(claimed.claim, engine.analyzeSite(engine.SAMPLE_INPUT.serviceUrl), db), error => error.code === 'PROJECT_CHANGED')
      assert.equal((await status(old)).body.state, 'superseded'); assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
      assert.equal(provider, 0)
    })
    await check('status waiting on User lock observes newly committed retirement fence', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const held = defer(), release = defer()
      const blocker = locker.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`; held.resolve(); await release.promise }, { maxWait: 10000, timeout: 20000 })
      await held.promise
      const retiring = store.reserveLifecycleOperation(reserver, identity(), digest)
      await sleep(100)
      const checking = status(id)
      const waiters = await waitForLocks()
      release.resolve(); await blocker; await retiring
      const result = await checking
      assert.equal(result.status, 409, JSON.stringify(result)); assert.equal(provider, 0)
      cases.push(`status observed ${waiters} PostgreSQL lock waiters`)
    })
    await check('status expected actor mismatch is private and has no provider or business write', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const before = await db.systemSetting.count()
      const result = await status(id, 'other_actor')
      assert.equal(result.status, 409); assert.equal(result.headers.get('cache-control'), 'private, no-store')
      assert.equal(await db.systemSetting.count(), before); assert.equal(provider, 0)
    })
    await check('512 missing-cancel tombstones bound new admission without spending project quota', async () => {
      for (let n = 0; n < 512; n++) assert.equal((await generation.cancelGeneration(actor, opId(), db)).state, 'canceled')
      assert.equal(await db.tenjikaiProject.count(), 0)
      const overflow = await post(opId()); assert.equal(overflow.status, 503, JSON.stringify(overflow))
      assert.equal(provider, 0); assert.equal(await db.tenjikaiProject.count(), 0)
      const removed = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`
        return generationReceipts.purgeGenerationReceipts(tx, actor)
      })
      assert.equal(removed.count, 512); assert.equal(await db.systemSetting.count(), 0)
    })
    await check('30-day terminal GC removes owner and never makes old ID eligible again', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      const old = generation.createGenerationOperationId(oldDate)
      assert.equal((await generation.cancelGeneration(actor, old, db, oldDate)).state, 'canceled')
      assert.equal(await db.systemSetting.count(), 2)
      const fresh = opId(); await generation.admitGeneration(actor, fresh, engine.SAMPLE_INPUT, db)
      assert.equal(await db.systemSetting.count(), 2)
      assert.equal((await status(old)).body.state, 'unknown')
      assert.equal((await post(old)).status, 409); assert.equal(provider, 0)
    })
    const report = { runId: process.env.DOYA_TENJIKAI_C3B_RUN_ID, accepted: true, passed: cases.length, cases,
      scope: 'Actual route, plan tier, Prisma and lifecycle store with owned private PostgreSQL; synthetic session/AI; no external provider or HTTP server',
      sourceHashes: Object.fromEntries([...source, 'scripts/security-regression/verify-tenjikai-c3b-postgres.cjs', 'scripts/security-regression/verify-tenjikai-c3b-postgres.py'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }
    const target = path.join(process.env.DOYA_TENJIKAI_C3B_EVIDENCE_DIR, 'postgres-results-' + report.runId + '.json')
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ target, passed: cases.length }))
  } finally { await Promise.all([db.$disconnect(), locker.$disconnect(), reserver.$disconnect()]) }
})().catch(error => { console.error(error); process.exitCode = 1 })
