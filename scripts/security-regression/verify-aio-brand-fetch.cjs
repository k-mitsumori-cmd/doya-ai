const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const calls = []
let html = '<html><head><title>Acme | Official</title></head></html>'
let aiCalls = 0
const { deriveBrandFromUrl } = load('src/lib/aio/suggest.ts', {
  'tldts': require('tldts'), 'node:url': require('node:url'),
  '@seo/lib/gemini': { geminiGenerateJson: async () => { aiCalls++; return { brandName: 'Acme' } } },
  '@/lib/net/safe-fetch': { safeFetchText: async (url, options) => { calls.push({ url, options }); return html } },
}, { fetch: async () => { throw new Error('unprotected fetch must not run') } })

;(async () => {
  await check('AIO brand lookup uses bounded pinned HTML and keeps a successful title', async () => {
    const result = await deriveBrandFromUrl('https://acme.example.com/')
    assert.equal(result.brandName, 'Acme')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.maxBytes, 2 * 1024 * 1024)
    assert.equal(calls[0].options.timeoutMs, 24_000)
    assert.equal(calls[0].options.maxRedirects, 3)
    assert.equal(aiCalls, 1)
  })

  await check('AIO brand lookup falls back without AI when the safe fetch rejects a URL', async () => {
    html = null
    const result = await deriveBrandFromUrl('http://127.0.0.1/private')
    assert.ok(result.brandName)
    assert.equal(aiCalls, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
