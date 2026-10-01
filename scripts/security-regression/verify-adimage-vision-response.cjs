// Offline regression: Vision feedback reads bounded provider responses.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { check } = require('./load-typescript.cjs')

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/adimage/vision.ts'), 'utf8') + '\nexport { readBoundedVisionResponse }\n'
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText
let response = new Response(JSON.stringify({ choices: [{ message: { content: '{"readable":true}' } }] }))
const requests = []
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports, Buffer, Response,
  process: { env: { OPENAI_API_KEY: 'offline-test-key' } },
  require(name) {
    if (name === '@/lib/fetch-timeout') return { withTimeout: async (_label, timeoutMs, fn) => {
      assert.equal(timeoutMs, 90_000)
      return fn(new AbortController().signal)
    } }
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch(url, options) { requests.push({ url, options }); return Promise.resolve(response) },
}, { filename: 'src/lib/adimage/vision.ts' })

;(async () => {
  await check('Vision feedback parses bounded JSON and retains its 90 second signal', async () => {
    const result = await moduleExports.visionJson({ prompt: 'test', pngBase64: 'aGVsbG8=' })
    assert.equal(result.readable, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].options.method, 'POST')
    assert.ok(requests[0].options.signal)
  })
  await check('Vision rejects declared and streamed oversize provider responses', async () => {
    const declared = new Response('x', { headers: { 'content-length': String(1024 * 1024 + 1) } })
    await assert.rejects(moduleExports.readBoundedVisionResponse(declared, 1024 * 1024), /too large/)
    await assert.rejects(moduleExports.readBoundedVisionResponse(new Response(Buffer.alloc(64 * 1024 + 1)), 64 * 1024), /too large/)
    response = new Response('unavailable', { status: 503 })
    await assert.rejects(moduleExports.visionJson({ prompt: 'test', pngBase64: 'aGVsbG8=' }), /vision failed \(503\)/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
