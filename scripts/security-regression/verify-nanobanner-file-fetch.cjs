// Offline regression: generated file URLs must not bypass the pinned, bounded transfer.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { check } = require('./load-typescript.cjs')

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/nanobanner.ts'), 'utf8') + '\nexport { fetchAsBase64, refinePromptWithGemini3Flash, readGeminiTextResponse }\n'
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText
const calls = []
let image = { body: Buffer.from([0, 255, 128]) }
let response = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'refined' }] } }] }))
const aiRequests = []
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports, Buffer, AbortSignal, Response,
  process: { env: { GOOGLE_GENAI_API_KEY: 'offline-test-key' } },
  require(name) {
    if (name === 'sharp') return { __esModule: true, default: () => { throw new Error('sharp is outside fetch test') } }
    if (name === './image-generator') return { generateImageWithFallback() { throw new Error('paid AI must not run') } }
    if (name === './net/safe-fetch') return { safeFetchResource: async (url, options) => {
      calls.push({ url, options })
      return image
    } }
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch(url, options) { aiRequests.push({ url, options }); return Promise.resolve(response) },
}, { filename: 'src/lib/nanobanner.ts' })

;(async () => {
  await check('Gemini file URI uses pinned transport with a 16 MiB and 30 second budget', async () => {
    assert.equal(await moduleExports.fetchAsBase64('https://example.test/image'), Buffer.from([0, 255, 128]).toString('base64'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.accept, 'image/*')
    assert.equal(calls[0].options.maxBytes, 16 * 1024 * 1024)
    assert.equal(calls[0].options.timeoutMs, 30_000)
    assert.equal(calls[0].options.maxRedirects, 2)
  })
  await check('Gemini file URI rejects plain HTTP and a failed or empty transfer', async () => {
    await assert.rejects(moduleExports.fetchAsBase64('http://example.test/image'), /HTTPS/)
    assert.equal(calls.length, 1)
    image = null
    await assert.rejects(moduleExports.fetchAsBase64('https://example.test/image'), /fetch failed/)
    image = { body: Buffer.alloc(0) }
    await assert.rejects(moduleExports.fetchAsBase64('https://example.test/image'), /fetch failed/)
  })
  await check('active prompt refinement has a total fetch timeout and bounded JSON response', async () => {
    assert.equal(await moduleExports.refinePromptWithGemini3Flash('original'), 'refined')
    assert.equal(aiRequests.length, 1)
    assert.equal(aiRequests[0].options.method, 'POST')
    assert.ok(aiRequests[0].options.signal)
    assert.equal(aiRequests[0].options.signal.aborted, false)
    assert.equal(aiRequests[0].options.headers['x-goog-api-key'], 'offline-test-key')
    const tooLarge = new Response('x', { headers: { 'content-length': String(512 * 1024 + 1) } })
    await assert.rejects(moduleExports.readGeminiTextResponse(tooLarge), /too large/)
    await assert.rejects(moduleExports.readGeminiTextResponse(new Response(Buffer.alloc(512 * 1024 + 1))), /too large/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
