const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const sitemapUrl = 'https://doyamarke.surisuta.jp/sitemap-dynamic/sitemap-dynamic-bm90ZXMvOnNsdWc.xml'
const articleUrl = 'https://doyamarke.surisuta.jp/notes/example'
const requests = []
let sitemap = `<urlset><url><loc>${articleUrl}</loc></url></urlset>`
const monitor = load('src/lib/doyamarke-body-check.ts', {
  './slack-voice': { voicePayload: value => value },
  './net/safe-fetch': { safeFetchResource: async (url, options) => {
    requests.push({ url, options })
    if (url === sitemapUrl) return { body: Buffer.from(sitemap), status: 200 }
    if (url === articleUrl) return { body: Buffer.from(`<article><h2>A</h2><h2>B</h2><h2>C</h2>${'本文'.repeat(800)}</article>`), status: 200 }
    throw new Error('unexpected outbound URL')
  } },
}, { fetch: async () => { throw new Error('Slack or unprotected network must not run') } })

;(async () => {
  await check('Body check bounds the sitemap and article fetches without sending notifications', async () => {
    const result = await monitor.runDoyamarkeBodyCheck({ dryRun: true })
    assert.equal(result.checked, 1)
    assert.equal(result.issues.length, 0)
    assert.equal(result.posted, false)
    assert.deepEqual(requests.map(request => request.url), [sitemapUrl, articleUrl])
    assert.ok(requests.every(request => request.options.maxBytes === 4 * 1024 * 1024))
    assert.ok(requests.every(request => request.options.maxRedirects === 3))
  })

  await check('Body check rejects a foreign sitemap URL before fetching it', async () => {
    sitemap = '<urlset><url><loc>http://127.0.0.1/private</loc></url></urlset>'
    await assert.rejects(monitor.runDoyamarkeBodyCheck({ dryRun: true }), /unexpected URLs/)
    assert.equal(requests.length, 3, 'only the sitemap should have been requested again')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
