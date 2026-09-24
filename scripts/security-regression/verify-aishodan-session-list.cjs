const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/aishodan/sessions/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loadArrow;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'load' && ts.isCallExpression(node.initializer)) {
    loadArrow = node.initializer.arguments[0];
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(loadArrow && ts.isArrowFunction(loadArrow));
const compiled = ts.transpileModule(`(${loadArrow.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

async function run(response) {
  let sessions = ['previous'];
  let error = 'previous error';
  let loading = false;
  const load = vm.runInNewContext(compiled, {
    verdict: '',
    setLoading: (value) => { loading = value; },
    setSessions: (value) => { sessions = value; },
    setError: (value) => { error = value; },
    withOrg: (_service, path) => path,
    fetch: async () => response,
    Error,
  });
  await load();
  return { sessions, error, loading };
}

(async () => {
  let result = await run(Response.json({ error: 'この組織へのアクセス権限がありません' }, { status: 403 }));
  assert.equal(result.sessions.length, 0);
  assert.equal(result.error, '選択中の組織にアクセスできません。ダッシュボードで組織を選び直してください。');
  assert.equal(result.loading, false);

  result = await run(new Response('upstream unavailable', { status: 503 }));
  assert.equal(result.sessions.length, 0);
  assert.equal(result.error, '商談ログを取得できませんでした');

  result = await run(Response.json({}));
  assert.equal(result.error, '商談ログを確認できませんでした');

  result = await run(Response.json({ sessions: [] }));
  assert.equal(result.error, '');
  assert.equal(result.sessions.length, 0);
  console.log('PASS aishodan session list: authorization and unavailable responses are errors, genuine empty list is distinct');
})().catch((error) => { console.error(error); process.exitCode = 1; });
