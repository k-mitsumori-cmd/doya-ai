// 有料の画像APIを、利用者が押していないのに二重に呼ばないことの確認（2026-10-19 原価見直し）。
// 外部APIは呼ばない。fetch と OpenAI SDK をモックにして、呼び出し回数を数える。
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const GEMINI_OK = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'R0VNSU5J' } }] } }] }

function setup({ openaiGenerate, edit }) {
  const calls = { openai: 0, gemini: 0, edit: [], clients: [] }
  const env = { OPENAI_API_KEY: 'test-openai', GOOGLE_GENAI_API_KEY: 'test-gemini' }
  const fetch = async (url, init) => {
    if (String(url).startsWith('https://api.openai.com/')) { calls.openai++; return openaiGenerate(init) }
    if (String(url).includes('generativelanguage.googleapis.com')) { calls.gemini++; return Response.json(GEMINI_OK) }
    throw new Error('unexpected url ' + url)
  }
  class OpenAI {
    constructor(options) {
      calls.clients.push(options)
      this.images = { edit: async params => { calls.edit.push(params.model); return edit(params.model) } }
    }
  }
  const globals = { fetch, setTimeout, clearTimeout, AbortController, process: { env } }
  const fetchTimeout = load('src/lib/fetch-timeout.ts', {}, globals)
  const openaiImage = load('src/lib/openai-image.ts', { './fetch-timeout': fetchTimeout, openai: { __esModule: true, default: OpenAI, toFile: async () => ({}) } }, globals)
  const generator = load('src/lib/image-generator.ts', { './openai-image': openaiImage, './fetch-timeout': fetchTimeout }, globals)
  return { calls, generator, openaiImage }
}

const statusError = (status) => Object.assign(new Error(`status ${status}`), { status })
const hang = (init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
const input = [{ mimeType: 'image/png', base64: 'AAAA' }]

;(async () => {
  await check('gpt-image-2 timeout does not fall back to Nano Banana Pro', async () => {
    const { calls, generator } = setup({ openaiGenerate: hang })
    await assert.rejects(generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', quality: 'medium', primaryTimeoutMs: 5 }), /timeout/)
    assert.equal(calls.openai, 1)
    assert.equal(calls.gemini, 0)
  })

  for (const status of [429, 500, 503]) {
    await check(`gpt-image-2 HTTP ${status} falls back to Nano Banana Pro once`, async () => {
      const { calls, generator } = setup({ openaiGenerate: async () => Response.json({ error: 'x' }, { status }) })
      const result = await generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', quality: 'medium' })
      assert.equal(result.fallbackUsed, true)
      assert.equal(calls.openai, 1)
      assert.equal(calls.gemini, 1)
    })
  }

  for (const status of [400, 401, 403]) {
    await check(`gpt-image-2 HTTP ${status} does not fall back`, async () => {
      const { calls, generator } = setup({ openaiGenerate: async () => Response.json({ error: 'x' }, { status }) })
      await assert.rejects(generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', quality: 'medium' }), new RegExp(`\\(${status}\\)`))
      assert.equal(calls.openai, 1)
      assert.equal(calls.gemini, 0)
    })
  }

  await check('gpt-image-2 success without image data does not fall back', async () => {
    const { calls, generator } = setup({ openaiGenerate: async () => Response.json({ data: [{}] }) })
    await assert.rejects(generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024' }), /no image data/)
    assert.equal(calls.gemini, 0)
  })

  await check('reference edit: timeout stops the chain after one paid call', async () => {
    const { calls, generator } = setup({ edit: async () => { throw new Error('Request timed out.') } })
    await assert.rejects(generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', inputImages: input }), /timed out/)
    assert.deepEqual(calls.edit, ['gpt-image-2'])
    assert.equal(calls.gemini, 0)
    assert.equal(calls.clients[0].maxRetries, 0, 'SDK automatic retries must be off')
  })

  await check('reference edit: 429/5xx walks gpt-image-2 -> gpt-image-1 -> Nano Banana Pro', async () => {
    const { calls, generator } = setup({ edit: async (model) => { throw statusError(model === 'gpt-image-2' ? 429 : 502) } })
    const result = await generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', inputImages: input })
    assert.equal(result.fallbackUsed, true)
    assert.deepEqual(calls.edit, ['gpt-image-2', 'gpt-image-1'])
    assert.equal(calls.gemini, 1)
  })

  await check('reference edit: 5xx then success on gpt-image-1 stops there', async () => {
    const { calls, generator } = setup({ edit: async (model) => { if (model === 'gpt-image-2') throw statusError(500); return { data: [{ b64_json: 'T0s=' }] } } })
    const result = await generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', inputImages: input })
    assert.equal(result.model, 'gpt-image-1')
    assert.deepEqual(calls.edit, ['gpt-image-2', 'gpt-image-1'])
    assert.equal(calls.gemini, 0)
  })

  await check('reference edit: HTTP 400 does not try another model', async () => {
    const { calls, generator } = setup({ edit: async () => { throw statusError(400) } })
    await assert.rejects(generator.generateImageWithFallback({ prompt: 'p', size: '1024x1024', inputImages: input }), /status 400/)
    assert.deepEqual(calls.edit, ['gpt-image-2'])
    assert.equal(calls.gemini, 0)
  })

  await check('retryable classifier accepts only 429 and 5xx', async () => {
    const { openaiImage } = setup({})
    for (const status of [429, 500, 599]) assert.equal(openaiImage.isRetryableImageProviderError(statusError(status)), true)
    for (const status of [400, 404, 408, 499, 600]) assert.equal(openaiImage.isRetryableImageProviderError(statusError(status)), false)
    assert.equal(openaiImage.isRetryableImageProviderError(new Error('gpt-image-2 timeout (170000ms)')), false)
    assert.equal(openaiImage.isRetryableImageProviderError(null), false)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
