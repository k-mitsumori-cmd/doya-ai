const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('src/app/mensetsu/compare/page.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const functions = {}
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['load', 'loadMore', 'loadTemplates'].includes(node.name.getText(ast))) {
    functions[node.name.getText(ast)] = ts.isCallExpression(node.initializer)
      ? node.initializer.arguments[0]
      : node.initializer
  }
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(functions.load && functions.loadMore && functions.loadTemplates)
const compile = (node) => ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function first(response) {
  const state = { candidates: ['stale'], error: null, loading: false, cursor: 'old', total: -1, revision: 'old' }
  const load = vm.runInNewContext(compile(functions.load), {
    requestVersion: { current: 0 }, templateId: 'all', Error,
    fetch: async () => response,
    notifyError: (_, message) => { state.error = message },
    setError: (value) => { state.error = value },
    setLoadingCompare: (value) => { state.loading = value },
    setLoadingMore: () => {},
    setCandidates: (value) => { state.candidates = value },
    setNextCursor: (value) => { state.cursor = value },
    setTotal: (value) => { state.total = value },
    setRevision: (value) => { state.revision = value },
    setCriteria: () => {}, setMedians: () => {},
  })
  await load()
  return state
}

;(async () => {
  const failed = await first(Response.json({ error: '取得失敗' }, { status: 503 }))
  assert.equal(failed.error, '取得失敗')
  assert.equal(failed.candidates.length, 0)
  assert.equal(failed.loading, false)

  const revision = 'a'.repeat(43)
  const success = await first(Response.json({
    template: { criteria: [] }, candidates: [{ id: 'older-first' }], total: 1,
    nextCursor: null, revision, medians: {},
  }))
  assert.equal(success.error, null)
  assert.equal(success.candidates[0].id, 'older-first')
  assert.equal(success.total, 1)
  assert.equal(success.loading, false)

  const state = { candidates: [{ id: 'first' }], error: null, loading: false }
  const loadMore = vm.runInNewContext(compile(functions.loadMore), {
    nextCursor: 'first', loadingMore: false, requestVersion: { current: 0 },
    templateId: 'all', revision, total: 2, candidates: state.candidates,
    URLSearchParams, Error,
    fetch: async () => Response.json({ error: '比較結果が更新されました。最初から読み直してください' }, { status: 409 }),
    notifyError: (_, message) => { state.error = message },
    setError: (value) => { state.error = value },
    setLoadingMore: (value) => { state.loading = value },
    setCandidates: (value) => { state.candidates = value },
    setNextCursor: () => {}, setMedians: () => {},
  })
  await loadMore()
  assert.match(state.error, /更新/)
  assert.equal(state.candidates.length, 1)
  assert.equal(state.loading, false)
  console.log('PASS mensetsu comparison: errors are visible and failed continuation preserves loaded ranks')
})().catch((error) => { console.error(error); process.exitCode = 1 })
