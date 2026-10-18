const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const requests = []
const downloads = []
const image = Buffer.from('stored image')
let resource = { body: image }
let stored = { buffer: image, contentType: 'image/png' }
const globals = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://assets.example.com' } },
  fetch: async () => { throw new Error('unprotected fetch must not run') } }
const mocks = {
  sharp: () => { throw new Error('image processing is outside this fetch test') },
  './constants': { LOGO_SIZE_RATIO: { M: 0.2 } },
  '@/lib/net/safe-fetch': { safeFetchResource: async (url, options) => {
    requests.push({ url, options })
    return resource
  } },
  './file-urls': load('src/lib/doyaslide/file-urls.ts', {}, globals),
  './storage': { downloadDoyaslideObject: async (path) => { downloads.push(path); return stored } },
}
const { fetchBuffer } = load('src/lib/doyaslide/logo.ts', mocks, globals)

;(async () => {
  await check('DoyaSlide bucket files are read with the service role, not the public URL (SEC-062)', async () => {
    assert.equal(await fetchBuffer('https://assets.example.com/storage/v1/object/public/doyaslide/user/p/slide.png'), image)
    assert.deepEqual(downloads, ['user/p/slide.png'])
    assert.equal(requests.length, 0)
    stored = { buffer: image, contentType: 'application/octet-stream' }
    await assert.rejects(fetchBuffer('https://assets.example.com/storage/v1/object/public/doyaslide/user/p/x.png'), /画像取得失敗/)
    stored = null
    await assert.rejects(fetchBuffer('https://assets.example.com/storage/v1/object/public/doyaslide/user/p/y.png'), /画像取得失敗/)
    assert.equal(requests.length, 0)
  })

  await check('DoyaSlide image fetch is host restricted, pinned and byte bounded', async () => {
    assert.equal(await fetchBuffer('https://assets.example.com/storage/v1/object/public/other/slide.png'), image)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].options.maxBytes, 8 * 1024 * 1024)
    assert.equal(requests[0].options.timeoutMs, 25_000)
    assert.equal(requests[0].options.maxRedirects, 0)
    await assert.rejects(fetchBuffer('https://outside.example.com/slide.png'), /許可されていないホスト/)
    await assert.rejects(fetchBuffer('http://assets.example.com/slide.png'), /httpsのURLのみ/)
    assert.equal(requests.length, 1)
  })

  await check('DoyaSlide image fetch fails closed without the configured storage host', async () => {
    const missingHost = load('src/lib/doyaslide/logo.ts', mocks, {
      process: { env: {} },
      fetch: async () => { throw new Error('unprotected fetch must not run') },
    })
    await assert.rejects(missingHost.fetchBuffer('https://assets.example.com/slide.png'), /許可されていないホスト/)
    assert.equal(requests.length, 1)
  })

  await check('DoyaSlide image fetch reports a failed safe transfer', async () => {
    resource = null
    await assert.rejects(fetchBuffer('https://assets.example.com/slide.png'), /画像取得失敗/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
