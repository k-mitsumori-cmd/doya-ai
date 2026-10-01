const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const calls = []
let body = '<html><head><title>Example &amp; Co.</title><meta name="description" content="Overview"></head><body><h1>Services</h1><p>Useful page.</p></body></html>'
const { fetchAndExtract } = load('seo/lib/extract.ts', {
  '@/lib/net/safe-fetch': {
    safeFetchText: async (url, options) => {
      calls.push({ url, options })
      return body
    },
  },
}, { fetch: async () => { throw new Error('unprotected fetch must not run') } })

;(async () => {
  await check('SEO references use the shared bounded, pinned fetcher and still extract HTML', async () => {
    const page = await fetchAndExtract('https://example.com/article')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://example.com/article')
    assert.equal(calls[0].options.timeoutMs, 30_000)
    assert.equal(calls[0].options.maxBytes, 4 * 1024 * 1024)
    assert.equal(page.title, 'Example & Co.')
    assert.equal(page.description, 'Overview')
    assert.deepEqual(Array.from(page.headings), ['Services'])
    assert.match(page.text, /Useful page/)
  })

  await check('SEO references remain empty when the safe fetcher rejects a URL or body', async () => {
    body = null
    const page = await fetchAndExtract('http://127.0.0.1/private')
    assert.equal(calls.length, 2)
    assert.equal(page.url, 'http://127.0.0.1/private')
    assert.equal(page.title, '')
    assert.equal(page.text, '')
    assert.deepEqual(Array.from(page.headings), [])
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
