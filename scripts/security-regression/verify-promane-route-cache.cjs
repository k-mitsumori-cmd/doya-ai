const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load, check } = require('./load-typescript.cjs');

const routes = [
  'clients', 'expenses', 'workspaces/[id]', 'workspaces/create', 'workspaces/recover',
  'feedback', 'invite', 'invite/[token]', 'members/[id]/rate', 'repair', 'invitations',
];
function privacy(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((response.headers.get('vary') || '').split(',').filter(value => value.trim().toLowerCase() === 'cookie').length, 1);
}
const unexpected = () => { throw new Error('Unexpected business or external operation during guard test'); };

(async () => {
  let guards = 0;
  for (const route of routes) {
    const file = `src/app/api/promane/${route}/route.ts`;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const mocks = {};
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
      const module = statement.moduleSpecifier.text;
      const bindings = statement.importClause?.namedBindings;
      const exports = {};
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        if (!item.isTypeOnly) exports[(item.propertyName || item.name).text] = unexpected;
      }
      mocks[module] = exports;
    }
    mocks['next/server'] = { NextResponse: Response, NextRequest: Request };
    mocks['next-auth'] = { getServerSession: async () => null };
    mocks['@/lib/auth'] = { authOptions: {} };
    // Use the actual shared response helper; every business dependency must stay untouched.
    delete mocks['@/lib/private-api-response'];
    const actual = load(file, mocks);
    for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
      if (typeof actual[method] !== 'function') continue;
      await check(`Promane ${route} ${method} guard retains status and disables caches`, async () => {
        const expected = route === 'feedback' || (route === 'invite/[token]' && method === 'GET') ? 400 : 401;
        const url = new URL(`https://example.invalid/api/promane/${route}`);
        const response = await actual[method]({ url: url.href, nextUrl: url, json: async () => ({}) }, { params: Promise.resolve({ id: 'synthetic-missing', token: '' }) });
        assert.equal(response.status, expected); privacy(response);
        const body = await response.json(); assert.equal(typeof body.error, 'string');
        guards++;
      });
    }
  }

  class RequestError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
  class OperationError extends Error {}
  const workspace = load('src/lib/promane/workspace-response.ts', {
    'next/server': { NextResponse: Response },
    './workspace-mutations': { PromaneWorkspaceRequestError: RequestError },
    './workspace-operation': { PromaneWorkspaceOperationError: OperationError },
  });
  const entry = { id: 'synthetic-private-workspace', name: '合成の組織', updatedAt: '2026-10-29T00:00:00.000Z' };
  for (const state of ['saved', 'superseded', 'cancelled', 'missing']) await check(`Promane workspace ${state} retains exact outcome payload`, async () => {
    const result = { state, entry }, response = workspace.promaneWorkspaceResponse(result); privacy(response); assert.equal(response.status, 200);
    const success = state === 'saved' || state === 'superseded';
    assert.deepEqual(await response.json(), { ...result, success, ...(success ? { workspace: entry } : {}) });
  });
  for (const [code, status] of [['LIMIT_REACHED', 403], ['STALE_WORKSPACE', 409]]) await check(`Promane workspace ${code} preserves rejection code`, async () => {
    const result = { state: 'rejected', code, error: '合成の拒否理由' }, response = workspace.promaneWorkspaceResponse(result);
    privacy(response); assert.equal(response.status, status); assert.deepEqual(await response.json(), { ...result, success: false });
  });
  await check('Promane workspace request failure preserves403 code and text', async () => {
    const response = workspace.promaneWorkspaceFailure(new RequestError(403, 'FORBIDDEN', '合成の権限不足')); privacy(response); assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: '合成の権限不足', code: 'FORBIDDEN' });
  });
  await check('Promane workspace operation conflict remains409', async () => {
    const response = workspace.promaneWorkspaceFailure(new OperationError('合成の競合')); privacy(response); assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: '合成の競合', code: 'OPERATION_CONFLICT' });
  });
  await check('Promane workspace unknown failure remains sanitized500', async () => {
    const response = workspace.promaneWorkspaceFailure(new Error('SYNTHETIC_PRIVATE_MARKER')); privacy(response); assert.equal(response.status, 500);
    const body = await response.json(); assert.equal(body.code, 'UNKNOWN_OUTCOME'); assert(!JSON.stringify(body).includes('SYNTHETIC_PRIVATE_MARKER'));
  });
  console.log(JSON.stringify({ guardMethods: guards, outcomeCases: 9 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
