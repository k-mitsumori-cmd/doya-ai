'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { patchNextAuthCallback } = require('../dependency-patches/next-auth-callback-params.cjs');

const deps = path.resolve(process.env.DOYA_NEXT_AUTH_TEST_MODULES || path.join(__dirname, '../../node_modules'));
const callbackFile = require.resolve(deps + '/next-auth/core/lib/oauth/callback.js');
const checkFile = require.resolve(deps + '/next-auth/core/lib/oauth/checks.js');
const clientFile = require.resolve(deps + '/openid-client/lib/client.js');
const sha = input => crypto.createHash('sha256').update(input).digest('hex');

async function exercise(mode, fixtureFile) {
  const warnings = [];
  process.on('warning', warning => {
    if (warning.code === 'DEP0169') warnings.push({
      code: warning.code,
      callbackParams: warning.stack.includes('Client.callbackParams'),
      syntheticCallback: warning.stack.includes('fixture-app-auth-callback.js'),
    });
  });
  for (const protocol of ['node:http', 'node:https']) {
    const client = require(protocol);
    client.request = client.get = () => { throw new Error('Unexpected external network request'); };
  }
  const originalLoader = Module._extensions['.js'];
  const fixtureModules = new Map([
    [callbackFile, [fixtureFile, 'fixture-app-auth-callback.js']],
    [clientFile, [clientFile, 'fixture-app-openid-client.js']],
  ]);
  const loaded = new Set();
  Module._extensions['.js'] = (mod, filename) => {
    const fixture = fixtureModules.get(filename);
    if (!fixture) return originalLoader(mod, filename);
    const [source, name] = fixture;
    loaded.add(filename);
    const synthetic = path.join(__dirname, name);
    mod.filename = synthetic;
    mod.require = Module.createRequire(filename);
    mod._compile(fs.readFileSync(source, 'utf8'), synthetic);
  };
  const callback = require(callbackFile).default;
  const checks = require(checkFile);
  Module._extensions['.js'] = originalLoader;
  assert.equal(loaded.size, 2);
  const rows = [];
  let captured;
  const options = {
    jwt: { secret: 'synthetic-oauth-regression-secret-with-no-production-use' },
    logger: { debug() {}, error() {} },
    cookies: {
      state: { name: 'fixture-state', options: {} },
      pkceCodeVerifier: { name: 'fixture-pkce', options: {} },
    },
    provider: {
      id: 'google', name: 'Synthetic Google', type: 'oauth', idToken: true,
      issuer: 'https://synthetic.invalid', clientId: 'fixture', clientSecret: 'fixture',
      callbackUrl: 'https://synthetic.invalid/api/auth/callback/google',
      checks: ['state', 'pkce'],
      token: { request: async ({ params, checks }) => {
        assert.equal(checks.state, state);
        assert.equal(checks.code_verifier, verifier);
        captured = params;
        return { tokens: { access_token: 'fixture-access-token' } };
      } },
      userinfo: { request: async () => ({ id: 'fixture-user' }) },
      profile: async profile => profile,
    },
  };
  const minted = [], responseParams = {};
  await checks.state.create(options, minted, responseParams);
  await checks.pkce.create(options, minted, responseParams);
  const cookies = Object.fromEntries(minted.map(({ name, value }) => [name, value]));
  const state = responseParams.state;
  const verified = {};
  await checks.pkce.use(cookies, [], options, verified);
  const verifier = verified.code_verifier;

  async function run(name, method, query, body) {
    captured = undefined;
    const result = await callback({ options, query, body, method, cookies });
    assert.equal(result.profile.id, 'fixture-user');
    assert(result.cookies.length === 2 && result.cookies.every(cookie => cookie.options.maxAge === 0));
    assert(captured);
    rows.push({ name, params: { ...captured, ...(captured.state === state ? { state: 'fixture-state-value' } : {}) } });
  }
  await run('POST form body and query isolation', 'POST', { code: 'from-query' }, 'code=from-body&scope=one%20two');
  await run('POST decoded body array', 'POST', {}, { code: ['one', 'two'], unknown: 'discard' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warnings.length, 0);
  await run('GET authorization code and state', 'GET', { code: 'fixture-code', state, unknown: 'discard' });
  await run('GET encoding', 'GET', { code: '東京+%&#?= b', state, scope: 'one two' });
  await run('GET array query values', 'GET', { code: ['one', 'two'], state });
  await run('GET empty query', 'GET', {});
  await run('GET empty and literal escape values', 'GET', { code: '', state: '%E0%A4%A' });
  await run('GET prototype-like property names', 'GET', JSON.parse('{"__proto__":"fixture","constructor":"fixture","code":"fixture-code"}'));
  const longQuery = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => ['ignored' + index, 'x']));
  await run('GET querystring parser limit', 'GET', { ...longQuery, code: 'beyond-limit', state });

  captured = undefined;
  await assert.rejects(() => callback({ options, query: { code: 'fixture-code' }, method: 'GET', cookies: {} }));
  assert.equal(captured, undefined);
  rows.push({ name: 'missing state cookie rejects' });
  options.provider.id = 'other-provider';
  await assert.rejects(() => callback({ options, query: { code: 'fixture-code', state }, method: 'GET', cookies }));
  assert.equal(captured, undefined);
  rows.push({ name: 'state cookie from another provider rejects' });
  await new Promise(resolve => setImmediate(resolve));
  if (Number(process.versions.node.split('.')[0]) >= 24) {
    assert.deepEqual(warnings, mode === 'original'
      ? [{ code: 'DEP0169', callbackParams: true, syntheticCallback: true }]
      : []);
  }
  console.log(JSON.stringify({ mode, rows, warnings, sourceSha256: sha(fs.readFileSync(fixtureFile)) }));
}

