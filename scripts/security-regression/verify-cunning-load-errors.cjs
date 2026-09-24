const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function getLoader(file, name, context) {
  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(initializer, `${file}: ${name} not found`)
  const callback = ts.isCallExpression(initializer) ? initializer.arguments[0] : initializer
  const js = ts.transpileModule(`(${callback.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(js, { ...context, Error, Array, fetch: context.fetch })
}

async function checkList(response) {
  const state = { bases: ['previous'], loading: false, error: false }
  const load = getLoader('src/app/cunning/knowledge/page.tsx', 'load', {
    loadRequest: { current: 0 },
    fetch: async () => response,
    setLoading: (value) => { state.loading = value },
    setLoadError: (value) => { state.error = value },
    setBases: (value) => { state.bases = value },
  })
  await load()
  return state
}

async function checkDetail(response) {
  const state = { base: { id: 'previous' }, loading: false, error: false, notFound: false }
  const load = getLoader('src/app/cunning/knowledge/[id]/page.tsx', 'load', {
    id: 'own-base', loadRequest: { current: 0 },
    fetch: async () => response,
    setLoading: (value) => { state.loading = value },
    setLoadError: (value) => { state.error = value },
    setNotFound: (value) => { state.notFound = value },
    setBase: (value) => { state.base = value },
  })
  await load()
  return state
}

async function checkToolList(name, endpoint, response) {
  const state = { items: ['previous'], error: false }
  const loader = getLoader('src/app/cunning/Tool.tsx', name, {
    usageRequest: { current: 1 }, knowledgeRequest: { current: 0 }, sessionsRequest: { current: 0 },
    fetch: async (url) => { assert.equal(url, endpoint); return response },
    setKbError: (value) => { state.error = value },
    setSessionsError: (value) => { state.error = value },
    setKbs: (value) => { state.items = value },
    setSessions: (value) => { state.items = value },
  })
  loader()
  await new Promise(setImmediate)
  return state
}

;(async () => {
  const failure = Response.json({ error: 'down' }, { status: 503 })
  assert.deepEqual(await checkList(failure), { bases: ['previous'], loading: false, error: true })
  assert.deepEqual(await checkList(Response.json({})), { bases: ['previous'], loading: false, error: true })
  assert.deepEqual(await checkList(Response.json({ bases: [] })), { bases: [], loading: false, error: false })

  const detailFailure = await checkDetail(failure)
  assert.equal(detailFailure.error, true)
  assert.equal(detailFailure.notFound, false)
  assert.equal(detailFailure.loading, false)
  const detailMissing = await checkDetail(Response.json({ error: 'not found' }, { status: 404 }))
  assert.equal(detailMissing.notFound, true)
  assert.equal(detailMissing.error, false)
  assert.equal(detailMissing.base, null)
  const detailSuccess = await checkDetail(Response.json({ base: { id: 'own-base', chunks: [] } }))
  assert.equal(detailSuccess.base.id, 'own-base')
  assert.equal(detailSuccess.error, false)

  const knowledgeFailure = await checkToolList('loadKnowledge', '/api/cunning/knowledge', failure)
  assert.equal(knowledgeFailure.error, true)
  assert.deepEqual(knowledgeFailure.items, ['previous'])
  const sessionsFailure = await checkToolList('loadSessions', '/api/cunning/sessions', failure)
  assert.equal(sessionsFailure.error, true)
  assert.deepEqual(sessionsFailure.items, ['previous'])
  const sessionsEmpty = await checkToolList('loadSessions', '/api/cunning/sessions', Response.json({ sessions: [] }))
  assert.equal(sessionsEmpty.error, false)
  assert.deepEqual(sessionsEmpty.items, [])
  console.log('PASS cunning load errors: failures, missing records, and empty lists stay distinct')
})().catch((error) => { console.error(error); process.exitCode = 1 })
