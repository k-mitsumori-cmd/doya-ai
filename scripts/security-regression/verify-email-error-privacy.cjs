const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/email.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

async function invoke(fakeFetch, timer = setTimeout) {
  const logs = [];
  const sandbox = {
    exports: {},
    process: { env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'test@example.test' } },
    fetch: fakeFetch,
    AbortController,
    setTimeout: timer,
    clearTimeout,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'email.ts' });
  const result = await sandbox.exports.sendEmail({ to: 'recipient@example.test', subject: 'test', html: '<p>test</p>' });
  return { result, logs };
}

(async () => {
  const secret = 'private-provider-error-body-and-key';
  const thrown = await invoke(async () => { throw new Error(secret); });
  assert.equal(thrown.result.success, false);
  assert.doesNotMatch(JSON.stringify(thrown), new RegExp(secret));

  let bodyRead = false;
  const rejected = await invoke(async () => ({ ok: false, status: 429, text: async () => { bodyRead = true; return secret; } }));
  assert.equal(rejected.result.success, false);
  assert.equal(rejected.result.error, 'Resend API error: 429');
  assert.equal(bodyRead, false);
  assert.doesNotMatch(JSON.stringify(rejected), new RegExp(secret));
  let timeoutMs = 0;
  const aborted = await invoke(async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error(secret)), { once: true });
    });
  }, (callback, delay) => { timeoutMs = delay; return setTimeout(callback, 0); });
  assert.equal(aborted.result.success, false);
  assert.equal(timeoutMs, 12000);
  assert.doesNotMatch(JSON.stringify(aborted), new RegExp(secret));
  console.log('PASS email failure results and logs do not expose provider details');
})().catch(error => { console.error(error); process.exit(1); });
