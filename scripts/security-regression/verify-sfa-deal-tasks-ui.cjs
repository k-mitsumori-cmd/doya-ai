const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/sfa/[orgSlug]/deals/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadDetailTasks') callback = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert(callback, 'Deal detail must load tasks independently of the board preview');

const all = Array.from({ length: 501 }, (_, index) => ({ id: String(index), dealId: 'deal-1', status: 'open' }));
const state = {
  ready: true, orgSlug: 'org-1', detailTasks: [], detailTasksPage: 0,
  detailTasksHasMore: false, detailTasksLoading: false, detailTasksError: false, detailTasksRetryPage: 1,
  detailTasksRequest: { current: null }, failOnce: false,
  AbortController, Response, URL, encodeURIComponent,
  sfaInit: (_org, options) => options,
  fetch: async (path) => {
    const url = new URL(path, 'http://local');
    assert.equal(url.searchParams.get('dealId'), 'deal-1');
    if (state.failOnce) { state.failOnce = false; return Response.json({ error: 'offline' }, { status: 503 }); }
    const page = Number(url.searchParams.get('page'));
    const start = (page - 1) * 200;
    return Response.json({ tasks: all.slice(start, start + 200), page, hasMore: start + 200 < all.length });
  },
};
for (const [setter, field] of Object.entries({
  setDetailTasks: 'detailTasks', setDetailTasksPage: 'detailTasksPage',
  setDetailTasksHasMore: 'detailTasksHasMore', setDetailTasksLoading: 'detailTasksLoading',
  setDetailTasksError: 'detailTasksError', setDetailTasksRetryPage: 'detailTasksRetryPage',
})) state[setter] = (value) => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
vm.createContext(state);
const code = ts.transpileModule(`this.loadDetailTasks = ${callback};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInContext(code, state);

(async () => {
  await state.loadDetailTasks('deal-1');
  assert.equal(state.detailTasks.length, 200);
  assert.equal(state.detailTasksPage, 1);
  state.failOnce = true;
  await state.loadDetailTasks('deal-1', 2);
  assert.equal(state.detailTasks.length, 200);
  assert.equal(state.detailTasksPage, 1);
  assert.equal(state.detailTasksRetryPage, 2);
  assert.equal(state.detailTasksError, true);
  await state.loadDetailTasks('deal-1', state.detailTasksRetryPage);
  while (state.detailTasksHasMore) await state.loadDetailTasks('deal-1', state.detailTasksPage + 1);
  assert.equal(state.detailTasks.length, 501);
  assert.equal(new Set(state.detailTasks.map((task) => task.id)).size, 501);
  await state.loadDetailTasks('deal-1');
  assert.equal(state.detailTasks.length, 200, 'Refresh replaces the previous list');
  console.log('PASS SFA deal tasks UI: 501 deal tasks reachable; failed continuation keeps list and retry page');
})().catch((error) => { console.error(error); process.exitCode = 1; });
