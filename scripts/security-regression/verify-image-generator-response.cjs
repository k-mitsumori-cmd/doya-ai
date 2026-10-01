// Offline regression: image fallback responses are bounded without invoking a paid provider.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { check } = require('./load-typescript.cjs')

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/image-generator.ts'), 'utf8') + '\nexport { readLimitedGeminiResponse }\n'
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText
let response = new Response(JSON.stringify({ candidates: [{ content: { parts: [
  { inlineData: { data: 'aGVsbG8=', mimeType: 'image/png' } },
] } }] }))
const requests = []
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports, Buffer, Response, AbortController,
  process: { env: { GOOGLE_GENAI_API_KEY: 'offline-test-key' } },
  console: { warn() {} },
  require(name) {
    if (name === './openai-image') return {
      async generateImageGpt() { throw new Error('simulated primary failure') },
      async editImageGpt() { throw new Error('simulated primary failure') },
    }
    if (name === './fetch-timeout') return { withTimeout: async (_label, timeoutMs, fn) => {
      assert.equal(timeoutMs, 45_000)
      return fn(new AbortController().signal)
    } }
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch(url, options) { requests.push({ url, options }); return Promise.resolve(response) },
}, { filename: 'src/lib/image-generator.ts' })

;(async () => {
  await check('active image fallback parses a bounded response and keeps its timeout signal', async () => {
    const result = await moduleExports.generateImageWithFallback({ prompt: 'test', size: '1024x1024' })
    assert.equal(result.base64, 'aGVsbG8=')
    assert.equal(result.fallbackUsed, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent')
    assert.equal(requests[0].options.method, 'POST')
    assert.ok(requests[0].options.signal)
  })
  await check('image and error response caps reject declared and streamed oversize bodies', async () => {
    const declared = new Response('x', { headers: { 'content-length': String(32 * 1024 * 1024 + 1) } })
    await assert.rejects(moduleExports.readLimitedGeminiResponse(declared, 32 * 1024 * 1024), /too large/)
    await assert.rejects(moduleExports.readLimitedGeminiResponse(new Response(Buffer.alloc(64 * 1024 + 1)), 64 * 1024), /too large/)
    response = new Response('error', { status: 503 })
    await assert.rejects(moduleExports.generateImageWithFallback({ prompt: 'test', size: '1024x1024' }), /failed \(503\)/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
