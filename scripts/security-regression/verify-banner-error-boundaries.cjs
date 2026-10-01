const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const secret = 'PRIVATE_PROVIDER_RESPONSE_OR_USER_PROMPT'
const notifications = []
const sessionFailure = { getServerSession: async () => { throw new Error(secret) } }
const common = {
  'next/server': { NextResponse: Response },
  'next-auth': sessionFailure,
  '@/lib/auth': { authOptions: {} },
  '@/lib/nanobanner': {},
  '@/lib/prisma': { prisma: {} },
  '@/lib/pricing': {},
  '@/lib/banner/monthly-quota': {},
  '@/lib/service-usage': {},
  '@/lib/notifications': { sendErrorNotification: async (data) => { notifications.push(data) } },
  crypto,
}

;(async () => {
  const generate = load('src/app/api/banner/generate/route.ts', common)
  await check('Banner generate does not expose unexpected errors to user or alert', async () => {
    const response = await generate.POST({})
    assert.equal(response.status, 500)
    assert(!JSON.stringify(await response.json()).includes(secret))
    assert.equal(notifications.length, 1)
    assert(!JSON.stringify(notifications[0]).includes(secret))
    assert.equal(notifications[0].errorStack, undefined)
  })

  const fromUrl = load('src/app/api/banner/from-url/route.ts', {
    ...common,
    '@/lib/net/safe-fetch': {},
    '@/lib/banner/provider-response': {},
    '@/lib/banner/vision-response': {},
    '@/lib/net/safe-browser': {},
    sharp: () => {},
  })
  await check('Banner from-url does not expose unexpected errors to user', async () => {
    const response = await fromUrl.POST({})
    assert.equal(response.status, 500)
    assert(!JSON.stringify(await response.json()).includes(secret))
  })

  const refine = load('src/app/api/banner/refine/route.ts', {
    ...common,
    sharp: () => {},
    '@/lib/resolve-image-model': {},
  })
  await check('Banner refine does not send provider details to alerts', async () => {
    const response = await refine.POST({})
    assert.equal(response.status, 500)
    assert(!JSON.stringify(await response.json()).includes(secret))
    assert.equal(notifications.length, 2)
    assert(!JSON.stringify(notifications[1]).includes(secret))
    assert.equal(notifications[1].errorStack, undefined)
  })

  for (const [label, providerMessage, quota] of [
    ['unexpected provider failure', secret, false],
    ['provider quota failure', `429 quota ${secret}`, true],
  ]) {
    await check(`Banner generator sanitizes ${label}`, async () => {
      const logs = []
      const generator = load('src/lib/nanobanner.ts', {
        sharp: () => {},
        './image-generator': { generateImageWithFallback: async () => { throw new Error(providerMessage) } },
        './net/safe-fetch': {},
      }, {
        process: { env: { GOOGLE_GENAI_API_KEY: 'offline-test-key' } },
        setTimeout: (callback) => callback(),
        console: { log() {}, warn() {}, error: (...parts) => logs.push(parts.join(' ')) },
      })
      const result = await generator.generateBanners('other', 'example', '1080x1080', { customImagePrompt: 'Test prompt' }, 1)
      assert.equal(result.banners.length, 1)
      assert(!result.error.includes(secret))
      assert(!logs.join(' ').includes(secret))
      assert.equal(result.error.includes('利用上限'), quota)
    })
  }

  await check('Banner provider errors never become result text or raw logs', async () => {
    const generator = fs.readFileSync('src/lib/nanobanner.ts', 'utf8')
    assert(!generator.includes("errors.join('\\n')"))
    assert(!/error:\s*error\.message/.test(generator))
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:error|e|err)(?:\.|\b)/.test(generator))
    for (const name of ['generate', 'from-url']) {
      const route = fs.readFileSync(`src/app/api/banner/${name}/route.ts`, 'utf8')
      assert(!/error:\s*result\.error/.test(route))
      assert(!/warning:\s*result\.error/.test(route))
      assert(!/console\.error\([^\n]*,\s*(?:error|e|err)\b/.test(route))
    }
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
