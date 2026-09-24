const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const all = Array.from({ length: 501 }, (_, index) => ({ id: String(index), occurredAt: '2026-09-24T00:00:00.000Z' }));
function callbackSource(path, name) {
  const source = fs.readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer?.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert(initializer, `${name} callback exists`);
  return ts.transpileModule(`this.${name} = ${initializer};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function verify(path, name, config) {
  const code = callbackSource(path, name);
  const state = {
    ready: true, orgSlug: 'org-1',
    activities: [], acts: [], detailActs: [],
    nextCursor: null, actsCursor: null, activitiesCursor: null,
    totalCount: 0, actsTotal: 0, activitiesTotal: 0,
    loadError: null, actsError: null, activitiesError: false,
    requestRef: { current: null }, actsRequest: { current: null }, activitiesRequest: { current: null },
    failOnce: false,
    useCallback: (fn) => fn,
    sfaInit: (_org, init) => init,
    withOrg: (path) => path,
    AbortController, Response, URL, encodeURIComponent,
    fetch: async (path) => {
      if (state.failOnce) {
        state.failOnce = false;
        return Response.json({ error: 'offline' }, { status: 503 });
      }
      const cursor = new URL(path, 'http://local').searchParams.get('cursor');
      const start = cursor ? Number(cursor) : 0;
      return Response.json({ activities: all.slice(start, start + 200), totalCount: all.length,
        nextCursor: start + 200 < all.length ? String(start + 200) : null });
    },
  };
  for (const [setter, field] of Object.entries(config.setters)) {
    state[setter] = (value) => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
  }
  vm.createContext(state);
  vm.runInContext(code, state);
  const call = (cursor) => config.deal ? state[name]('deal-1', cursor) : state[name](cursor);
  await call();
  assert.equal(state[config.list].length, 200);
  const retryCursor = state[config.cursor];
  state.failOnce = true;
  await call(retryCursor);
  assert.equal(state[config.list].length, 200, `${name} keeps the first page after failure`);
  assert.equal(state[config.cursor], retryCursor, `${name} keeps the retry cursor`);
  while (state[config.cursor]) await call(state[config.cursor]);
  assert.equal(state[config.list].length, 501);
  assert.equal(new Set(state[config.list].map((row) => row.id)).size, 501);
}

(async () => {
  await verify('src/app/sfa/[orgSlug]/activities/page.tsx', 'load', {
    list: 'activities', cursor: 'nextCursor', setters: {
      setLoading: 'loading', setLoadError: 'loadError', setActivities: 'activities',
      setNextCursor: 'nextCursor', setTotalCount: 'totalCount', setRetryCursor: 'retryCursor',
    },
  });
  await verify('src/app/sfa/[orgSlug]/tasks/page.tsx', 'loadActs', {
    list: 'acts', cursor: 'actsCursor', setters: {
      setActsLoading: 'actsLoading', setActsError: 'actsError', setActs: 'acts',
      setActsCursor: 'actsCursor', setActsTotal: 'actsTotal', setActsRetryCursor: 'actsRetryCursor',
    },
  });
  await verify('src/app/sfa/[orgSlug]/deals/page.tsx', 'loadActivities', {
    deal: true, list: 'detailActs', cursor: 'activitiesCursor', setters: {
      setActivitiesLoading: 'activitiesLoading', setActivitiesError: 'activitiesError', setDetailActs: 'detailActs',
      setActivitiesCursor: 'activitiesCursor', setActivitiesTotal: 'activitiesTotal', setActivitiesRetryCursor: 'activitiesRetryCursor',
    },
  });
  console.log('PASS SFA activity UIs: all three views reach 501 records and preserve state after a failed continuation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
