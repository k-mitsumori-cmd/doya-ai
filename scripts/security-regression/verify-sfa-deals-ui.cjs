const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./load-typescript.cjs');

const source = fs.readFileSync('src/app/sfa/[orgSlug]/deals/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
let dealPageGuard;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'isDealPage') dealPageGuard = node.getText(ast);
  if (ts.isVariableDeclaration(node) && ['load', 'loadMore'].includes(node.name.getText(ast))) {
    callbacks[node.name.getText(ast)] = node.initializer.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert(dealPageGuard && callbacks.load && callbacks.loadMore);
const { isSfaSummary } = load('src/lib/sfa/summary.ts');
const summary = { totalCount: 501, openCount: 501, staleCount: 0, openTaskCount: 0, openTotal: '1000000', weighted: '500000', wonTotal: '0' };

function ui({ failSummary = false, failContinuation = false } = {}) {
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: String(index), stageId: 'stage-1', amount: 1, status: 'open' }));
  const context = {
    ready: true, orgSlug: 'org-1', nextCursor: null, dealsLoading: false, loadingMore: false,
    stages: [], deals: [], totalCount: 0, stageSummary: [], summary: null,
    dealsError: false, summaryError: false,
    dealsRequest: { current: null }, moreDealsRequest: { current: null },
    AbortController, Response, Set, encodeURIComponent, isSfaSummary,
    sfaInit: (_slug, options) => options,
    fetch: async (url) => {
      if (url === '/api/sfa/summary') {
        return failSummary ? Response.json({ error: 'offline' }, { status: 503 }) : Response.json({ summary });
      }
      const cursor = new URL(url, 'http://local').searchParams.get('cursor');
      if (cursor && failContinuation) return Response.json({ error: 'offline' }, { status: 503 });
      const start = cursor ? Number(cursor) : 0;
      return Response.json({
        stages: [{ id: 'stage-1' }], deals: rows.slice(start, start + 100),
        nextCursor: start + 100 < rows.length ? String(start + 100) : null,
        totalCount: rows.length,
        stageSummary: [{ stageId: 'stage-1', count: rows.length, total: '1000000' }],
      });
    },
  };
  for (const key of ['Stages', 'Deals', 'NextCursor', 'TotalCount', 'StageSummary', 'Summary',
    'DealsLoading', 'DealsError', 'SummaryError', 'LoadingMore']) {
    const property = key[0].toLowerCase() + key.slice(1);
    context['set' + key] = (value) => {
      context[property] = typeof value === 'function' ? value(context[property]) : value;
    };
  }
  vm.createContext(context);
  const transpile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(transpile(dealPageGuard + '\nthis.isDealPage = isDealPage;'), context);
  const initialLoad = vm.runInContext(transpile('(' + callbacks.load + ')'), context);
  const continuation = () => vm.runInContext(transpile('(' + callbacks.loadMore + ')'), context);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { context, initialLoad, continuation, settle };
}

(async () => {
  const normal = ui();
  normal.initialLoad();
  await normal.settle();
  assert.equal(normal.context.deals.length, 100);
  assert.equal(normal.context.totalCount, 501);
  assert.equal(normal.context.summary.openTotal, '1000000');
  while (normal.context.nextCursor) {
    normal.continuation()();
    await normal.settle();
  }
  assert.equal(normal.context.deals.length, 501);
  assert.equal(new Set(normal.context.deals.map((deal) => deal.id)).size, 501);
  assert.equal(normal.context.dealsError, false);

  const failedSummary = ui({ failSummary: true });
  failedSummary.initialLoad();
  await failedSummary.settle();
  assert.equal(failedSummary.context.deals.length, 100);
  assert.equal(failedSummary.context.summary, null);
  assert.equal(failedSummary.context.summaryError, true);

  const failedMore = ui({ failContinuation: true });
  failedMore.initialLoad();
  await failedMore.settle();
  failedMore.continuation()();
  await failedMore.settle();
  assert.equal(failedMore.context.deals.length, 100);
  assert.equal(failedMore.context.nextCursor, '100');
  assert.equal(failedMore.context.dealsError, true);
  console.log('PASS SFA deals UI: all 501 reachable, DB summary retained, failed summary is not zero, failed continuation preserves page');
})().catch((error) => { console.error(error); process.exitCode = 1; });
