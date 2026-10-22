// Actual route and frozen reader with synthetic session/Prisma. No DB, provider or writes.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript')
const { NextRequest } = req('next/server')
const calls = []
let session, sessionError, rows, dbError

const saved = (id, overrides = {}) => ({
  id, name: '営業部の保存案件', serviceUrl: 'https://example.test', venueId: null,
  eventName: '保存展示会', eventStart: new Date('2026-10-20T15:00:00Z'),
  eventDays: 2, komaCols: 3, komaRows: 3, boothWidthM: 3, boothDepthM: 3,
  boothPosition: 'corner', budgetYen: 100000, goal: '商談', staffCount: 2,
  status: 'done', createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-20T00:00:00Z'), analysis: null, ...overrides,
})

const prisma = new Proxy({}, { get: (_, model) => {
  assert.equal(model, 'tenjikaiProject', 'unexpected DB delegate')
  return new Proxy({}, { get: (_, method) => {
    assert.equal(method, 'findFirst', 'write or extra read forbidden')
    return async input => {
      calls.push(input)
      assert.deepEqual(Object.keys(input.where).sort(), ['id', 'userId'])
      assert.ok(input.select?.analysis?.select?.brandColors)
      if (dbError) throw dbError
      return rows.find(row => row.userId === input.where.userId && row.id === input.where.id)?.value ?? null
    }
  } })
} })

const mocks = {
  'next-auth': { getServerSession: async () => {
    if (sessionError) throw sessionError
    return session
  } },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
}
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  cache.set(file, mod)
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.startsWith('@/')) return load(path.join(root, 'src', id.slice(2) + '.ts'))
    return req(id)
  }
  const source = fs.readFileSync(file, 'utf8')
  mod._compile(ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}
const { GET } = load(path.join(root, 'src/app/api/tenjikai/projects/[id]/route.ts'))

function reset() {
  session = { user: { id: 'actor-a' } }
  sessionError = null
  rows = [{ id: 'own', userId: 'actor-a', value: saved('own') },
    { id: 'foreign', userId: 'actor-b', value: saved('foreign') }]
  dbError = null
  calls.length = 0
}
async function get(id = 'own', expectedActor) {
  const url = new URL('https://example.test/api/tenjikai/projects/' + encodeURIComponent(id))
  if (expectedActor !== undefined) url.searchParams.set('expectedActor', expectedActor)
  const response = await GET(new NextRequest(url), { params: Promise.resolve({ id }) })
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.match(response.headers.get('Vary') ?? '', /(?:^|,\s*)Cookie(?:,|$)/i)
  return { status: response.status, body: await response.json() }
}

test('Tenjikai project detail route: real session, owner, partial and privacy contract', async t => {
  const originalFetch = global.fetch
  global.fetch = async () => { throw new Error('provider/network forbidden') }
  try {
    await t.test('missing session or nonempty actor is 401 and DB0', async () => {
      for (const value of [null, { user: {} }, { user: { id: '' } }, { user: { id: '  ' } }]) {
        reset(); session = value
        assert.deepEqual(await get('own', 'actor-a'), { status: 401, body: { state: 'not_authenticated' } })
        assert.equal(calls.length, 0)
      }
    })
    await t.test('expectedActor is an additional session check, including empty mismatch', async () => {
      for (const actor of ['actor-b', '']) {
        reset()
        assert.deepEqual(await get('own', actor), { status: 409, body: { state: 'actor_mismatch' } })
        assert.equal(calls.length, 0)
      }
    })
    await t.test('missing ID is 404 and DB0', async () => {
      reset()
      assert.deepEqual(await get(''), { status: 404, body: { state: 'not_found' } })
      assert.equal(calls.length, 0)
    })
    await t.test('owner may read past/done row as explicit partial; actorId comes from session', async () => {
      reset()
      const { status, body } = await get('own', 'actor-a')
      assert.equal(status, 200)
      assert.equal(body.actorId, 'actor-a')
      assert.equal(body.state, 'ready_partial')
      assert.equal(body.project.status, 'done')
      assert.equal(body.project.venueId, null)
      assert.deepEqual(body.children, { state: 'not_read' })
      assert.deepEqual(body.partialReasons, ['children_not_read', 'venue_not_saved', 'analysis_not_saved'])
      assert.deepEqual(calls[0].where, { id: 'own', userId: 'actor-a' })
      assert.equal(calls.length, 1)
    })
    await t.test('saved analysis shape passes and invalid JSON stays partial', async () => {
      reset()
      rows[0].value.analysis = { brand: '保存ブランド', category: '保存カテゴリ',
        headline: '見出し', subline: '補足', valueProps: [{ title: '訴求', body: '本文' }],
        targets: ['来場者'], brandColors: { primary: '#111', secondary: '#222', accent: '#333' },
        tone: '丁寧', logoUrl: null }
      const valid = await get()
      assert.equal(valid.status, 200)
      assert.equal(valid.body.analysis.state, 'saved')
      assert.equal(valid.body.analysis.value.brand, '保存ブランド')
      rows[0].value.analysis.valueProps = { bad: true }
      const invalid = await get()
      assert.equal(invalid.status, 200)
      assert.deepEqual(invalid.body.analysis, { state: 'invalid', value: null, invalidFields: ['valueProps'] })
      assert.ok(invalid.body.partialReasons.includes('analysis_invalid'))
      assert.equal(calls.length, 2)
    })
    await t.test('foreign and absent IDs have identical 404 response', async () => {
      reset()
      const foreign = await get('foreign')
      const absent = await get('absent')
      assert.deepEqual(foreign, absent)
      assert.deepEqual(foreign, { status: 404, body: { state: 'not_found' } })
      assert.deepEqual(calls.map(call => call.where.userId), ['actor-a', 'actor-a'])
    })
    await t.test('DB failure and broken saved date are 500, never empty or mock', async () => {
      reset(); dbError = new Error('PRIVATE synthetic DB failure')
      assert.deepEqual(await get(), { status: 500, body: { state: 'error', reason: 'read_failed' } })
      assert.equal(calls.length, 1)
      reset(); rows[0].value.eventStart = new Date('invalid')
      assert.deepEqual(await get(), { status: 500, body: { state: 'error', reason: 'invalid_project' } })
      assert.equal(calls.length, 1)
    })
    await t.test('session failure stays private 500 and DB0', async () => {
      reset(); sessionError = new Error('PRIVATE synthetic session failure')
      assert.deepEqual(await get(), { status: 500, body: { state: 'error', reason: 'read_failed' } })
      assert.equal(calls.length, 0)
    })
  } finally { global.fetch = originalFetch }
})
