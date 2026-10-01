const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { load } = require('./load-typescript.cjs')
const helpers = load('src/lib/doyalist/approach-pages.ts')
const projectHelpers = load('src/lib/doyalist/project-pages.ts')
const source = fs.readFileSync('src/app/doyalist/history/page.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let loadArrow, loadProjectsArrow, loadMoreFunction, loadMoreProjectsFunction
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadApproaches' && ts.isCallExpression(node.initializer)) {
    loadArrow = node.initializer.arguments[0]
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadProjects' && ts.isCallExpression(node.initializer)) {
    loadProjectsArrow = node.initializer.arguments[0]
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadMore') loadMoreFunction = node
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadMoreProjects') loadMoreProjectsFunction = node
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(loadArrow && loadProjectsArrow && loadMoreFunction && loadMoreProjectsFunction)
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

async function projectList(response, search = '') {
  const state = { lists: [], error: '', loading: false, total: 0, cursor: null, summary: null, url: '' }
  const loadProjects = vm.runInNewContext(compile(loadProjectsArrow), {
    projectRequestVersion: { current: 0 }, search, URLSearchParams, Error,
    fetch: async (url) => { state.url = url; return response },
    parseProjectPage: projectHelpers.parseProjectPage,
    setProjectsError: (value) => { state.error = value },
    setLoadingProjects: (value) => { state.loading = value },
    setLoadingMoreProjects: () => {},
    setLists: (value) => { state.lists = value },
    setProjectTotal: (value) => { state.total = value },
    setProjectNextCursor: (value) => { state.cursor = value },
    setProjectSummary: (value) => { state.summary = value },
  })
  await loadProjects()
  return state
}

;(async () => {
  const projectError = await projectList(Response.json({ error: 'private database details' }, { status: 500 }))
  assert.equal(projectError.error, 'リスト履歴を取得できませんでした')
  assert.equal(projectError.lists.length, 0)
  assert.equal(projectError.loading, false)
  const emptyProjects = await projectList(Response.json({ projects: [], total: 0, nextCursor: null, summary: { allTotal: 0, thisMonth: 0, totalCompanies: 0 } }))
  assert.equal(emptyProjects.error, '')
  assert.equal(emptyProjects.lists.length, 0)
  assert.ok(emptyProjects.url.includes('limit=50'))
  const searchedProjects = await projectList(Response.json({ projects: [{ id: 'list' }], total: 1, nextCursor: null, summary: { allTotal: 2, thisMonth: 1, totalCompanies: 10 } }), '東京')
  assert.ok(searchedProjects.url.includes('search=%E6%9D%B1%E4%BA%AC'))
  assert.equal(searchedProjects.summary.allTotal, 2)
  assert.equal(searchedProjects.lists[0].id, 'list')
  const projectSummary = { allTotal: 51, thisMonth: 3, totalCompanies: 200 }
  const firstProjectPage = projectHelpers.parseProjectPage({
    projects: Array.from({ length: 50 }, (_, index) => ({ id: `project-${index}` })),
    total: 51, nextCursor: 'project-49', summary: projectSummary,
  })
  const finalProjectPage = projectHelpers.parseProjectPage({
    projects: [{ id: 'project-50' }], total: 51, nextCursor: null, summary: projectSummary,
  })
  assert.equal(projectHelpers.appendProjectPage(firstProjectPage.projects, finalProjectPage, 51).length, 51)
  assert.throws(() => projectHelpers.appendProjectPage(firstProjectPage.projects, {
    ...finalProjectPage, projects: [{ id: 'project-49' }],
  }, 51))
  assert.throws(() => projectHelpers.parseProjectPage({ projects: [], total: 51, nextCursor: null, summary: projectSummary }))

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
  const projectsState = { lists: [{ id: 'already-loaded' }], error: '', loading: false }
  const loadMoreProjects = vm.runInNewContext(compile(loadMoreProjectsFunction), {
    projectNextCursor: 'already-loaded', loadingMoreProjects: false, projectRequestVersion: { current: 0 },
    search: '', URLSearchParams, Error, projectTotal: 2, lists: projectsState.lists,
    fetch: async () => Response.json({ error: '取得失敗' }, { status: 503 }),
    parseProjectPage: projectHelpers.parseProjectPage,
    appendProjectPage: projectHelpers.appendProjectPage,
    setLoadingMoreProjects: (value) => { projectsState.loading = value },
    setProjectsError: (value) => { projectsState.error = value },
    setLists: (value) => { projectsState.lists = value },
    setProjectNextCursor: () => {}, setProjectSummary: () => {},
  })
  await loadMoreProjects()
  assert.equal(projectsState.error, '取得失敗')
  assert.equal(projectsState.lists.length, 1)
  assert.equal(projectsState.loading, false)
  console.log('PASS doyalist history: paged projects and approaches, visible errors, failed continuation preserves loaded rows')
})().catch((error) => { console.error(error); process.exitCode = 1 })