function runFixture(mode, file) {
  return JSON.parse(execFileSync(process.execPath, ['--no-warnings', __filename, 'worker', mode, file], { encoding: 'utf8' }));
}

function verify() {
  const original = process.env.DOYA_NEXT_AUTH_ORIGINAL_CALLBACK || callbackFile;
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-next-auth-callback-'));
  try {
    const fixtureRoot = path.join(workspace, 'node_modules/next-auth');
    const patchedFile = path.join(fixtureRoot, 'core/lib/oauth/callback.js');
    fs.mkdirSync(path.dirname(patchedFile), { recursive: true });
    fs.copyFileSync(deps + '/next-auth/package.json', path.join(fixtureRoot, 'package.json'));
    fs.copyFileSync(original, patchedFile);
    const patch = patchNextAuthCallback(workspace);
    if (!process.env.DOYA_NEXT_AUTH_ORIGINAL_CALLBACK) assert.equal(patch.status, 'already_patched');
    assert.equal(patchNextAuthCallback(workspace).status, 'already_patched');
    const patched = runFixture('patched', patchedFile);

    if (process.env.DOYA_NEXT_AUTH_ORIGINAL_CALLBACK) {
      assert.equal(patch.status, 'patched');
      const baseline = runFixture('original', original);
      assert.deepEqual(patched.rows, baseline.rows);
      assert.notEqual(patched.sourceSha256, baseline.sourceSha256);
    }
    assert.equal(patched.rows.find(row => row.name === 'GET encoding').params.code, '東京+%&#?= b');
    assert.equal(patched.rows.find(row => row.name === 'GET array query values').params.code, 'one,two');
    assert.equal(patched.rows.find(row => row.name === 'POST form body and query isolation').params.code, 'from-body');
    assert.deepEqual(patched.rows.find(row => row.name === 'GET querystring parser limit').params, {});
    assert(!patched.rows.find(row => row.name === 'GET authorization code and state').params.unknown);

    const unknown = fs.readFileSync(patchedFile, 'utf8') + '\n// fixture mutation\n';
    fs.writeFileSync(patchedFile, unknown);
    assert.throws(() => patchNextAuthCallback(workspace), /NEXT_AUTH_CALLBACK_UNKNOWN_SOURCE/);
    assert.equal(fs.readFileSync(patchedFile, 'utf8'), unknown);
    console.log(JSON.stringify({ marker: 'next-auth-callback-params', conditions: patched.rows.length,
      sourceSha256: patched.sourceSha256, warningCount: patched.warnings.length,
      comparedWithOriginal: Boolean(process.env.DOYA_NEXT_AUTH_ORIGINAL_CALLBACK), guardedInstall: true, allPassed: true }));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

if (process.argv[2] === 'worker') {
  exercise(process.argv[3], process.argv[4]).catch(error => { console.error(error.message); process.exitCode = 1; });
} else {
  verify();
}
