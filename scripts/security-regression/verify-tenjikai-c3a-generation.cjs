// Actual route + actual client adapter. Auth, Prisma and AI are synthetic; no network/provider/database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript')
const { NextRequest } = req('next/server')
const sources = new Set(), cases = []
let state
class SyntheticLifecycleError extends Error { constructor(code, status = 409) { super(code); this.status = status } }
class SyntheticOperationError extends Error { constructor(code, status = 409) { super(code); this.status = status; this.code = code } }

function load(relative) {
  const file = path.join(root, relative)
  sources.add(relative)
  const mod = new Module(file)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = id => {
    if (id === 'next-auth') return { getServerSession: async () => state.session }
    if (id === '@/lib/auth') return { authOptions: {} }
    if (id === '@/lib/prisma') return { prisma: db }
    if (id === '@/lib/plan-limit') return {
      planTierOf: async (userId, tx) => { assert.equal(userId, state.session.user.id); assert.equal(tx, state.tx); state.events.push('tier'); return 'FREE' },
      assertLimitForTier: async (_key, _tier, count) => { state.events.push('quota'); return (await count()) >= 3 ? { ok: false, reason: '上限' } : { ok: true } },
    }
    if (id === '@/lib/tenjikai/ai') return { aiGeneratePlan: async input => {
      state.provider++
      const mode = state.mode
      if (state.aiWait) await state.aiWait
      if (mode === 'ai_failure') throw Error('Synthetic AI failure')
      if (mode === 'retire_during_ai') state.fence = true
      if (mode === 'remove_during_ai') state.project = null
      return { source: 'ai', analysis: engine.analyzeSite(input.serviceUrl), boothCopy: {}, creativeCopy: {} }
    } }
    if (id === '@/lib/tenjikai/generation-operation') return {
      GenerationOperationError: SyntheticOperationError,
      validGenerationOperationId: value => typeof value === 'string' && /^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
      admitGeneration: async (_actor, operationId) => {
        state.transactions++
        if (state.mode === 'db_failure') throw Error('Synthetic DB unavailable')
        state.events.push('user_lock', 'fence')
        if (state.operations.has(operationId)) return { operation: state.operations.get(operationId), claim: null }
        state.events.push('tier', 'quota')
        if (state.mode === 'quota') return { operation: { state: 'missing' }, claim: null, quota: { ok: false, reason: '上限' } }
        state.events.push('create'); state.creates++
        state.project = { id: 'project-a', userId: 'actor-a' }
        state.operation = { operationId, state: 'reserved', projectId: 'project-a', analysis: 'not_saved', dispatchAllowed: true }
        state.operations.set(operationId, state.operation)
        if (state.mode === 'commit_then_p2028') { const error = Error('Synthetic post-commit timeout'); error.code = 'P2028'; throw error }
        return { operation: state.operation, claim: null }
      },
      claimGeneration: async (_actor, operationId) => {
        state.transactions++
        const saved = state.operations.get(operationId)
        if (saved?.state !== 'reserved') return { operation: saved, claim: null }
        state.operation = { ...saved, state: 'claimed', dispatchAllowed: false }
        state.operations.set(operationId, state.operation)
        return { operation: state.operation, claim: { actor: 'actor-a', operationId, projectId: 'project-a', token: 'synthetic-claim' } }
      },
      finalizeGeneration: async (claim, analysis, _db, _now, _provenance, materialized) => {
        state.transactions++
        if (state.fence) throw new SyntheticLifecycleError('Synthetic fence')
        if (!state.project) throw new SyntheticOperationError('PROJECT_CHANGED')
        if (state.mode === 'analysis_failure') throw Error('Synthetic analysis DB failure')
        if (analysis) state.analysis = analysis
        if (analysis && materialized) state.workspace = syntheticWorkspace(materialized)
        state.operation = { ...state.operations.get(claim.operationId), state: analysis ? 'completed' : 'failed', analysis: analysis ? 'saved' : 'not_saved' }
        state.operations.set(claim.operationId, state.operation)
        if (state.mode === 'analysis_unknown') throw Error('Synthetic post-commit analysis uncertainty')
        return { operation: state.operation, committed: true, workspace: state.workspace }
      },
      degradeGeneration: async claim => { state.transactions++; state.operation = { ...state.operations.get(claim.operationId), state: 'degraded', analysis: 'unknown' }; state.operations.set(claim.operationId, state.operation); return { operation: state.operation, committed: true } },
      statusGeneration: async (_actor, operationId) => {
        state.transactions++
        if (state.mode === 'final_unknown') throw Error('Synthetic final ownership read unavailable')
        if (state.fence) throw new SyntheticLifecycleError('Synthetic fence')
        if (!state.project && state.operations.get(operationId)?.projectId) throw new SyntheticOperationError('PROJECT_CHANGED')
        const saved = state.operations.get(operationId)
        return saved?.state === 'claimed' ? { ...saved, state: 'processing' } : saved || { operationId, state: 'missing', projectId: null, analysis: 'not_saved', dispatchAllowed: false }
      },
      cancelGeneration: async (_actor, operationId) => { state.transactions++; state.operation = { ...(state.operations.get(operationId) || { operationId, projectId: null, analysis: 'not_saved' }), state: 'canceled', dispatchAllowed: false }; state.operations.set(operationId, state.operation); return state.operation },
    }
    if (id === '@/lib/account-lifecycle/store') return {
      lockLifecycleUsers: async (_tx, ids) => { state.events.push('user_lock'); assert.deepEqual(ids, ['actor-a']) },
      assertLifecycleWritable: async () => { state.events.push('fence'); if (state.fence) throw new SyntheticLifecycleError('Synthetic fence') },
    }
    if (id === '@/lib/account-lifecycle/state') return { LifecycleError: SyntheticLifecycleError }
    if (id === '@/lib/tenjikai/engine') return engine
    if (id === '@/lib/tenjikai/workspace-store') return { readFullTenjikaiWorkspace: async () => state.workspace }
    if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), id)) + '.ts')
    return req(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}

