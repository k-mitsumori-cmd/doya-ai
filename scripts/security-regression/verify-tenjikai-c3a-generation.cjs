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
    if (id === '@/lib/account-lifecycle/store') return {
      lockLifecycleUsers: async (_tx, ids) => { state.events.push('user_lock'); assert.deepEqual(ids, ['actor-a']) },
      assertLifecycleWritable: async () => { state.events.push('fence'); if (state.fence) throw new SyntheticLifecycleError('Synthetic fence') },
    }
    if (id === '@/lib/account-lifecycle/state') return { LifecycleError: SyntheticLifecycleError }
    if (id === '@/lib/tenjikai/engine') return engine
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
const { POST } = load('src/app/api/tenjikai/generate/route.ts')
const requestId = 'b7d7a6e2-36bf-4c3d-9ec6-1a51afc24175'
function reset(mode) {
  state = { mode, session: { user: { id: 'actor-a' } }, project: null, analysis: null, provider: 0, creates: 0, transactions: 0, events: [], fence: false }
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
  const input = { ...engine.SAMPLE_INPUT, expectedActor: 'actor-a', clientRequestId: requestId, ...overrides }
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
    const result = await engine.requestGeneratedPlan(engine.SAMPLE_INPUT, 'actor-a', requestId)
    assert.equal(result.state, expectedState, name)
    cases.push({ name: `adapter: ${name}`, state: result.state, creates: state.creates, provider: state.provider })
  } finally { global.fetch = originalFetch }
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
  const hashes = Object.fromEntries([...sources].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]))
  console.log(JSON.stringify({ accepted: true, scope: 'Actual generate route; synthetic auth, DB, lifecycle and AI. No external calls.', cases, sourceHashes: hashes }, null, 2))
}
module.exports = { POST, engine, reset, getState: () => state, requestId }
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1 })
