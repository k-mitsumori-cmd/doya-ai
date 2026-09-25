const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  await check('Guide image generation rejects non-admin requests before image provider calls', async () => {
    let calls = 0
    let authorized = false
    let providerError = null
    const api = load('src/app/api/guide/image/route.ts', {
      'next/server': { NextResponse: Response },
      zod: require('zod'),
      '@/lib/admin-guard': { requireAdmin: async () => authorized ? null : new Response(JSON.stringify({ error: '管理者認証が必要です' }), { status: 401 }) },
      '@/lib/nanobanner': { generateBanners: async () => { calls++; return providerError ? { error: providerError, banners: [] } : { banners: ['https://example.invalid/image.png'] } } },
    })
    const request = { json: async () => ({ featureName: 'SEO', description: 'ガイド' }) }
    assert.equal((await api.POST(request)).status, 401)
    assert.equal(calls, 0)
    authorized = true
    assert.equal((await api.POST({ json: async () => ({ featureName: '' }) })).status, 400)
    assert.equal(calls, 0)
    providerError = 'PRIVATE_PROVIDER_KEY=secret'
    const failed = await api.POST(request)
    assert.equal(failed.status, 502)
    assert(!JSON.stringify(await failed.json()).includes(providerError))
    providerError = null
    const success = await api.POST(request)
    assert.equal(success.status, 200)
    assert.equal((await success.json()).imageUrl, 'https://example.invalid/image.png')
  })

  await check('Feature guide defaults to no image and cannot loop on failed generation', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/components/FeatureGuide.tsx'), 'utf8')
    assert(source.includes("imageMode = 'off'"))
    assert(source.includes('!imageAttempted'))
    assert(source.includes('setImageAttempted(true)'))
    assert(source.includes('if (!res.ok) throw'))
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
