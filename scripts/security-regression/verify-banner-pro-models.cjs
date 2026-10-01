// Offline regression: banner refine must never silently fall back to non-Pro image models.
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const env = { DOYA_BANNER_IMAGE_MODEL: 'nano-banana-pro', GOOGLE_GENAI_API_KEY: 'offline-test-key' }
const modelApi = load('src/lib/resolve-image-model.ts', {
  './image-generator': { generateImageWithFallback() { throw new Error('paid API must not run') } },
}, { process: { env }, fetch() { throw new Error('ListModels must not run') } })
const calls = []
const releases = []
let response = new Response(JSON.stringify({ candidates: [{ content: { parts: [
  { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
] } }] }))
let notifications = 0
const sharp = () => ({ resize() { return this }, png() { return this }, async toBuffer() { return Buffer.from('image') } })
const api = load('src/app/api/banner/refine/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), { status: options?.status || 200 }) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'u1' } }) },
  '@/lib/auth': { authOptions: {} },
  sharp,
  '@/lib/notifications': { sendErrorNotification: async () => { notifications++ } },
  '@/lib/resolve-image-model': modelApi,
  '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: '' },
  '@/lib/banner/monthly-quota': {
    reserveBannerMonthlyImages: async () => ({ state: 'reserved', reservation: { id: 'reservation' } }),
    releaseBannerMonthlyImages: async (_reservation, count) => { releases.push(count) },
  },
}, {
  process: { env }, AbortSignal,
  fetch(url, options) { calls.push({ url, options }); return Promise.resolve(response) },
  console: { error() {}, log() {}, warn() {} },
})
const request = () => ({ json: async () => ({ originalImage: 'data:image/png;base64,AA==', instruction: '文字を修正' }) })
const modelResponse = load('src/lib/banner/vision-response.ts')
let modelFetchOptions
let modelListResponse = new Response(JSON.stringify({ models: [
  { name: 'models/gemini-3-pro-image', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
] }))
const modelsRoute = load('src/app/api/banner/models/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/nanobanner': { isNanobannerConfigured: () => true },
  '@/lib/banner-admin-guard': { requireBannerAdmin: () => null },
  '@/lib/banner/vision-response': modelResponse,
}, {
  process: { env }, AbortSignal,
  fetch: async (_url, options) => { modelFetchOptions = options; return modelListResponse },
})

;(async () => {
  await check('Nano Banana Pro aliases resolve to official Pro image ID only', async () => {
    assert.deepEqual(Array.from(await modelApi.resolveImageModel('offline')), ['gemini-3-pro-image'])
    env.DOYA_BANNER_IMAGE_MODEL = 'models/gemini-3-pro-image-preview'
    assert.deepEqual(Array.from(await modelApi.resolveImageModel('offline')), ['gemini-3-pro-image-preview', 'gemini-3-pro-image'])
    env.DOYA_BANNER_IMAGE_MODEL = 'nano-banana-pro'
  })
  await check('admin model suggestions contain only Pro image models', async () => {
    const result = await modelsRoute.GET(new Request('https://local.test/api/banner/models'))
    assert.equal(result.status, 200)
    const body = await result.json()
    assert.deepEqual(body.suggestedImageModels, ['models/gemini-3-pro-image'])
    assert.ok(modelFetchOptions.signal, 'model list request must have a deadline')
  })
  await check('admin model list rejects oversized provider responses', async () => {
    modelListResponse = new Response('x', { headers: { 'content-length': String(1024 * 1024 + 1) } })
    const result = await modelsRoute.GET(new Request('https://local.test/api/banner/models'))
    assert.equal(result.status, 500)
    assert.equal((await result.json()).error, 'AIモデル一覧を取得できませんでした。')
  })
  await check('banner refine uses the official Pro image endpoint with timeout and bounded response', async () => {
    const result = await api.POST(request())
    assert.equal(result.status, 200)
    assert.equal((await result.json()).success, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent')
    assert.ok(calls[0].options.signal)
    assert.equal(releases.length, 0)
  })
  await check('invalid model and oversized response fail before charging quota', async () => {
    env.DOYA_BANNER_IMAGE_MODEL = 'gemini-2.5-flash-image'
    await assert.rejects(modelApi.resolveImageModel('offline'), /Nano Banana Pro/)
    const invalid = await api.POST(request())
    assert.equal(invalid.status, 500)
    assert.equal(calls.length, 1)
    assert.deepEqual(releases, [1])
    env.DOYA_BANNER_IMAGE_MODEL = 'nano-banana-pro'
    response = new Response('x', { headers: { 'content-length': String(32 * 1024 * 1024 + 1) } })
    const oversized = await api.POST(request())
    assert.equal(oversized.status, 500)
    assert.equal(calls.length, 2)
    assert.deepEqual(releases, [1, 1])
    assert.equal(notifications, 2)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
