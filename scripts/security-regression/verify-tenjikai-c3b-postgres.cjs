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
const revision = load('src/lib/tenjikai/project-revision.ts')
const generationReceipts = load('src/lib/tenjikai/generation-receipts.ts')
const workspaceStore = load('src/lib/tenjikai/workspace-store.ts')
const workspaceSave = load('src/lib/tenjikai/workspace-save.ts')
const statusRoute = load('src/app/api/tenjikai/generate/status/route.ts')
const quote = value => '"' + value.replaceAll('"', '""') + '"'
async function setup() {
  const info = await db.$queryRawUnsafe("SELECT inet_server_addr() AS address,current_user AS role,current_setting('data_directory') AS folder")
  assert.equal(info[0].address, null); assert.equal(info[0].role, 'doya_tenjikai_c3b'); assert.equal(info[0].folder, folder + '/data')
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
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS tenjikai_booth_element_plan_id_uq ON tenjikai_booth_element("planId",id)')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS tenjikai_document_project_id_uq ON tenjikai_document("projectId",id)')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_graphic_panel ADD CONSTRAINT tenjikai_graphic_panel_element_same_plan_fkey FOREIGN KEY ("planId","elementId") REFERENCES tenjikai_booth_element("planId",id) ON DELETE NO ACTION ON UPDATE CASCADE')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_task ADD CONSTRAINT tenjikai_task_document_same_project_fkey FOREIGN KEY ("projectId","documentId") REFERENCES tenjikai_document("projectId",id) ON DELETE NO ACTION ON UPDATE CASCADE')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX tenjikai_booth_plan_one_selected_uq ON tenjikai_booth_plan("projectId") WHERE selected = true')
  await db.$executeRawUnsafe('ALTER TABLE tenjikai_booth_plan ADD CONSTRAINT tenjikai_booth_plan_electric_pair_ck CHECK (("electricYen" IS NULL AND "electricDetail" IS NULL) OR ("electricYen" IS NOT NULL AND "electricYen" >= 0 AND "electricDetail" IS NOT NULL AND char_length("electricDetail") BETWEEN 1 AND 240))')
}
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User","SystemSetting",tenjikai_project,tenjikai_site_analysis,tenjikai_booth_plan,tenjikai_booth_element,tenjikai_graphic_panel,tenjikai_creative,tenjikai_novelty,tenjikai_budget_line,tenjikai_document,tenjikai_task')
  await db.user.create({ data: { id: actor, email: 'tenjikai-c3b@example.invalid', plan: 'FREE' } })
  session = { user: { id: actor } }; aiWait = null; provider = 0
}
const opId = () => generation.createGenerationOperationId()
const saveOpId = () => `save.${Date.now()}.${crypto.randomUUID()}`
const request = (operationId = opId(), input = engine.SAMPLE_INPUT, expectedActor = actor) => new NextRequest('https://example.invalid/api/tenjikai/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  ...input, expectedActor, clientRequestId: crypto.randomUUID(), operationId,
}) })
async function post(operationId, input, expectedActor) { const response = await route.POST(request(operationId, input, expectedActor)); return { status: response.status, body: await response.json() } }
const saveOpIdAt = time => `save.${time.getTime()}.${crypto.randomUUID()}`
const saveActorHash = who => crypto.createHash('sha256').update(JSON.stringify(who)).digest('hex')
const saveReceiptPrefix = who => `tenjikai-workspace-save:v1:${saveActorHash(who)}:`
const saveOwnerKey = id => `tenjikai-workspace-save-owner:v1:${id}`
const saveReceiptRows = who => db.systemSetting.findMany({ where: { key: { startsWith: saveReceiptPrefix(who) } }, orderBy: { key: 'asc' } })
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
async function waitForLocks(minimum = 2) {
  for (let i = 0; i < 60; i++) {
    const rows = await db.$queryRawUnsafe("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%\"User\"%'")
    if (rows[0].n >= minimum) return rows[0].n
    await sleep(50)
  }
  throw Error(`${minimum} User row-lock waiter(s) not observed`)
}
async function check(name, run) { await reset(); await run(); cases.push(name) }
;(async () => {
  try {
    await setup()
    await check('normal route creates one owned project and one analysis', async () => {
      const result = await post()
      assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.state, 'generated')
      assert.equal(provider, 1); assert.equal(await db.tenjikaiProject.count(), 1); assert.equal(await db.tenjikaiSiteAnalysis.count(), 1)
      assert.equal((await db.tenjikaiProject.findFirst({ where: { userId: actor } })).revision, 1n)
      const projectId = result.body.projectId
      const saved = await workspaceStore.readFullTenjikaiWorkspace(actor, projectId, db)
      assert.deepEqual(JSON.parse(JSON.stringify(saved)), result.body.workspace)
      assert.equal(saved.revision, '1')
      assert.deepEqual(saved.plans.map(item => item.plan.variant), ['A', 'B', 'C'])
      assert.equal(saved.plans.every(item => Number.isInteger(item.electric.amountYen) && item.electric.detail.length > 0), true)
      assert.equal(await db.tenjikaiBoothPlan.count(), 3)
      assert.equal(await db.tenjikaiCreative.count(), 6)
      assert.equal(await db.tenjikaiTask.count(), 10)
    })
    await check('generated full workspace saves variant by CAS with persisted electric snapshot and idempotent replay', async () => {
      const operationId = opId(), result = await post(operationId)
      assert.equal(result.status, 200, JSON.stringify(result.body))
      const projectId = result.body.projectId, saveId = saveOpId()
      const before = result.body.workspace
      const saved = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveId, '1', { variant: 'B' }, db)
      assert.equal(saved.state, 'committed')
      assert.equal(saved.workspace.revision, '2')
      assert.equal(saved.workspace.selectedVariant, 'B')
      const chosen = before.plans.find(item => item.plan.variant === 'B')
      const electric = saved.workspace.budgetLines.find(item => item.sourceLineKey === 'electric')
      assert.deepEqual({ amountYen: electric.amountYen, detail: electric.detail }, chosen.electric)
      assert.deepEqual(await workspaceStore.readFullTenjikaiWorkspace(actor, projectId, db), saved.workspace)
      const replay = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveId, '1', { variant: 'B' }, db)
      assert.deepEqual(replay, saved)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 2n)
      const oldGeneration = await generation.statusGeneration(actor, operationId, db)
      assert.equal(oldGeneration.state, 'superseded')
      assert.equal(oldGeneration.terminalConfirmed, true)
    })
    await check('normalized writer obeys same-plan FK, electric pair check and parent cascade', async () => {
      const result = await post()
      assert.equal(result.status, 200, JSON.stringify(result.body))
      const a = await db.tenjikaiBoothPlan.findFirst({ where: { projectId: result.body.projectId, variant: 'A' }, include: { panels: true } })
      const b = await db.tenjikaiBoothPlan.findFirst({ where: { projectId: result.body.projectId, variant: 'B' }, include: { elements: true } })
      assert.ok(a.panels.length && b.elements.length)
      await assert.rejects(db.$executeRaw`UPDATE tenjikai_graphic_panel SET "elementId" = ${b.elements[0].id} WHERE id = ${a.panels[0].id}`)
      await assert.rejects(db.$executeRaw`UPDATE tenjikai_booth_plan SET "electricDetail" = NULL WHERE id = ${a.id}`)
      assert.ok(await workspaceStore.readFullTenjikaiWorkspace(actor, result.body.projectId, db))
      await db.user.delete({ where: { id: actor } })
      for (const model of ['tenjikaiProject', 'tenjikaiSiteAnalysis', 'tenjikaiBoothPlan', 'tenjikaiBoothElement',
        'tenjikaiGraphicPanel', 'tenjikaiCreative', 'tenjikaiNovelty', 'tenjikaiBudgetLine', 'tenjikaiTask']) {
        assert.equal(await db[model].count(), 0, model)
      }
    })
    await check('two connections race same saved revision; one CAS winner and one unknown-safe rejection', async () => {
      const result = await post(), projectId = result.body.projectId
      assert.equal(result.status, 200)
      const firstId = saveOpId(), secondId = saveOpId()
      const first = workspaceSave.saveTenjikaiWorkspace(actor, projectId, firstId, '1', { variant: 'B' }, db)
      const second = workspaceSave.saveTenjikaiWorkspace(actor, projectId, secondId, '1', { variant: 'C' }, locker)
      const results = await Promise.allSettled([first, second])
      assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
      assert.equal(results.filter(row => row.status === 'rejected').length, 1)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 2n)
      assert.equal((await db.tenjikaiBoothPlan.findMany({ where: { projectId, selected: true } })).length, 1)
      const loserId = results[0].status === 'rejected' ? firstId : secondId
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, loserId, db)).state, 'missing')
      assert.equal((await workspaceSave.cancelMissingWorkspaceSave(actor, loserId, db)).state, 'canceled')
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, loserId, '1', { variant: 'A' }, db))
      const latest = await workspaceStore.readFullTenjikaiWorkspace(actor, projectId, db)
      assert.equal(latest.revision, '2')
      const next = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveOpId(), latest.revision, { budgetYen: latest.input.budgetYen + 1 }, db)
      assert.equal(next.state, 'committed')
      assert.equal(next.workspace.revision, '3')
    })
    await check('save commits novelty selection, budget and completed deadlines as one owned workspace revision', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const before = generated.body.workspace, projectId = generated.body.projectId, saveId = saveOpId()
      const selected = before.novelties.slice(0, 2).map(item => item.id)
      const done = before.deadlines.slice(0, 2).map(item => item.id)
      const budgetYen = before.input.budgetYen + 1234
      const saved = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveId, '1', {
        selectedNoveltyIds: selected, budgetYen, doneDeadlineIds: done,
      }, db)
      assert.equal(saved.state, 'committed'); assert.equal(saved.workspace.revision, '2')
      assert.equal(saved.workspace.input.budgetYen, budgetYen)
      assert.deepEqual(saved.workspace.novelties.filter(item => item.selected).map(item => item.id), selected)
      assert.deepEqual(saved.workspace.deadlines.filter(item => item.done).map(item => item.id), done)
      const line = saved.workspace.budgetLines.find(item => item.sourceLineKey === 'novelty')
      assert.equal(line.amountYen, before.novelties.filter(item => selected.includes(item.id)).reduce((sum, item) => sum + item.unitYen * item.quantity, 0))
      assert.deepEqual(await workspaceStore.readFullTenjikaiWorkspace(actor, projectId, db), saved.workspace)
      assert.deepEqual(await workspaceSave.statusWorkspaceSave(actor, saveId, db), saved)
      assert.equal((await saveReceiptRows(actor)).length, 1)
    })
    for (const [protectedLine, change] of [
      ['build', { source: 'manual' }], ['electric', { status: 'paid' }], ['novelty', { status: 'ordered' }],
    ]) await check(`save rejects protected ${protectedLine} line and rolls back every earlier child write`, async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, saveId = saveOpId()
      const line = await db.tenjikaiBudgetLine.findFirst({ where: { projectId, sourceLineKey: protectedLine } })
      await db.tenjikaiBudgetLine.update({ where: { id: line.id }, data: change })
      const beforePlans = await db.tenjikaiBoothPlan.findMany({ where: { projectId }, orderBy: { variant: 'asc' } })
      const beforeNovelties = await db.tenjikaiNovelty.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
      const beforeBudget = await db.tenjikaiBudgetLine.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
      const patch = protectedLine === 'novelty' ? { selectedNoveltyIds: [generated.body.workspace.novelties[0].id] } : { variant: 'B' }
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveId, '1', patch, db),
        error => error.code === (protectedLine === 'novelty' ? 'BUDGET_CHANGED' : 'PLAN_BUDGET_UNAVAILABLE'))
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 1n)
      assert.deepEqual(await db.tenjikaiBoothPlan.findMany({ where: { projectId }, orderBy: { variant: 'asc' } }), beforePlans)
      assert.deepEqual(await db.tenjikaiNovelty.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }), beforeNovelties)
      assert.deepEqual(await db.tenjikaiBudgetLine.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }), beforeBudget)
      assert.equal((await db.tenjikaiBudgetLine.findUnique({ where: { id: line.id } }))[Object.keys(change)[0]], Object.values(change)[0])
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, saveId, db)).state, 'missing')
    })
    await check('save refuses foreign actor and foreign project child IDs without receipts or mutation', async () => {
      const own = await post(); assert.equal(own.status, 200, JSON.stringify(own.body))
      const foreignActor = 'tenjikai_c3b_foreign'
      await db.user.create({ data: { id: foreignActor, plan: 'FREE' } })
      session = { user: { id: foreignActor } }
      const other = await post(opId(), engine.SAMPLE_INPUT, foreignActor)
      session = { user: { id: actor } }
      assert.equal(other.status, 200, JSON.stringify(other.body))
      const projectId = own.body.projectId, foreignOp = saveOpId()
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(foreignActor, projectId, foreignOp, '1', { variant: 'B' }, db),
        error => error.code === 'PROJECT_NOT_FOUND')
      assert.equal((await workspaceSave.statusWorkspaceSave(foreignActor, foreignOp, db)).state, 'missing')
      const foreignNovelty = await db.tenjikaiNovelty.findFirst({ where: { projectId: other.body.projectId } })
      const foreignTask = await db.tenjikaiTask.findFirst({ where: { projectId: other.body.projectId } })
      await db.tenjikaiNovelty.update({ where: { id: foreignNovelty.id }, data: { sourceNoveltyId: 'foreign_novelty' } })
      await db.tenjikaiTask.update({ where: { id: foreignTask.id }, data: { sourceDeadlineId: 'foreign_deadline' } })
      for (const patch of [{ selectedNoveltyIds: ['foreign_novelty'] }, { doneDeadlineIds: ['foreign_deadline'] }]) {
        const id = saveOpId()
        await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, id, '1', patch, db),
          error => ['NOVELTY_CHANGED', 'DEADLINE_CHANGED'].includes(error.code))
        assert.equal((await workspaceSave.statusWorkspaceSave(actor, id, db)).state, 'missing')
      }
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 1n)
      assert.equal((await saveReceiptRows(actor)).length, 0)
      assert.equal((await saveReceiptRows(foreignActor)).length, 0)
    })
    await check('save orphan owner and changed intent fail closed before graph mutation', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, orphan = saveOpId()
      await db.systemSetting.create({ data: { key: saveOwnerKey(orphan), value: saveActorHash(actor) } })
      await assert.rejects(workspaceSave.statusWorkspaceSave(actor, orphan, db), error => error.code === 'OWNER_INDEX_ORPHAN')
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, orphan, '1', { variant: 'B' }, db),
        error => error.code === 'OWNER_INDEX_ORPHAN')
      const receiptOnly = saveOpId()
      await db.systemSetting.create({ data: { key: saveReceiptPrefix(actor) + receiptOnly, value: JSON.stringify({
        version: 1, actorHash: saveActorHash(actor), operationId: receiptOnly, projectId: null, digest: null,
        expectedRevision: null, resultRevision: null, phase: 'canceled', createdAt: new Date().toISOString(),
      }) } })
      await assert.rejects(workspaceSave.statusWorkspaceSave(actor, receiptOnly, db), error => error.code === 'OWNER_INDEX_ORPHAN')
      const foreignOwner = saveOpId()
      await db.systemSetting.create({ data: { key: saveOwnerKey(foreignOwner), value: saveActorHash('another_actor') } })
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, foreignOwner, '1', { variant: 'B' }, db),
        error => error.code === 'FOREIGN_OPERATION')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 1n)
      const id = saveOpId()
      const committed = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, id, '1', { variant: 'B' }, db)
      assert.equal(committed.state, 'committed')
      const receipt = (await saveReceiptRows(actor)).find(row => row.key.endsWith(':' + id))
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, id, '1', { variant: 'C' }, db),
        error => error.code === 'OPERATION_CHANGED')
      assert.equal((await db.systemSetting.findUnique({ where: { key: receipt.key } })).value, receipt.value)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 2n)
      assert.equal((await workspaceStore.readFullTenjikaiWorkspace(actor, projectId, db)).selectedVariant, 'B')
    })
    await check('save expires new IDs at 24 hours but preserves a committed replay', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, now = new Date('2026-10-22T12:00:00.000Z')
      const expired = saveOpIdAt(new Date(now.getTime() - 86_400_000))
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, expired, '1', { variant: 'B' }, db, now),
        error => error.code === 'OPERATION_EXPIRED')
      const valid = saveOpIdAt(new Date(now.getTime() - 86_400_000 + 1000))
      const committed = await workspaceSave.saveTenjikaiWorkspace(actor, projectId, valid, '1', { variant: 'B' }, db, now)
      assert.equal(committed.state, 'committed')
      assert.deepEqual(await workspaceSave.saveTenjikaiWorkspace(actor, projectId, valid, '1', { variant: 'B' }, db,
        new Date(now.getTime() + 86_400_000)), committed)
      assert.equal((await saveReceiptRows(actor)).length, 1)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 2n)
    })
    await check('save capacity refuses new save and cancellation while retaining 512 valid tombstones', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const now = new Date('2026-10-22T12:00:00.000Z'), rows = []
      for (let n = 0; n < 512; n++) {
        const id = saveOpIdAt(now), owner = saveActorHash(actor)
        rows.push({ key: saveOwnerKey(id), value: owner }, { key: saveReceiptPrefix(actor) + id,
          value: JSON.stringify({ version: 1, actorHash: owner, operationId: id, projectId: null, digest: null,
            expectedRevision: null, resultRevision: null, phase: 'canceled', createdAt: now.toISOString() }) })
      }
      await db.systemSetting.createMany({ data: rows })
      const next = saveOpIdAt(now)
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, generated.body.projectId, next, '1', { variant: 'B' }, db, now),
        error => error.code === 'RECEIPT_CAPACITY_UNKNOWN')
      await assert.rejects(workspaceSave.cancelMissingWorkspaceSave(actor, next, db, now),
        error => error.code === 'RECEIPT_CAPACITY_UNKNOWN')
      assert.equal((await saveReceiptRows(actor)).length, 512)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: generated.body.projectId } })).revision, 1n)
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, next, db)).state, 'missing')
    })
    await check('save thirty-day retention removes only old receipt and owner on next admission', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, old = new Date('2026-09-01T12:00:00.000Z')
      const oldId = saveOpIdAt(old)
      assert.equal((await workspaceSave.saveTenjikaiWorkspace(actor, projectId, oldId, '1', { variant: 'B' }, db, old)).state, 'committed')
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, oldId, db)).state, 'committed')
      const now = new Date('2026-10-22T12:00:00.000Z'), fresh = saveOpIdAt(now)
      assert.equal((await workspaceSave.saveTenjikaiWorkspace(actor, projectId, fresh, '2', { variant: 'C' }, db, now)).state, 'committed')
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, oldId, db)).state, 'missing')
      assert.equal(await db.systemSetting.findUnique({ where: { key: saveOwnerKey(oldId) } }), null)
      assert.equal((await saveReceiptRows(actor)).length, 1)
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, fresh, db)).state, 'committed')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 3n)
    })
    await check('missing save cancellation tombstones a delayed POST on another connection', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, id = saveOpId()
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, id, db)).state, 'missing')
      const entered = defer(), release = defer()
      const holdingDb = { $transaction: (work, options) => db.$transaction(async tx => {
        const result = await work(tx)
        entered.resolve(); await release.promise
        return result
      }, options) }
      const canceling = workspaceSave.cancelMissingWorkspaceSave(actor, id, holdingDb)
      await entered.promise
      const delayed = workspaceSave.saveTenjikaiWorkspace(actor, projectId, id, '1', { variant: 'B' }, locker)
      try { assert(await waitForLocks(1) >= 1) } finally { release.resolve() }
      assert.equal((await canceling).state, 'canceled')
      await assert.rejects(delayed, error => error.code === 'OPERATION_CHANGED')
      assert.equal((await workspaceSave.statusWorkspaceSave(actor, id, db)).state, 'canceled')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 1n)
      assert.equal((await saveReceiptRows(actor)).length, 1)
    })
    await check('retirement fence before save rejects; saved receipt is purged before owned User deletion', async () => {
      const generated = await post(); assert.equal(generated.status, 200, JSON.stringify(generated.body))
      const projectId = generated.body.projectId, committedId = saveOpId()
      assert.equal((await workspaceSave.saveTenjikaiWorkspace(actor, projectId, committedId, '1', { variant: 'B' }, db)).state, 'committed')
      await store.reserveLifecycleOperation(reserver, identity(), digest)
      await assert.rejects(workspaceSave.saveTenjikaiWorkspace(actor, projectId, saveOpId(), '2', { variant: 'C' }, locker))
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: projectId } })).revision, 2n)
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`
        await workspaceSave.purgeWorkspaceSaveReceipts(tx, actor)
        await generationReceipts.purgeGenerationReceipts(tx, actor)
        await tx.user.delete({ where: { id: actor } })
      })
      assert.equal((await saveReceiptRows(actor)).length, 0)
      assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'tenjikai-workspace-save-owner:v1:' } } }), 0)
      assert.equal(await db.tenjikaiProject.count(), 0)
      await assert.rejects(workspaceSave.statusWorkspaceSave(actor, committedId, db))
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
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      assert.equal(project.revision, 0n); assert.equal(project.planningVenueCode, engine.SAMPLE_INPUT.venueId)
      assert.equal(project.planningVenueSource, 'design_reference'); assert.equal(project.venueId, null)
      const seen = await status(id); assert.equal(seen.body.state, 'reserved'); assert.equal(seen.body.dispatchAllowed, true)
      const result = await post(id); assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(provider, 1)
      const raw = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const receipt = JSON.parse(raw.value); assert.equal(receipt.version, 2); assert.equal(receipt.baseRevision, '0'); assert.equal(receipt.resultRevision, '1')
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
    await check('same expected revision permits one committed child edit and rejects stale parent edit', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      const saved = await db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        await tx.tenjikaiSiteAnalysis.update({ where: { projectId: project.id }, data: { headline: '保存済み編集' } })
        return revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      })
      assert.equal(saved, '2')
      await assert.rejects(db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        await tx.tenjikaiProject.update({ where: { id: project.id }, data: { eventName: '古い親編集' } })
      }), error => error.code === 'REVISION_CONFLICT')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 2n)
      assert.equal((await db.tenjikaiSiteAnalysis.findUnique({ where: { projectId: project.id } })).headline, '保存済み編集')
    })
    await check('parent edit advances revision and rejects a stale child edit', async () => {
      assert.equal((await post(opId())).status, 200)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      await db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        await tx.tenjikaiProject.update({ where: { id: project.id }, data: { name: '親の新しい名称' } })
        await revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      })
      await assert.rejects(db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        await tx.tenjikaiSiteAnalysis.update({ where: { projectId: project.id }, data: { headline: '古い子編集' } })
      }), error => error.code === 'REVISION_CONFLICT')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 2n)
      assert.notEqual((await db.tenjikaiSiteAnalysis.findUnique({ where: { projectId: project.id } })).headline, '古い子編集')
    })
    await check('editor revision during synthetic AI makes late finalize superseded without another provider call', async () => {
      const id = opId(), gate = defer(); aiWait = gate.promise
      const pending = post(id)
      for (let n = 0; n < 60 && provider === 0; n++) await sleep(50)
      assert.equal(provider, 1)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      await db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '0')
        await tx.tenjikaiProject.update({ where: { id: project.id }, data: { name: '別操作の編集' } })
        await revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      })
      gate.resolve()
      const result = await pending
      assert.equal(result.status, 409, JSON.stringify(result)); assert.equal(result.body.state, 'rejected')
      assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
      assert.equal((await status(id)).body.state, 'superseded')
      assert.equal((await post(id)).status, 409); assert.equal(provider, 1)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 1n)
    })
    await check('lost finalize response recovers completed without second revision or degradation', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const claimed = await generation.claimGeneration(actor, id, engine.SAMPLE_INPUT, db); assert(claimed.claim)
      const lost = { $transaction: async (...args) => { await db.$transaction(...args); throw Error('synthetic response lost after commit') } }
      await assert.rejects(generation.finalizeGeneration(claimed.claim, engine.analyzeSite(engine.SAMPLE_INPUT.serviceUrl), lost), /synthetic response lost/)
      assert.equal((await status(id)).body.state, 'completed')
      const degraded = await generation.degradeGeneration(claimed.claim, db)
      assert.equal(degraded.committed, false); assert.equal(degraded.operation.state, 'completed')
      assert.equal((await db.tenjikaiProject.findFirst({ where: { userId: actor } })).revision, 1n)
      assert.equal(await db.tenjikaiSiteAnalysis.count(), 1); assert.equal(provider, 0)
    })
    await check('two PostgreSQL connections with one expected revision commit exactly one graph edit', async () => {
      assert.equal((await post(opId())).status, 200)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      const held = defer(), release = defer()
      const blocker = locker.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`
        held.resolve(); await release.promise
      }, { maxWait: 10000, timeout: 20000 })
      await held.promise
      const edit = (client, label) => client.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        await tx.tenjikaiSiteAnalysis.update({ where: { projectId: project.id }, data: { headline: label } })
        return revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
      const first = edit(db, 'editor A'), second = edit(reserver, 'editor B')
      const waiters = await waitForLocks()
      release.resolve(); await blocker
      const outcomes = await Promise.allSettled([first, second])
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1, JSON.stringify(outcomes))
      assert.equal(outcomes.filter(x => x.status === 'rejected' && x.reason.code === 'REVISION_CONFLICT').length, 1, JSON.stringify(outcomes))
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 2n)
      cases.push(`revision race observed ${waiters} PostgreSQL User lock waiters`)
    })
    await check('revision above JS safe integer survives decimal-string roundtrip and rollback', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      await db.$executeRaw`UPDATE tenjikai_project SET revision = 9007199254740993 WHERE id = ${project.id}`
      const next = await db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '9007199254740993')
        return revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      })
      assert.equal(next, '9007199254740994')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 9007199254740994n)
      await assert.rejects(db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, next)
        await tx.tenjikaiSiteAnalysis.update({ where: { projectId: project.id }, data: { headline: 'rollback marker' } })
        await revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
        throw Error('synthetic rollback')
      }), /synthetic rollback/)
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 9007199254740994n)
      assert.notEqual((await db.tenjikaiSiteAnalysis.findUnique({ where: { projectId: project.id } })).headline, 'rollback marker')
    })
    await check('legacy v1 reserved receipt cannot create a new provider claim', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const row = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const old = JSON.parse(row.value); delete old.baseRevision; delete old.resultRevision; old.version = 1
      await db.systemSetting.update({ where: { key: row.key }, data: { value: JSON.stringify(old) } })
      const result = await post(id)
      assert.equal(result.status, 409, JSON.stringify(result)); assert.equal(provider, 0)
      assert.equal((await status(id)).body.dispatchAllowed, false)
    })
    await check('legacy v1 claimed receipt cannot be finalized by the new revision writer', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const claimed = await generation.claimGeneration(actor, id, engine.SAMPLE_INPUT, db); assert(claimed.claim)
      const row = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const old = JSON.parse(row.value); delete old.baseRevision; delete old.resultRevision; old.version = 1
      await db.systemSetting.update({ where: { key: row.key }, data: { value: JSON.stringify(old) } })
      await assert.rejects(generation.finalizeGeneration(claimed.claim, engine.analyzeSite(engine.SAMPLE_INPUT.serviceUrl), db), error => error.code === 'LEGACY_OPERATION_REQUIRES_REVIEW')
      assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
      assert.equal((await db.tenjikaiProject.findFirst({ where: { userId: actor } })).revision, 0n)
      assert.equal(provider, 0)
    })
    await check('legacy v1 reserved cancel blocks delayed provider dispatch', async () => {
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const row = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const old = JSON.parse(row.value); delete old.baseRevision; delete old.resultRevision; old.version = 1
      await db.systemSetting.update({ where: { key: row.key }, data: { value: JSON.stringify(old) } })
      assert.equal((await cancel(id)).body.state, 'canceled')
      assert.equal((await post(id)).status, 202); assert.equal(provider, 0)
    })
    await check('malformed v2 receipt and invalid revision strings fail closed', async () => {
      for (const invalid of ['-1', '01', '1.0', '9223372036854775808']) {
        assert.throws(() => revision.parseTenjikaiRevision(invalid), error => error.code === 'INVALID_REVISION')
      }
      const id = opId(); await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db)
      const row = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const malformed = JSON.parse(row.value); malformed.baseRevision = null
      await db.systemSetting.update({ where: { key: row.key }, data: { value: JSON.stringify(malformed) } })
      assert.equal((await status(id)).status, 409)
      assert.equal((await post(id)).status, 409); assert.equal(provider, 0)
      assert.equal(await db.tenjikaiSiteAnalysis.count(), 0)
    })
    await check('revision ceiling refuses a business mutation without partial write', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      await db.$executeRaw`UPDATE tenjikai_project SET revision = 9223372036854775807 WHERE id = ${project.id}`
      await assert.rejects(db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '9223372036854775807')
        await tx.tenjikaiSiteAnalysis.update({ where: { projectId: project.id }, data: { headline: 'overflow marker' } })
      }), error => error.code === 'REVISION_EXHAUSTED')
      assert.equal((await db.tenjikaiProject.findUnique({ where: { id: project.id } })).revision, 9223372036854775807n)
      assert.notEqual((await db.tenjikaiSiteAnalysis.findUnique({ where: { projectId: project.id } })).headline, 'overflow marker')
    })
    await check('same and backward wall clock cannot decrease project revision', async () => {
      const now = new Date(), id = generation.createGenerationOperationId(now)
      await generation.admitGeneration(actor, id, engine.SAMPLE_INPUT, db, now)
      const claimed = await generation.claimGeneration(actor, id, engine.SAMPLE_INPUT, db, now); assert(claimed.claim)
      const earlier = new Date(now.getTime() - 1000)
      const settled = await generation.finalizeGeneration(claimed.claim, engine.analyzeSite(engine.SAMPLE_INPUT.serviceUrl), db, earlier)
      assert.equal(settled.committed, true); assert.equal(settled.operation.state, 'completed')
      const project = await db.tenjikaiProject.findFirst({ where: { userId: actor } })
      const next = await db.$transaction(async tx => {
        await revision.lockTenjikaiActor(tx, actor)
        const expected = await revision.lockOwnedTenjikaiRevision(tx, actor, project.id, '1')
        return revision.advanceTenjikaiRevision(tx, actor, project.id, expected)
      })
      assert.equal(next, '2'); assert.equal(provider, 0)
    })
    await check('legacy v1 completed receipt remains readable as partial history', async () => {
      const id = opId(); assert.equal((await post(id)).status, 200)
      const row = await db.systemSetting.findFirst({ where: { key: { startsWith: 'tenjikai-generate:v1:' } } })
      const old = JSON.parse(row.value); delete old.baseRevision; delete old.resultRevision; old.version = 1
      await db.systemSetting.update({ where: { key: row.key }, data: { value: JSON.stringify(old) } })
      const seen = await status(id)
      assert.equal(seen.status, 200); assert.equal(seen.body.state, 'completed'); assert.equal(seen.body.analysis, 'saved')
      assert.equal((await post(id)).status, 202); assert.equal(provider, 1)
    })
    const report = { runId: process.env.DOYA_TENJIKAI_C3B_RUN_ID, accepted: true, passed: cases.length, cases,
      scope: 'Actual route, plan tier, Prisma and lifecycle store with owned private PostgreSQL; synthetic session/AI; no external provider or HTTP server',
      generatedClient: { resolvedPath: fs.realpathSync(req.resolve('@prisma/client')), dmmfSha256: crypto.createHash('sha256').update(JSON.stringify(Prisma.dmmf.datamodel.models)).digest('hex') },
      sourceHashes: Object.fromEntries([...source, 'prisma/schema.prisma', 'prisma/manual-migrations/2026-10-22-tenjikai-workspace-revision.sql', 'prisma/manual-migrations/2026-10-22-tenjikai-electric-snapshot.sql', 'scripts/security-regression/verify-tenjikai-c3b2-migration.py', 'scripts/security-regression/verify-tenjikai-c3c-migration.py', 'scripts/security-regression/verify-tenjikai-c3b-postgres.cjs', 'scripts/security-regression/verify-tenjikai-c3b-postgres.py'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }
    const target = path.join(process.env.DOYA_TENJIKAI_C3B_EVIDENCE_DIR, 'postgres-results-' + report.runId + '.json')
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ target, passed: cases.length }))
  } finally { await Promise.all([db.$disconnect(), locker.$disconnect(), reserver.$disconnect()]) }
})().catch(error => { console.error(error); process.exitCode = 1 })