const db = {
  async $transaction(fn) {
    state.transactions++
    if (state.mode === 'db_failure') throw Error('Synthetic DB unavailable')
    if (state.mode === 'final_unknown' && state.transactions === 3) throw Error('Synthetic final ownership read unavailable')
    const value = await fn(state.tx)
    if (state.mode === 'commit_then_p2028' && state.transactions === 1) { const e = Error('Synthetic post-commit timeout'); e.code = 'P2028'; throw e }
    if (state.mode === 'analysis_unknown' && state.transactions === 2) throw Error('Synthetic analysis commit uncertainty')
    return value
  },
}
const engine = load('src/lib/tenjikai/engine.ts')
function syntheticWorkspace(m) {
  const plans = m.plans.map(({ plan, panels, cost, electric }, pi) => {
    const elements = plan.elements.map((item, order) => ({ ...item, z: item.z ?? 0, dbId: `element-${pi}-${order}`, sortOrder: order }))
    const bySource = new Map(elements.map(item => [item.id, item.dbId]))
    return { dbId: `plan-${pi}`, plan: { ...plan, elements }, cost, electric, elements,
      panels: panels.map((item, order) => ({ ...item, dbId: `panel-${pi}-${order}`,
        elementDbId: bySource.get(item.elementId), sortOrder: order })) }
  })
  const venue = engine.VENUES.find(item => item.id === m.input.venueId)
  return { schemaVersion: 1, actorId: 'actor-a', projectId: 'project-a', revision: '1',
    coverage: { graph: 'saved', images: 'not_saved', documents: 'not_saved', vendors: 'illustrative' },
    input: m.input, venueSnapshot: { code: venue.id, name: venue.name, note: venue.note,
      komaSizeM: venue.komaM, komaPriceYen: venue.komaPriceYen, maxHeightM: venue.maxHeightM, source: 'design_reference' },
    analysis: { ...m.analysis, source: m.source, notice: m.notice, modelId: null },
    projectedVisitors: m.projectedVisitors, selectedVariant: m.selectedVariant, plans,
    creatives: m.creatives.map((item, order) => ({ ...item, dbId: `creative-${order}`, sortOrder: order })),
    novelties: m.novelties.map(({ novelty, quantity, selected }, order) => ({ ...novelty,
      dbId: `novelty-${order}`, quantity, selected, sortOrder: order })),
    budgetLines: m.budgetLines.map((item, order) => ({ ...item, dbId: `budget-${order}`, source: 'ai', status: 'planned' })),
    deadlines: m.deadlines.map((item, order) => ({ ...item, dbId: `deadline-${order}`, done: false, sortOrder: order })),
  }
}
const statusClient = load('src/lib/tenjikai/generation-status-client.ts')
const { POST } = load('src/app/api/tenjikai/generate/route.ts')
const statusRoute = load('src/app/api/tenjikai/generate/status/route.ts')
const requestId = 'b7d7a6e2-36bf-4c3d-9ec6-1a51afc24175'
const operationId = `${Date.now()}.${requestId}`
function reset(mode) {
  state = { mode, session: { user: { id: 'actor-a' } }, project: null, analysis: null, workspace: null, operation: null, operations: new Map(), provider: 0, creates: 0, transactions: 0, events: [], fence: false }
  state.tx = {
    tenjikaiProject: {
      count: async () => state.mode === 'quota' ? 3 : 0,
      create: async () => { state.events.push('create'); state.creates++; state.project = { id: 'project-a', userId: 'actor-a' }; return { id: 'project-a' } },
      findFirst: async ({ where }) => state.project?.id === where.id && state.project.userId === where.userId ? state.project : null,
    },
    tenjikaiSiteAnalysis: {
      create: async ({ data }) => { if (state.mode === 'analysis_failure') throw Error('Synthetic analysis DB failure'); state.analysis = data; return { id: 'analysis-a' } },
      findUnique: async () => state.analysis,
    },
  }
}
async function post(overrides = {}) {
  const input = { ...engine.SAMPLE_INPUT, expectedActor: 'actor-a', clientRequestId: requestId, operationId, ...overrides }
  const response = await POST(new NextRequest('https://example.invalid/api/tenjikai/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }))
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('vary') || '', /Cookie/i)
  return { response, body: await response.json() }
}
async function check(name, mode, expectedStatus, expectedState, overrides = {}) {
  reset(mode)
  const { response, body } = await post(overrides)
  assert.equal(response.status, expectedStatus, name)
  assert.equal(body.state, expectedState, name)
  cases.push({ name, status: response.status, state: body.state, creates: state.creates, provider: state.provider, transactions: state.transactions })
  return body
}
async function adapter(name, mode, expectedState) {
  reset(mode)
  const originalFetch = global.fetch
  global.fetch = async (_url, init) => POST(new NextRequest('https://example.invalid/api/tenjikai/generate', init))
  try {
    const result = await engine.requestGeneratedPlan(engine.SAMPLE_INPUT, 'actor-a', operationId, requestId)
    assert.equal(result.state, expectedState, name)
    cases.push({ name: `adapter: ${name}`, state: result.state, creates: state.creates, provider: state.provider })
  } finally { global.fetch = originalFetch }
}
async function statusGet(id = operationId, expectedActor = 'actor-a') {
  const url = new URL('https://example.invalid/api/tenjikai/generate/status')
  url.searchParams.set('operationId', id); url.searchParams.set('expectedActor', expectedActor)
  const response = await statusRoute.GET(new NextRequest(url))
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('vary') || '', /Cookie/i)
  return { response, body: await response.json() }
}

