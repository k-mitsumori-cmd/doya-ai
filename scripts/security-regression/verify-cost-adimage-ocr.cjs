// Offline regression: 有料APIの呼び過ぎ防止（広告画像の文字の検査）。
// すべてモックで呼び出し回数を数える。外部APIは呼ばない。process.env の既定値には頼らない。
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const ENV = { GOOGLE_GENAI_API_KEY: 'offline-gemini-key', OPENAI_API_KEY: 'offline-openai-key' }
const isOpenAi = (url) => String(url).includes('openai.com')

;(async () => {
  // ---- 広告画像の文字の検査 ----
  function adimageMocks(ocrTexts) {
    const calls = { fetch: [], generate: 0, uploads: 0 }
    const vision = load('src/lib/adimage/vision.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (_n, _t, fn) => fn(new AbortController().signal) },
    }, {
      process: { env: { ...ENV } },
      fetch: async (url, options) => {
        calls.fetch.push({ url, body: JSON.parse(options.body) })
        const payload = { candidates: [{ content: { parts: [{ text: JSON.stringify({ texts: ocrTexts, boxes: [] }) }] } }] }
        return new Response(JSON.stringify(payload), { status: 200 })
      },
    })
    const compositions = load('src/lib/adimage/compositions.ts')
    const verify = load('src/lib/adimage/verify.ts', { './vision': vision, './compositions': compositions })
    return { calls, vision, verify, compositions }
  }

  const copy = { headline: '今だけ半額セール', sub: '人気の商品がそろっています', cta: '今すぐ見る' }

  await check('文字の検査は gemini-2.5-flash で行い、gpt-4o を呼ばない', async () => {
    const { calls, verify } = adimageMocks([copy.headline, copy.sub, copy.cta])
    const result = await verify.verifyCreative({ pngBase64: 'aGVsbG8=', copy, composition: 'hero-center' })
    assert.equal(result.ocrMatch, true)
    assert.equal(result.needsReview, false)
    assert.equal(calls.fetch.length, 1)
    assert.equal(calls.fetch.filter(c => isOpenAi(c.url)).length, 0)
    assert.ok(calls.fetch[0].url.includes('/models/gemini-2.5-flash:generateContent'))
    const parts = calls.fetch[0].body.contents[0].parts
    assert.ok(parts.some(p => p.inlineData && p.inlineData.data === 'aGVsbG8='), '画像を渡している')
  })

  await check('文字が崩れ続けても作り直しは最大1回（生成2回・検査2回）', async () => {
    const { calls, verify, compositions } = adimageMocks(['崩れた文字'])
    const fakeSharp = () => ({ metadata: async () => ({ width: 1024, height: 1024 }) })
    const generate = load('src/lib/adimage/generate.ts', {
      sharp: fakeSharp,
      '@/lib/image-generator': { generateImageWithFallback: async () => { calls.generate++; return { base64: 'aGVsbG8=', model: 'mock-image', fallbackUsed: false } } },
      './prompt': { buildImagePrompt: () => 'prompt' },
      './verify': verify,
      './storage': { assertPrivateStorage: async () => {}, uploadPng: async () => { calls.uploads++ } },
      './logo': { overlayLogo: async (b) => b },
      './compositions': compositions,
    })
    const placement = { key: 'feed', genW: 1024, genH: 1024, w: 1080, h: 1080 }
    const result = await generate.generateBaked({ brand: {}, copy, tone: 'clean', placement, composition: 'hero-center', pathPrefix: 'test' })
    assert.equal(calls.generate, 2)
    assert.equal(calls.fetch.length, 2)
    assert.equal(calls.fetch.filter(c => isOpenAi(c.url)).length, 0)
    assert.equal(result.verify.needsReview, true)
    assert.equal(result.verify.retries, 1)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
