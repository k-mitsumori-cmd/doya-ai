const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const secret = 'PRIVATE_DATABASE_OR_PROVIDER_EXCEPTION'
const response = { NextResponse: Response }

;(async () => {
  await check('public healthcheck omits raw database errors and configured hosts', async () => {
    const healthcheck = load('src/app/api/mitsuboshi/nagusame/healthcheck/route.ts', {
      'next/server': response,
      '@/lib/prisma': { prisma: { $queryRaw: async () => { throw new Error(secret) } } },
      '@/lib/mitsuboshi/_shared/constants': {
        MITSUBOSHI_BRAND: { seriesName: 'mitsuboshi', currentVolume: 1 },
        MITSUBOSHI_CLAUDE_MODEL: 'test-model',
      },
    }, { process: { env: { MITSUBOSHI_HOSTS: `private.${secret}.example`, ANTHROPIC_API_KEY: 'configured' } } })
    const result = await healthcheck.GET({ headers: new Headers({ host: 'public.example' }) })
    const body = await result.json()
    assert.equal(result.status, 503)
    assert.equal(body.checks.database.ok, false)
    assert(!JSON.stringify(body).includes(secret))
    assert(!JSON.stringify(body).includes('private.'))
  })

  for (const service of ['slide', 'slashslide']) {
    await check(`${service} generation hides provider failure`, async () => {
      const route = load(`src/app/api/${service}/generate/route.ts`, {
        'next/server': response,
        '@/lib/retired-service': { SERVICE_RETIRED: false },
        'zod': require('zod'),
        [`@/lib/${service}/gemini`]: { generateSlideSpec: async () => { throw new Error(secret) } },
      })
      const result = await route.POST({ json: async () => ({ topic: 'test' }) })
      assert.equal(result.status, 500)
      assert(!JSON.stringify(await result.json()).includes(secret))
    })
  }

  for (const routeName of ['analyze-url-preview', 'projects/[id]/analyze-url']) {
    await check(`interviewx ${routeName} hides source errors`, async () => {
      const route = load(`src/app/api/interviewx/${routeName}/route.ts`, {
        'next/server': response,
        '@/lib/retired-service': { SERVICE_RETIRED: false },
        '@/lib/prisma': { prisma: { interviewXProject: { findUnique: async () => ({ id: 'project', userId: 'user', companyUrl: 'https://example.com' }) } } },
        '@/lib/interviewx/access': {
          getInterviewXUser: async () => ({ userId: 'user' }),
          requireAuth: () => null,
          requireDatabase: () => null,
          checkOwnership: () => null,
        },
        '@/lib/tenkai/scraper': { scrapeUrl: async () => { throw new Error(`内部ネットワーク ${secret}`) } },
        '@/lib/interviewx/prompts': {},
      })
      const result = await route.POST({ json: async () => ({ url: 'https://example.com' }) }, { params: Promise.resolve({ id: 'project' }) })
      assert.equal(result.status, 500)
      assert(!JSON.stringify(await result.json()).includes(secret))
    })
  }

  await check('movie plan stream hides provider failure', async () => {
    const route = load('src/app/api/movie/generate-plan/route.ts', {
      'next/server': response,
      'next-auth': { getServerSession: async () => ({ user: { email: 'test@example.com' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/movie/access': { getGuestIdFromRequest: () => null },
      '@/lib/movie/gemini': { generatePlansStream: async function* () { throw new Error(secret) } },
      '@/lib/retired-service': { SERVICE_RETIRED: false },
    }, { ReadableStream, TextEncoder })
    const result = await route.POST({ json: async () => ({ productInfo: {}, persona: null, config: {} }) })
    assert.equal(result.status, 200)
    const body = await result.text()
    assert(body.includes('error'))
    assert(!body.includes(secret))
  })

  await check('shared Gemini chat does not include provider response bodies in errors', async () => {
    const gemini = load('src/lib/gemini-text.ts', {}, {
      process: { env: { GOOGLE_GENAI_API_KEY: 'offline-test-key' } },
      fetch: async () => new Response(secret, { status: 503 }),
    })
    await assert.rejects(gemini.generateChatWithGemini([{ role: 'user', text: 'test' }]), error => {
      assert(!String(error).includes(secret))
      return true
    })
  })

  await check('movie render failure stores a safe message', async () => {
    let stored
    const render = load('src/lib/movie/render.ts', {
      '@/lib/prisma': { prisma: { movieRenderJob: { update: async (args) => { stored = args.data; return args.data } } } },
      './storage': {},
      './kling': {},
    })
    await render.failRenderJob('job-1', secret)
    assert.equal(stored.status, 'failed')
    assert(!JSON.stringify(stored).includes(secret))
  })

  await check('movie render status hides previously stored failure details', async () => {
    const route = load('src/app/api/movie/render/[jobId]/route.ts', {
      'next/server': response,
      'next-auth': { getServerSession: async () => ({ user: { email: 'test@example.com' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: {
        user: { findUnique: async () => ({ id: 'user-1' }) },
        movieProject: { findUnique: async () => ({ userId: 'user-1', guestId: null }) },
      } },
      '@/lib/movie/render': { getRenderJob: async () => ({ id: 'job-1', projectId: 'project-1', status: 'failed', error: secret, createdAt: new Date() }) },
      '@/lib/movie/access': { getGuestIdFromRequest: () => null },
      '@/lib/retired-service': { SERVICE_RETIRED: false },
    })
    const result = await route.GET({}, { params: Promise.resolve({ jobId: 'job-1' }) })
    assert.equal(result.status, 200)
    assert(!JSON.stringify(await result.json()).includes(secret))
  })

  await check('shodan detail hides previously stored provider failure details', async () => {
    const route = load('src/app/api/shodan/preparations/[id]/route.ts', {
      ...require('./shodan-editor-test-helpers.cjs'),
      'next/server': response,
      '@prisma/client': { Prisma: { DbNull: Symbol('DbNull') } },
      '@/lib/prisma': { prisma: { shodanPreparation: { findFirst: async () => ({ id: 'prep-1', organizationId: 'org-1', status: 'failed', errorMessage: secret, slideImages: [] }) } } },
      '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => 'org' },
      '@/lib/shodan/types': { effectivePrepStatus: () => 'failed' },
      '@/lib/shodan/slide-generation-lease': { shodanSlideLeaseKey: () => 'lease' },
      '@/lib/shodan/storage': { signedUrl: async () => '' },
    })
    const result = await route.GET({}, { params: Promise.resolve({ id: 'prep-1' }) })
    assert.equal(result.status, 200)
    assert(!JSON.stringify(await result.json()).includes(secret))
  })

  await check('slide vision failure does not include provider response bodies', async () => {
    const vision = load('src/lib/doyaslide/vision.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (_label, _ms, fn) => fn(new AbortController().signal) },
    }, {
      process: { env: { GOOGLE_GENAI_API_KEY: 'offline-test-key' } },
      fetch: async () => new Response(secret, { status: 503 }),
    })
    await assert.rejects(vision.reviseSlidePrompt({ imageBase64: 'AA==', mimeType: 'image/png', userInstruction: 'test', themeColor: '#000000' }), error => {
      assert(!String(error).includes(secret))
      return true
    })
  })

  await check('cunning transcription preserves fallback without retaining provider response bodies', async () => {
    const models = []
    const transcribe = load('src/lib/cunning/transcribe.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (_label, _ms, fn) => fn(new AbortController().signal) },
    }, {
      process: { env: { OPENAI_API_KEY: 'offline-test-key' } },
      Blob, FormData, AbortController,
      fetch: async (_url, options) => {
        const model = options.body.get('model')
        models.push(model)
        return model === 'gpt-4o-transcribe'
          ? new Response(`unsupported model ${secret}`, { status: 400 })
          : Response.json({ text: '文字起こし成功' })
      },
    })
    const result = await transcribe.transcribeChunk(new Blob(['audio']), { filename: 'chunk.webm' })
    assert.deepEqual(models, ['gpt-4o-transcribe', 'whisper-1'])
    assert.equal(result.text, '文字起こし成功')
    const failing = load('src/lib/cunning/transcribe.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (_label, _ms, fn) => fn(new AbortController().signal) },
    }, {
      process: { env: { OPENAI_API_KEY: 'offline-test-key' } },
      Blob, FormData, AbortController,
      fetch: async () => new Response(secret, { status: 503 }),
    })
    await assert.rejects(failing.transcribeChunk(new Blob(['audio'])), error => {
      assert(!String(error).includes(secret))
      assert(!JSON.stringify(error).includes(secret))
      return true
    })
  })

  await check('HubSpot sync failure does not include provider response bodies', async () => {
    const hubspot = load('src/lib/hubspot.ts', {}, {
      process: { env: { HUBSPOT_PRIVATE_APP_TOKEN: 'offline-test-key' } },
      fetch: async () => new Response(secret, { status: 503 }),
    })
    await assert.rejects(hubspot.fetchContactsCreatedAfter(0, 1), error => {
      assert(!String(error).includes(secret))
      return true
    })
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
