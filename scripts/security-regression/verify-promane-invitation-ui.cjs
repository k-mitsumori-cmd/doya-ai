const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('src/components/promane/invite-modal.tsx', 'utf8')
const ast = ts.createSourceFile('invite-modal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const functions = {}
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'parseSentInvitationPage') functions.parse = node
  if (ts.isVariableDeclaration(node) && ['loadSent', 'loadMore'].includes(node.name.getText(ast))) {
    functions[node.name.getText(ast)] = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer
  }
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(functions.parse && functions.loadSent && functions.loadMore)
const compile = (node) => ts.transpileModule(`(${node.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const parse = vm.runInNewContext(compile(functions.parse), { Error, Number })

async function initial(response) {
  const state = { invitations: ['old'], error: '', loading: false, cursor: 'old', total: -1 }
  const loadSent = vm.runInNewContext(compile(functions.loadSent), {
    requestVersion: { current: 0 }, workspaceId: 'own-workspace', URLSearchParams, Error,
    fetch: async () => response, parseSentInvitationPage: parse,
    setHistoryError: (value) => { state.error = value },
    setLoading: (value) => { state.loading = value },
    setLoadingMore: () => {},
    setSentInvitations: (value) => { state.invitations = value },
    setNextCursor: (value) => { state.cursor = value },
    setHistoryTotal: (value) => { state.total = value },
  })
  await loadSent()
  return state
}

;(async () => {
  const failed = await initial(Response.json({ error: '取得できませんでした' }, { status: 503 }))
  assert.equal(failed.error, '取得できませんでした')
  assert.equal(failed.invitations.length, 0)
  assert.equal(failed.loading, false)

  const success = await initial(Response.json({ invitations: [{ id: 'one' }], total: 1, nextCursor: null }))
  assert.equal(success.error, '')
  assert.equal(success.invitations[0].id, 'one')
  assert.equal(success.total, 1)
  assert.equal(success.loading, false)

  const lastPage = parse({ invitations: [{ id: 'last' }], total: 51, nextCursor: null })
  assert.equal(lastPage.invitations[0].id, 'last')

  const state = { invitations: [{ id: 'first' }], error: '', loading: false }
  const loadMore = vm.runInNewContext(compile(functions.loadMore), {
    nextCursor: 'first', loadingMore: false, requestVersion: { current: 0 },
    workspaceId: 'own-workspace', URLSearchParams, Error,
    historyTotal: 51, sentInvitations: state.invitations,
    fetch: async () => Response.json({ error: '取得失敗' }, { status: 503 }),
    parseSentInvitationPage: parse,
    setHistoryError: (value) => { state.error = value },
    setLoadingMore: (value) => { state.loading = value },
    setSentInvitations: (value) => { state.invitations = value },
    setNextCursor: () => {},
  })
  await loadMore()
  assert.equal(state.error, '取得失敗')
  assert.equal(state.invitations.length, 1)
  assert.equal(state.loading, false)
  console.log('PASS promane invitation UI: errors differ from empty and continuation failure preserves history')
})().catch((error) => { console.error(error); process.exitCode = 1 })