async function run() {
  let body = await check('success', 'success', 200, 'generated')
  assert.equal(body.projectId, 'project-a'); assert.equal(body.save.analysis, 'saved')
  assert.deepEqual(state.events.slice(0, 5), ['user_lock', 'fence', 'tier', 'quota', 'create'])
  reset('success'); state.session = null
  let unauthorized = await post()
  assert.equal(unauthorized.response.status, 401); assert.equal(unauthorized.body.state, 'rejected')
  assert.equal(state.creates, 0); assert.equal(state.provider, 0)
  cases.push({ name: 'unauthenticated', status: 401, state: 'rejected', creates: 0, provider: 0 })
  reset('success')
  const malformed = await POST(new NextRequest('https://example.invalid/api/tenjikai/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }))
  assert.equal(malformed.status, 400); assert.equal(malformed.headers.get('cache-control'), 'private, no-store'); assert.match(malformed.headers.get('vary') || '', /Cookie/i)
  assert.equal((await malformed.json()).state, 'rejected'); assert.equal(state.creates, 0); assert.equal(state.provider, 0)
  cases.push({ name: 'malformed request JSON', status: 400, state: 'rejected', creates: 0, provider: 0 })
  await check('missing durable operation ID has no server auto-allocation', 'success', 400, 'rejected', { operationId: undefined })
  assert.equal(state.creates, 0); assert.equal(state.provider, 0); assert.equal(state.operations.size, 0)
  await check('malformed durable operation ID has no admission', 'success', 400, 'rejected', { operationId: requestId })
  assert.equal(state.creates, 0); assert.equal(state.provider, 0); assert.equal(state.operations.size, 0)
  await check('quota', 'quota', 429, 'rejected'); assert.equal(state.creates, 0); assert.equal(state.provider, 0)
  await check('database failure', 'db_failure', 503, 'outcome_unknown'); assert.equal(state.provider, 0)
  await check('commit then P2028', 'commit_then_p2028', 503, 'outcome_unknown'); assert.equal(state.creates, 1); assert.equal(state.provider, 0); assert.equal(state.transactions, 1)
  body = await check('AI failure', 'ai_failure', 502, 'generation_failed'); assert.equal(body.projectId, 'project-a')
  body = await check('analysis failure', 'analysis_failure', 200, 'generated'); assert.equal(body.save.analysis, 'unknown')
  body = await check('analysis commit unknown with readback', 'analysis_unknown', 200, 'generated'); assert.equal(body.save.analysis, 'saved')
  body = await check('final ownership read unavailable is unknown', 'final_unknown', 503, 'outcome_unknown'); assert.equal(body.save.project, 'unknown'); assert.equal(body.projectId, null)
  await check('retirement during AI', 'retire_during_ai', 409, 'rejected'); assert.equal(state.analysis, null)
  await check('project removed during AI', 'remove_during_ai', 409, 'rejected'); assert.equal(state.analysis, null)
  for (const date of ['2026-02-31', '2025-02-29', '2026-13-01']) {
    await check(`invalid calendar ${date}`, 'success', 400, 'rejected', { eventStart: date }); assert.equal(state.provider, 0); assert.equal(state.creates, 0)
  }
  await check('valid leap date', 'success', 200, 'generated', { eventStart: '2028-02-29' })
  await check('actor mismatch', 'success', 409, 'rejected', { expectedActor: 'actor-b' }); assert.equal(state.provider, 0); assert.equal(state.creates, 0)
  for (const [mode, expected] of [['success', 'generated'], ['quota', 'rejected'], ['db_failure', 'outcome_unknown'],
    ['commit_then_p2028', 'outcome_unknown'], ['ai_failure', 'generation_failed'], ['analysis_failure', 'generated']]) {
    await adapter(mode, mode, expected)
  }
  reset('success')
  state.operations.set(operationId, { operationId, state: 'completed', projectId: 'project-a', analysis: 'saved', dispatchAllowed: false })
  state.project = { id: 'project-a', userId: 'actor-a' }
  const completedStatus = await statusGet()
  assert.equal(completedStatus.response.status, 200); assert.equal(completedStatus.body.state, 'completed'); assert.equal(state.provider, 0)
  cases.push({ name: 'owned status completed is private and never dispatches', status: 200, state: 'completed', creates: 0, provider: 0 })
  const originalFetch = global.fetch
  global.fetch = async (url, init) => statusRoute.GET(new NextRequest(new URL(url, 'https://example.invalid'), init))
  try {
    const adopted = await statusClient.readGenerationStatus('actor-a', operationId, new AbortController().signal)
    assert.equal(adopted?.state, 'completed')
    cases.push({ name: 'status adapter binds actor and operation', state: adopted.state, creates: 0, provider: 0 })
  } finally { global.fetch = originalFetch }
  const wrongActor = await statusGet(operationId, 'actor-b')
  assert.equal(wrongActor.response.status, 409); assert.equal(state.provider, 0)
  cases.push({ name: 'status expected actor mismatch is private', status: 409, state: wrongActor.body.state, creates: 0, provider: 0 })
  state.session = null
  const missingSession = await statusGet()
  assert.equal(missingSession.response.status, 401); assert.equal(state.provider, 0)
  cases.push({ name: 'status unauthenticated is private', status: 401, state: missingSession.body.state, creates: 0, provider: 0 })
  reset('success')
  const missingOperation = await statusGet()
  assert.equal(missingOperation.response.status, 200, JSON.stringify(missingOperation.body)); assert.equal(missingOperation.body.state, 'missing')
  cases.push({ name: 'status missing never creates or dispatches', status: 200, state: 'missing', creates: 0, provider: 0 })
  const hashes = Object.fromEntries([...sources].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]))
  console.log(JSON.stringify({ accepted: true, scope: 'Actual generate route; synthetic auth, DB, lifecycle and AI. No external calls.', cases, sourceHashes: hashes }, null, 2))
}
module.exports = { POST, statusRoute, engine, reset, getState: () => state, requestId, operationId }
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1 })
