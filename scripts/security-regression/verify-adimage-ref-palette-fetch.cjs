const assert = require('node:assert/strict')
const sharp = require('sharp')
const { load, check } = require('./load-typescript.cjs')

const calls = []
let resource
const { extractRefPalette } = load('src/lib/adimage/ref-palette.ts', {
  sharp,
  '@/lib/net/safe-fetch': {
    safeFetchResource: async (url, options) => {
      calls.push({ url, options })
      return resource
    },
  },
}, { fetch: async () => { throw new Error('unprotected fetch must not run') } })

;(async () => {
  await check('Ad image palette reads only a bounded resource through pinned transport', async () => {
    resource = { body: await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ff0000' } }).png().toBuffer() }
    assert.deepEqual(Array.from(await extractRefPalette('https://example.com/template.png')), ['#ff0000'])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://example.com/template.png')
    assert.equal(calls[0].options.timeoutMs, 10_000)
    assert.equal(calls[0].options.maxBytes, 8 * 1024 * 1024)
    assert.match(calls[0].options.accept, /image/)
  })

  await check('Ad image generation continues without extracted colors when a reference is rejected', async () => {
    resource = null
    assert.deepEqual(Array.from(await extractRefPalette('http://127.0.0.1/private')), [])
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
