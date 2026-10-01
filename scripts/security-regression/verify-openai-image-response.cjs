// Offline regression: the primary image API response must not grow without a limit.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { check } = require('./load-typescript.cjs')

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/openai-image.ts'), 'utf8') + '\nexport { readLimitedOpenAiResponse }\n'
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText
let response = new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }))
const requests = []
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports, Buffer, Response, AbortController,
  process: { env: { OPENAI_API_KEY: 'offline-test-key' } },
  require(name) {
    if (name === './fetch-timeout') return { withTimeout: async (_label, timeoutMs, fn) => {
      assert.equal(timeoutMs, 170_000)
      return fn(new AbortController().signal)
    } }
    if (name === 'openai') return { __esModule: true, default: class {}, toFile() { throw new Error('edit is outside this test') } }
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch(url, options) { requests.push({ url, options }); return Promise.resolve(response) },
}, { filename: 'src/lib/openai-image.ts' })

;(async () => {
  await check('primary image generation parses bounded JSON and preserves timeout signal', async () => {
    const result = await moduleExports.generateImageGpt({ prompt: 'test', size: '1024x1024' })
    assert.equal(result[0].b64, 'aGVsbG8=')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].options.method, 'POST')
    assert.ok(requests[0].options.signal)
  })
  await check('primary image and error responses reject declared and streamed oversize bodies', async () => {
    const declared = new Response('x', { headers: { 'content-length': String(32 * 1024 * 1024 + 1) } })
    await assert.rejects(moduleExports.readLimitedOpenAiResponse(declared, 32 * 1024 * 1024), /too large/)
    await assert.rejects(moduleExports.readLimitedOpenAiResponse(new Response(Buffer.alloc(64 * 1024 + 1)), 64 * 1024), /too large/)
    response = new Response('error', { status: 503 })
    await assert.rejects(moduleExports.generateImageGpt({ prompt: 'test' }), /failed \(503\)/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
