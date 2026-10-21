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
const folder = process.env.DOYA_TENJIKAI_C3A_ROOT, socket = process.env.DOYA_TENJIKAI_C3A_SOCKET, port = Number(process.env.DOYA_TENJIKAI_C3A_PORT)
assert.match(path.basename(folder || ''), /^doya-tenjikai-c3a-[a-z0-9]{8}$/)
assert.equal(socket, path.join(folder, 'socket'))
assert.equal(fs.realpathSync(repo), fs.realpathSync(process.cwd()))
const url = `postgresql://doya_tenjikai_c3a@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=tenjikai_fixture`
const db = new PrismaClient({ datasources: { db: { url } } })
const locker = new PrismaClient({ datasources: { db: { url } } })
const reserver = new PrismaClient({ datasources: { db: { url } } })
const actor = 'tenjikai_c3a_actor', digest = crypto.createHash('sha256').update('tenjikai-c3a-retirement').digest('hex')
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
const workspaceStore = load('src/lib/tenjikai/workspace-store.ts')
const route = load('src/app/api/tenjikai/generate/route.ts')
const quote = value => '"' + value.replaceAll('"', '""') + '"'
async function setup() {
  const info = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder")
  assert.equal(info[0].address, null); assert.equal(info[0].role, 'doya_tenjikai_c3a'); assert.equal(info[0].folder, folder + '/data')
  await db.$executeRawUnsafe('CREATE SCHEMA tenjikai_fixture')
  for (const name of ['User', 'SystemSetting', 'TenjikaiProject', 'TenjikaiSiteAnalysis',
    'TenjikaiBoothPlan', 'TenjikaiBoothElement', 'TenjikaiGraphicPanel', 'TenjikaiCreative',
    'TenjikaiNovelty', 'TenjikaiBudgetLine', 'TenjikaiDocument', 'TenjikaiTask']) {
    const model = Prisma.dmmf.datamodel.models.find(item => item.name === name)
    assert(model, name)
    const cols = model.fields.filter(field => field.kind !== 'object').map(field => {
      let type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      if (field.isList) type += '[]'
      let def = ''
      if (field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now')) def = ' DEFAULT CURRENT_TIMESTAMP'
      else if (field.hasDefaultValue && ['string', 'number', 'boolean', 'bigint'].includes(typeof field.default)) def = ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default))
      return quote(field.dbName || field.name) + ' ' + type + (field.isRequired ? ' NOT NULL' : '') + def + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) cols.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    if (model.primaryKey?.fields?.length) cols.push('PRIMARY KEY (' + model.primaryKey.fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + cols.join(',') + ')')
  }
  for (const [child, column, parent, target] of [
    ['tenjikai_project', 'userId', '"User"', 'id'],
    ['tenjikai_site_analysis', 'projectId', 'tenjikai_project', 'id'],
    ...['tenjikai_booth_plan', 'tenjikai_creative', 'tenjikai_novelty', 'tenjikai_budget_line', 'tenjikai_document', 'tenjikai_task']
      .map(table => [table, 'projectId', 'tenjikai_project', 'id']),
    ...['tenjikai_booth_element', 'tenjikai_graphic_panel'].map(table => [table, 'planId', 'tenjikai_booth_plan', 'id']),
  ]) await db.$executeRawUnsafe(`ALTER TABLE ${child} ADD FOREIGN KEY (${quote(column)}) REFERENCES ${parent}(${quote(target)}) ON DELETE CASCADE`)
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX tenjikai_booth_element_plan_id_uq ON tenjikai_booth_element("planId",id)')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX tenjikai_document_project_id_uq ON tenjikai_document("projectId",id)')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_graphic_panel ADD CONSTRAINT tenjikai_graphic_panel_element_same_plan_fkey FOREIGN KEY ("planId","elementId") REFERENCES tenjikai_booth_element("planId",id) ON DELETE NO ACTION ON UPDATE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_task ADD CONSTRAINT tenjikai_task_document_same_project_fkey FOREIGN KEY ("projectId","documentId") REFERENCES tenjikai_document("projectId",id) ON DELETE NO ACTION ON UPDATE CASCADE')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX tenjikai_booth_plan_one_selected_uq ON tenjikai_booth_plan("projectId") WHERE selected = true')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_booth_plan ADD CONSTRAINT tenjikai_booth_plan_electric_pair_ck CHECK (("electricYen" IS NULL AND "electricDetail" IS NULL) OR ("electricYen" IS NOT NULL AND "electricYen" >= 0 AND "electricDetail" IS NOT NULL AND char_length("electricDetail") BETWEEN 1 AND 240))')
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User","SystemSetting",tenjikai_project,tenjikai_site_analysis,tenjikai_booth_plan,tenjikai_booth_element,tenjikai_graphic_panel,tenjikai_creative,tenjikai_novelty,tenjikai_budget_line,tenjikai_document,tenjikai_task')
  await db.user.create({ data: { id: actor, email: 'tenjikai-c3a@example.invalid', plan: 'FREE' } })
  session = { user: { id: actor } }; aiWait = null; provider = 0
}
const request = () => new NextRequest('https://example.invalid/api/tenjikai/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  ...engine.SAMPLE_INPUT, expectedActor: actor, clientRequestId: crypto.randomUUID(), operationId: `${Date.now()}.${crypto.randomUUID()}`,
}) })
async function post() { const response = await route.POST(request()); return { status: response.status, body: await response.json() } }
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
      assert.equal(result.body.save?.analysis, 'saved'); assert.equal(result.body.save?.plan, 'saved')
      const saved = await workspaceStore.readFullTenjikaiWorkspace(actor, result.body.projectId, db)
      assert.deepEqual(saved, result.body.workspace)
      assert.equal(saved.revision, '1')
      assert.deepEqual(saved.plans.map(item => item.plan.variant), ['A', 'B', 'C'])
      assert.equal(await db.tenjikaiBoothPlan.count(), 3)
      assert.equal(await db.tenjikaiCreative.count(), 6)
      assert.equal(await db.tenjikaiTask.count(), 10)
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
    const report = { runId: process.env.DOYA_TENJIKAI_C3A_RUN_ID, accepted: true, passed: cases.length, cases,
      scope: 'Actual route, plan tier, Prisma and lifecycle store with owned private PostgreSQL; synthetic session/AI; no external provider or HTTP server',
      sourceHashes: Object.fromEntries([...source, 'scripts/security-regression/verify-tenjikai-c3a-postgres.cjs', 'scripts/security-regression/verify-tenjikai-c3a-postgres.py'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }
    const target = path.join(process.env.DOYA_TENJIKAI_C3A_EVIDENCE_DIR, 'postgres-results-' + report.runId + '.json')
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ target, passed: cases.length }))
  } finally { await Promise.all([db.$disconnect(), locker.$disconnect(), reserver.$disconnect()]) }
})().catch(error => { console.error(error); process.exitCode = 1 })
