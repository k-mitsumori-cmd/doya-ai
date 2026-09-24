const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { load } = require('./load-typescript.cjs')
const helpers = load('src/lib/doyalist/approach-pages.ts')
const source = fs.readFileSync('src/app/doyalist/history/page.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let loadArrow, loadProjectsArrow, loadMoreFunction
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadApproaches' && ts.isCallExpression(node.initializer)) {
    loadArrow = node.initializer.arguments[0]
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadProjects' && ts.isCallExpression(node.initializer)) {
    loadProjectsArrow = node.initializer.arguments[0]
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadMore') loadMoreFunction = node
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(loadArrow && loadProjectsArrow && loadMoreFunction)
const compile = (node) => ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

async function initial(response, tab = 'all', search = '') {
  const state = { approaches: ['previous'], error: '', loading: false, total: -1, cursor: 'old', summary: null, url: '' }
  const loadApproaches = vm.runInNewContext(compile(loadArrow), {
    requestVersion: { current: 0 }, tab, search, URLSearchParams, Error,
    fetch: async (url) => { state.url = url; return response },
    parseApproachPage: helpers.parseApproachPage,
    setApproachesError: (value) => { state.error = value },
    setLoadingApproaches: (value) => { state.loading = value },
    setLoadingMore: () => {},
    setApproaches: (value) => { state.approaches = value },
    setNextCursor: (value) => { state.cursor = value },
    setApproachTotal: (value) => { state.total = value },
    setApproachSummary: (value) => { state.summary = value },
  })
  await loadApproaches()
  return state
}

async function projectList(response) {
  const state = { lists: [], error: '', loading: false }
  const loadProjects = vm.runInNewContext(compile(loadProjectsArrow), {
    fetch: async () => response, Error,
    setProjectsError: (value) => { state.error = value },
    setLoadingProjects: (value) => { state.loading = value },
    setLists: (value) => { state.lists = value },
  })
  await loadProjects()
  return state
}

;(async () => {
  const projectError = await projectList(Response.json({ error: 'private database details' }, { status: 500 }))
  assert.equal(projectError.error, 'リスト履歴を取得できませんでした')
  assert.equal(projectError.lists.length, 0)
  assert.equal(projectError.loading, false)
  const emptyProjects = await projectList(Response.json({ projects: [] }))
  assert.equal(emptyProjects.error, '')
  assert.equal(emptyProjects.lists.length, 0)

  const error = await initial(Response.json({ error: '履歴の取得に失敗しました' }, { status: 503 }))
  assert.equal(error.error, '履歴の取得に失敗しました')
  assert.equal(error.approaches.length, 0)
  assert.equal(error.loading, false)
  assert.equal(error.summary, null)

  const summary = { allTotal: 1, thisMonth: 1, countsByType: { email: 1 } }
  const success = await initial(Response.json({ approaches: [{ id: 'old-id' }], total: 1, nextCursor: null, summary }), 'email', 'old')
  assert.equal(success.error, '')
  assert.equal(success.approaches[0].id, 'old-id')
  assert.equal(success.total, 1)
  assert.equal(success.summary.allTotal, 1)
  assert.ok(success.url.includes('type=email'))
  assert.ok(success.url.includes('search=old'))

  const state = { approaches: [{ id: 'already-loaded' }], error: '', loading: false }
  const loadMore = vm.runInNewContext(compile(loadMoreFunction), {
    nextCursor: 'already-loaded', loadingMore: false, requestVersion: { current: 0 },
    tab: 'all', search: '', URLSearchParams, Error, approachTotal: 2,
    approaches: state.approaches,
    fetch: async () => Response.json({ error: '取得失敗' }, { status: 503 }),
    parseApproachPage: helpers.parseApproachPage,
    appendApproachPage: helpers.appendApproachPage,
    setLoadingMore: (value) => { state.loading = value },
    setApproachesError: (value) => { state.error = value },
    setApproaches: (value) => { state.approaches = value },
    setNextCursor: () => {}, setApproachSummary: () => {},
  })
  await loadMore()
  assert.equal(state.error, '取得失敗')
  assert.equal(state.approaches.length, 1)
  assert.equal(state.loading, false)
  console.log('PASS doyalist history: full-query response, visible errors, failed continuation preserves loaded rows')
})().catch((error) => { console.error(error); process.exitCode = 1 })
