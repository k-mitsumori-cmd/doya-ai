'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const deps = root + '/node_modules/';
process.env.NEXTAUTH_URL = 'https://synthetic.invalid';
const ts = require(deps + 'typescript');
const { getBody } = require(deps + 'next-auth/next/utils.js');
const { AuthHandler } = require(deps + 'next-auth/core/index.js');
const source = fs.readFileSync(root + '/src/lib/auth-logger.ts');
const logs = [];
const capture = Object.fromEntries(['error', 'warn', 'log'].map(level => [level, (...args) => logs.push({ level, args })]));
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source.toString(), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject, console: capture, URL });
const cases = [];
async function submit(body, useJson = false) {
  logs.length = 0;
  const request = new Request('https://synthetic.invalid/api/auth/_log', {
    method: 'POST',
    headers: { host: 'synthetic.invalid', 'x-forwarded-proto': 'https', 'content-type': useJson ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: useJson ? JSON.stringify(body) : new URLSearchParams(body),
  });
  const result = await AuthHandler({
    req: { action: '_log', method: request.method, headers: Object.fromEntries(request.headers), query: {}, cookies: {}, body: await getBody(request) },
    options: { secret: 'synthetic-log-code-audit-secret', providers: [], session: { strategy: 'jwt' }, logger: exportsObject.authLogger, debug: false },
  });
  assert.deepEqual(result, {});
}
async function check(name, level, code, expected, useJson = false) {
  await submit({ level, code, client: 'true', message: 'SYNTHETIC_METADATA_CANARY' }, useJson);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].level, level);
  assert.equal(logs[0].args[0], '[next-auth][' + level + '][' + expected + ']');
  assert(!JSON.stringify(logs).includes('SYNTHETIC_METADATA_CANARY'));
  cases.push({ name, passed: true });
}
(async () => {
  for (const level of ['error', 'warn']) {
    for (const [name, code, json] of [
      ['embedded newline', 'CODE\nINJECTED_LINE'],
      ['trailing newline', 'CODE\n'],
      ['carriage return', 'CODE\rREWRITTEN'],
      ['bracket delimiter', 'CODE][injected'],
      ['long code', 'A'.repeat(97)],
      ['empty code', ''],
      ['object code', { field: 'SYNTHETIC_CODE_OBJECT' }, true],
    ]) await check(level + ' ' + name, level, code, 'UNKNOWN_AUTH_LOG_CODE', json);
  }
  await check('ordinary error identifier', 'error', 'adapter_error_createUser', 'adapter_error_createUser');
  await check('ordinary warning identifier', 'warn', 'NEXTAUTH_URL', 'NEXTAUTH_URL');
  assert.equal(logs[0].args[1], '\nhttps://next-auth.js.org/warnings#nextauth_url');
  await submit({ level: 'error', code: 'CLIENT_FETCH_ERROR', client: 'true', url: '/api/auth/session?token=SYNTHETIC_METADATA_CANARY', message: 'Failed to fetch' });
  assert.equal(logs.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(logs[0].args[1])), { endpoint: 'session', errorFamilyHint: 'network', client: true });
  assert(!JSON.stringify(logs).includes('SYNTHETIC_METADATA_CANARY'));
  cases.push({ name: 'existing fixed client diagnostic retained', passed: true });
  await submit({ level: 'debug', code: 'CODE\nINJECTED_LINE', client: 'true' });
  assert.equal(logs.length, 0);
  cases.push({ name: 'production debug remains disabled', passed: true });
  const report = { checkedAt: new Date().toISOString(), cases, candidateSha256: crypto.createHash('sha256').update(source).digest('hex'), productionRequests: 0, productionApplied: false };
  if (process.env.DOYA_AUTH_LOG_CODE_RESULT) fs.writeFileSync(process.env.DOYA_AUTH_LOG_CODE_RESULT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ marker: 'auth-log-code-validation', conditions: cases.length, allPassed: true, candidateSha256: report.candidateSha256 }));
})().catch(error => { console.error(error.name, error.message); process.exitCode = 1; });
