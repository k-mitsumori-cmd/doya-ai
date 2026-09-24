const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/sfa/[orgSlug]/leads/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loadMoreSource = null;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadMore') loadMoreSource = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert(loadMoreSource, 'Lead list must offer continuation');
const code = ts.transpileModule(`this.loadMore = ${loadMoreSource};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const all = Array.from({ length: 501 }, (_, index) => ({ id: String(index), score: 100 - index }));
function fixture(fail = false) {
  const context = {
    nextCursor: '200', moreLoading: false, moreError: false, leads: all.slice(0, 200),
    filter: 'all', q: '', orgSlug: 'org-1', requestVersion: { current: 1 },
    URLSearchParams, Set,
    sfaInit: (_slug, init) => init,
    fetch: async (url) => {
      const cursor = new URL(url, 'http://local').searchParams.get('cursor');
      if (fail) return Response.json({ error: 'offline' }, { status: 503 });
      const start = Number(cursor);
      return Response.json({ leads: all.slice(start, start + 200), nextCursor: start + 200 < all.length ? String(start + 200) : null });
    },
  };
  for (const key of ['Leads', 'NextCursor', 'MoreLoading', 'MoreError']) {
    const prop = key[0].toLowerCase() + key.slice(1);
    context['set' + key] = (value) => { context[prop] = typeof value === 'function' ? value(context[prop]) : value; };
  }
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}
(async () => {
  const normal = fixture();
  while (normal.nextCursor) await normal.loadMore();
  assert.equal(normal.leads.length, 501);
  assert.equal(new Set(normal.leads.map((row) => row.id)).size, 501);
  const failed = fixture(true);
  await failed.loadMore();
  assert.equal(failed.leads.length, 200);
  assert.equal(failed.nextCursor, '200');
  assert.equal(failed.moreError, true);
  console.log('PASS SFA leads UI: 501 records reachable; failed next page preserves current list and retry cursor');
})().catch((error) => { console.error(error); process.exitCode = 1; });
