const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const schemas = load('src/lib/swipe-request.ts', { zod: require('zod') })
const QuotaError = class extends Error { constructor(limit) { super('quota'); this.limit = limit } }
const body = {
  sessionId: '4b18a0aa-e3db-47aa-b740-2a3903debd8b',
  finalData: { title: 'SEOの選び方', targetChars: 4000 },
  answers: [{ questionId: 'q1', question: '比較しますか？', answer: 'yes', category: '記事タイプ' }],
}
const request = value => ({ json: async () => value })

;(async () => {
  await check('Swipe finalize requires login, session ownership, and valid input before creating an article', async () => {
    let authenticated = false
    let owner = 'other'
    let generatedArticleId = null
    let admitted = 0
    let limited = false
    const session = { get userId() { return owner }, get generatedArticleId() { return generatedArticleId }, mainKeyword: 'SEO' }
    const db = {
      swipeSession: { findUnique: async () => session },
      seoJob: { findFirst: async () => ({ id: 'j1', articleId: 'a1' }) },
    }
    const api = load('src/app/api/swipe/test/finalize/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'owner', plan: 'FREE' } } : null },
      zod: require('zod'),
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': db,
      '@/lib/seoAccess': { normalizeSeoPlan: () => 'FREE', isTrialActive: () => ({ active: false }) },
      '@/lib/pricing': { getSeoCharLimitByUserPlan: () => 10000 },
      '@/lib/swipe-request': schemas,
      '@seo/lib/types': { SeoCreateArticleInputSchema: { safeParse: data => ({ success: true, data }) } },
      '@/lib/seo-article-admission': {
        SeoArticleQuotaError: QuotaError,
        createSeoArticleWithinLimit: async args => {
          admitted++
          assert.equal(args.userId, 'owner')
          assert.equal(args.createJob, true)
          assert.equal(args.articleData.mode, 'comparison_research')
          if (limited) throw new QuotaError(3)
          await args.afterCreate({ swipeSession: { update: async ({ where, data }) => {
            assert.equal(where.userId, 'owner')
            assert.equal(where.generatedArticleId, null)
            generatedArticleId = data.generatedArticleId
          } } }, { id: 'a1' })
          return { article: { id: 'a1' }, job: { id: 'j1' } }
        },
      },
    })
    assert.equal((await api.POST(request(body))).status, 401)
    assert.equal(admitted, 0)
    authenticated = true
    assert.equal((await api.POST(request({ ...body, answers: Array(31).fill(body.answers[0]) }))).status, 400)
    assert.equal(admitted, 0)
    assert.equal((await api.POST(request(body))).status, 403)
    assert.equal(admitted, 0)
    owner = 'owner'
    assert.equal((await api.POST(request({ ...body, finalData: { ...body.finalData, targetChars: 20000 } }))).status, 400)
    limited = true
    const denied = await api.POST(request(body))
    assert.equal(denied.status, 429)
    assert.equal((await denied.json()).code, 'SEO_ARTICLE_LIMIT')
    limited = false
    const created = await api.POST(request(body))
    assert.equal(created.status, 200)
    assert.equal((await created.json()).jobId, 'j1')
    const count = admitted
    const retry = await api.POST(request(body))
    assert.equal(retry.status, 200)
    assert.equal((await retry.json()).articleId, 'a1')
    assert.equal(admitted, count, 'retry does not consume another article')
  })

  await check('Swipe question endpoints reject anonymous and foreign sessions without invoking AI', async () => {
    for (const file of ['src/app/api/swipe/test/question/route.ts', 'src/app/api/swipe/test/route.ts']) {
      let authenticated = false
      let owner = 'other'
      let reservations = 0
      let calls = 0
      const api = load(file, {
        'next/server': { NextResponse: Response },
        'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'owner' } } : null },
        '@/lib/auth': { authOptions: {} },
        '@/lib/prisma': { swipeSession: { findUnique: async () => ({ userId: owner, mainKeyword: 'SEO' }) } },
        '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateText: async () => { calls++; return '{"done":true,"finalData":{"title":"SEO","targetChars":4000}}' } },
        uuid: { v4: () => 'q1' },
        '@/lib/swipe-request': schemas,
        '@/lib/seo-tool-admission': { SeoToolRateLimitError: QuotaError, reserveSeoToolCall: async () => { reservations++ } },
      })
      const req = request({ sessionId: body.sessionId, answers: [] })
      assert.equal((await api.POST(req)).status, 401)
      authenticated = true
      assert.equal((await api.POST(req)).status, 403)
      assert.equal(calls, 0)
      assert.equal(reservations, 0)
      owner = 'owner'
      assert.equal((await api.POST(req)).status, 200)
      assert.equal(reservations, 1)
      assert.ok(calls > 0)
    }
  })

  await check('Swipe AI start rejects anonymous, invalid, and exhausted requests before provider calls', async () => {
    let authenticated = false
    let limited = false
    let providerFails = false
    let providerCalls = 0
    let writes = 0
    const api = load('src/app/api/swipe/test/start/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'owner' } } : null },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { swipeSession: { create: async () => { writes++ } } },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateText: async () => { providerCalls++; if (providerFails) throw new Error('provider failed'); return '{"questions":[{"question":"SEO記事を作りますか？","category":"記事タイプ"}]}' } },
      uuid: { v4: () => body.sessionId },
      zod: require('zod'),
      '@/lib/seo-tool-admission': { SeoToolRateLimitError: QuotaError, reserveSeoToolCall: async () => { if (limited) throw new QuotaError(50) } },
    })
    assert.equal((await api.POST(request({ keywords: ['SEO'] }))).status, 401)
    authenticated = true
    assert.equal((await api.POST(request({ keywords: Array(11).fill('SEO') }))).status, 400)
    limited = true
    assert.equal((await api.POST(request({ keywords: ['SEO'] }))).status, 429)
    assert.equal(providerCalls, 0)
    assert.equal(writes, 0)
    limited = false
    providerFails = true
    assert.equal((await api.POST(request({ keywords: ['SEO'] }))).status, 503)
    assert.equal(writes, 0, 'failed AI start leaves no orphan session')
  })

  await check('Swipe image maintenance requires admin and bounds generation count', async () => {
    for (const file of [
      'src/app/api/swipe/question-images/generate/route.ts',
      'src/app/api/swipe/celebration-images/generate/route.ts',
      'src/app/api/swipe/question-images/clear/route.ts',
    ]) {
      let admin = false
      let calls = 0
      const api = load(file, {
        'next/server': { NextResponse: Response },
        '@/lib/admin-guard': { requireAdmin: async () => admin ? null : new Response('{}', { status: 401 }) },
        '@/lib/prisma': { swipeQuestionImage: { deleteMany: async () => { calls++; return { count: 1 } } } },
        '@seo/lib/gemini': { GEMINI_IMAGE_MODEL_DEFAULT: 'test', geminiGenerateImagePng: async () => { calls++; return { dataBase64: '', mimeType: 'image/png' } } },
        zod: require('zod'),
      })
      assert.equal((await api.POST(request({ count: 1000000 }))).status, 401)
      assert.equal(calls, 0)
      admin = true
      if (file.includes('generate')) {
        assert.equal((await api.POST(request({ count: 1000000 }))).status, 400)
        assert.equal(calls, 0)
      }
    }
  })

  await check('Legacy swipe start and log do not create guest sessions or accept foreign writes', async () => {
    let authenticated = false
    let owner = 'other'
    let writes = 0
    const mocks = {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'owner' } } : null },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { swipeSession: {
        create: async () => { writes++; return {} },
        findUnique: async () => ({ userId: owner }),
        update: async () => { writes++; return {} },
      } },
      '@seo/lib/swipe-questions': { SWIPE_QUESTIONS: [] },
      uuid: { v4: () => body.sessionId },
      zod: require('zod'),
      '@/lib/swipe-request': schemas,
    }
    const start = load('src/app/api/swipe/start/route.ts', mocks)
    const log = load('src/app/api/swipe/log/route.ts', mocks)
    assert.equal((await start.POST(request({ mainKeyword: 'SEO' }))).status, 401)
    assert.equal((await log.POST(request({ sessionId: body.sessionId, swipes: [] }))).status, 401)
    assert.equal(writes, 0)
    authenticated = true
    assert.equal((await start.POST(request({ mainKeyword: 'x'.repeat(101) }))).status, 400)
    assert.equal((await start.POST(request({ mainKeyword: 'SEO' }))).status, 200)
    assert.equal(writes, 1)
    assert.equal((await log.POST(request({ sessionId: body.sessionId, swipes: [{ questionId: 'q1', decision: 'yes' }] }))).status, 403)
    assert.equal(writes, 1)
    owner = 'owner'
    assert.equal((await log.POST(request({ sessionId: body.sessionId, swipes: [{ questionId: 'q1', decision: 'yes' }] }))).status, 200)
    assert.equal(writes, 2)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
