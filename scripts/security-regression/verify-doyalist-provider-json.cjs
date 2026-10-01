// Offline provider boundary tests; every fetch is mocked.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const repo = resolve(__dirname, '../..');
const ts = createRequire(repo + '/package.json')('typescript');
const source = fs.readFileSync(repo + '/src/lib/doyalist/collect/provider-json.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

async function check(response, limits = { timeoutMs: 100, maxBytes: 32 }) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, Buffer, AbortSignal, fetch: async () => response });
  return exports.fetchCollectionJson('https://mock.invalid', {}, limits);
}

(async () => {
  const valid = await check(new Response('{"ok":true}', { status: 200 }));
  assert.equal(valid.ok, true);
  assert.equal(valid.data.ok, true);

  const missing = await check(new Response('missing', { status: 404 }));
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);

  await assert.rejects(check(new Response('a'.repeat(64), { headers: { 'content-length': '64' } })), /too large/);
  const streamed = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(64)); controller.close(); } }));
  await assert.rejects(check(streamed), /too large/);

  const exports = {};
  vm.runInNewContext(compiled, { exports, Buffer, AbortSignal, fetch: async (_url, opts) => new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
  }) });
  // AbortSignal.timeout uses an unref'd timer; keep this offline test process alive.
  const hold = setTimeout(() => {}, 100);
  try {
    await assert.rejects(exports.fetchCollectionJson('https://mock.invalid', {}, { timeoutMs: 5, maxBytes: 32 }));
  } finally {
    clearTimeout(hold);
  }
  console.log('PASS Doyalist provider JSON success, HTTP error, size, stream and timeout boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
