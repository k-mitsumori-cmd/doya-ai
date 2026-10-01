// Offline regression: AIO provider fetches keep response and time budgets.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { check } = require('./load-typescript.cjs')

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/aio/engines.ts'), 'utf8') + '\nexport { readProviderResponse }\n'
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText
const calls = []
let nextResponse
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports, Buffer, URL, Response, AbortSignal,
  process: { env: { ANTHROPIC_API_KEY: 'offline', PERPLEXITY_API_KEY: 'offline', SERPER_API_KEY: 'offline' } },
  require(name) {
    if (name === 'openai') return { __esModule: true, default: class { constructor() { throw new Error('paid API must not run') } } }
    if (name === '@seo/lib/gemini') return { geminiGenerateText() { throw new Error('paid API must not run') }, GEMINI_TEXT_MODEL_DEFAULT: 'mock' }
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch(url, options) { calls.push({ url, options }); return Promise.resolve(nextResponse) },
}, { filename: 'src/lib/aio/engines.ts' })

;(async () => {
  await check('Claude and Perplexity use bounded fetch and preserve answer fields', async () => {
    nextResponse = new Response(JSON.stringify({ content: [{ text: 'Claude answer' }] }))
    assert.equal((await moduleExports.askEngine('claude', 'question')).text, 'Claude answer')
    nextResponse = new Response(JSON.stringify({ choices: [{ message: { content: 'Perplexity answer' } }], citations: ['https://example.test'] }))
    const answer = await moduleExports.askEngine('perplexity', 'question')
    assert.equal(answer.text, 'Perplexity answer')
    assert.equal(answer.citations[0], 'https://example.test')
    assert.equal(calls.length, 2)
    assert.ok(calls.every(call => call.options.signal && !call.options.signal.aborted))
  })
  await check('Serper has its own timeout and returns validated search hits', async () => {
    nextResponse = new Response(JSON.stringify({ organic: [{ title: 'Example', link: 'https://www.example.test/a', snippet: 'text' }] }))
    const hits = await moduleExports.serperSearch('question', 8)
    assert.equal(hits[0].domain, 'example.test')
    assert.ok(calls[2].options.signal)
  })
  await check('provider response rejects oversized headers and streamed bodies', async () => {
    const declared = new Response('x', { headers: { 'content-length': String(1024 * 1024 + 1) } })
    await assert.rejects(moduleExports.readProviderResponse(declared, 1024 * 1024), /too large/)
    await assert.rejects(moduleExports.readProviderResponse(new Response(Buffer.alloc(64 * 1024 + 1)), 64 * 1024), /too large/)
    nextResponse = new Response('unavailable', { status: 503 })
    await assert.rejects(moduleExports.askEngine('claude', 'question'), /Claude API 503/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
