const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

async function main() {
  const timeout = load('src/lib/fetch-timeout.ts', {}, { AbortController, setTimeout, clearTimeout })
  let fetched = 0
  const provider = load('src/lib/banner/provider-response.ts', {
    '@/lib/fetch-timeout': timeout,
  }, {
    fetch: async (_url, init) => {
      fetched++
      assert.equal(init.method, 'POST')
      assert(init.signal instanceof AbortSignal)
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  const result = await provider.requestBannerTextProvider('https://example.test', { contents: [] })
  assert.equal(result.ok, true)
  assert.match(result.text, /"ok"/)
  assert.equal(fetched, 1)

  const oversizedHeader = load('src/lib/banner/provider-response.ts', {
    '@/lib/fetch-timeout': timeout,
  }, {
    fetch: async () => new Response('x', { headers: { 'Content-Length': String(1024 * 1024 + 1) } }),
  })
  await assert.rejects(oversizedHeader.requestBannerTextProvider('https://example.test', {}), /too large/)

  const oversizedStream = load('src/lib/banner/provider-response.ts', {
    '@/lib/fetch-timeout': timeout,
  }, {
    fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close() },
    })),
  })
  await assert.rejects(oversizedStream.requestBannerTextProvider('https://example.test', {}), /too large/)

  const oversizedError = load('src/lib/banner/provider-response.ts', {
    '@/lib/fetch-timeout': timeout,
  }, {
    fetch: async () => new Response('x'.repeat(64 * 1024 + 1), { status: 429 }),
  })
  await assert.rejects(oversizedError.requestBannerTextProvider('https://example.test', {}), /too large/)

  const immediateTimeout = load('src/lib/fetch-timeout.ts', {}, {
    AbortController,
    setTimeout: callback => { queueMicrotask(callback); return 1 },
    clearTimeout: () => {},
  })
  const stalled = load('src/lib/banner/provider-response.ts', {
    '@/lib/fetch-timeout': immediateTimeout,
  }, {
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }),
  })
  await assert.rejects(stalled.requestBannerTextProvider('https://example.test', {}), /timeout/)
  console.log('PASS banner text provider body and timeout are bounded')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
