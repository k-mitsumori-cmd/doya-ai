const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const admission = load('src/lib/seo-tool-admission.ts', {
  'node:crypto': { createHash },
  '@/lib/prisma': { prisma: {} },
})

function database(initial) {
  const rows = new Map(initial)
  let tail = Promise.resolve()
  const tx = {
    $executeRaw: async () => {},
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
    },
  }
  return { rows, $transaction: async callback => {
    let release
    const previous = tail
    tail = new Promise(resolve => { release = resolve })
    await previous
    try { return await callback(tx) } finally { release() }
  } }
}

;(async () => {
  await check('SEO tool admission serializes concurrent calls and resets at JST midnight', async () => {
    const key = admission.seoToolUsageKey('owner', 'title-suggestions')
    const db = database([[key, '2026-09-25:49']])
    const now = new Date('2026-09-25T14:59:59Z')
    const outcomes = await Promise.allSettled([
      admission.reserveSeoToolCall('owner', 'title-suggestions', db, now),
      admission.reserveSeoToolCall('owner', 'title-suggestions', db, now),
    ])
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter(result => result.reason instanceof admission.SeoToolRateLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:50')
    const next = await admission.reserveSeoToolCall('owner', 'title-suggestions', db, new Date('2026-09-25T15:00:00Z'))
    assert.equal(next.used, 1)
    assert.equal(db.rows.get(key), '2026-09-26:1')
  })

  await check('SEO tool admission fails closed when the ledger is corrupt', async () => {
    const key = admission.seoToolUsageKey('owner', 'compare-candidates')
    const db = database([[key, 'corrupt']])
    await assert.rejects(admission.reserveSeoToolCall('owner', 'compare-candidates', db), /ledger invalid/)
    assert.equal(db.rows.get(key), 'corrupt')
  })

  await check('SEO image batch reservation is atomic and cannot exceed the daily ceiling', async () => {
    const key = admission.seoToolUsageKey('owner', 'article-images')
    const db = database([[key, '2026-09-25:96']])
    const now = new Date('2026-09-25T12:00:00Z')
    const outcomes = await Promise.allSettled([
      admission.reserveSeoToolCalls('owner', 'article-images', 4, db, now),
      admission.reserveSeoToolCalls('owner', 'article-images', 4, db, now),
    ])
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter(result => result.reason instanceof admission.SeoToolRateLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:100')
    await assert.rejects(admission.reserveSeoToolCalls('owner', 'article-images', 101, db, now), /Invalid SEO tool reservation amount/)
  })

  await check('SEO manual text tools share one atomic JST daily provider ceiling', async () => {
    const key = admission.seoToolUsageKey('owner', 'article-text-tools')
    const db = database([[key, '2026-09-25:99']])
    const now = new Date('2026-09-25T12:00:00Z')
    const attempts = await Promise.allSettled([
      admission.reserveSeoToolCall('owner', 'article-text-tools', db, now),
      admission.reserveSeoToolCall('owner', 'article-text-tools', db, now),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof admission.SeoToolRateLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:100')
    assert.equal((await admission.reserveSeoToolCall('owner', 'article-text-tools', db, new Date('2026-09-25T15:00:00Z'))).used, 1)
  })

  await check('SEO section regeneration rejects the shared text cap before the provider', async () => {
    let limited = true
    let providerCalls = 0
    let writes = 0
    const api = load('src/app/api/seo/sections/[id]/regenerate/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/seoArticleOwner': { getSeoGenerationOwner: async () => ({ userId: 'owner' }) },
      '@/lib/prisma': { prisma: { seoSection: {
        findFirst: async () => ({ id: 'section', headingPath: '見出し', content: '本文', article: { title: '記事', keywords: [] } }),
        updateMany: async () => { writes++; return { count: 1 } },
      } } },
      '@/lib/seo-tool-admission': {
        SeoToolRateLimitError: admission.SeoToolRateLimitError,
        reserveSeoToolCall: async (userId, tool) => { assert.equal(userId, 'owner'); assert.equal(tool, 'article-text-tools'); if (limited) throw new admission.SeoToolRateLimitError(100) },
      },
      '@seo/lib/gemini': { geminiGenerateText: async () => { providerCalls++; return '新しい本文' }, GEMINI_TEXT_MODEL_DEFAULT: 'test' },
    })
    const ctx = { params: Promise.resolve({ id: 'section' }) }
    const request = { json: async () => ({ headingPath: '見出し' }) }
    const blocked = await api.POST(request, ctx)
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).code, 'SEO_TEXT_DAILY_LIMIT')
    assert.equal(providerCalls, 0)
    assert.equal(writes, 0)
    limited = false
    assert.equal((await api.POST(request, ctx)).status, 200)
    assert.equal(providerCalls, 1)
    assert.equal(writes, 1)
  })

  await check('SEO note conversion rejects empty AI output without saving it', async () => {
    let writes = 0
    const api = load('src/app/api/seo/articles/[id]/generate-note/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/seoArticleOwner': { getSeoGenerationOwner: async () => ({ userId: 'owner' }) },
      '@/lib/prisma': { prisma: {
        seoArticle: { findFirst: async () => ({ id: 'article', title: '記事', keywords: [] }) },
        seoKnowledgeItem: { create: async () => { writes++ } },
      } },
      '@/lib/seo-tool-admission': { reserveSeoToolCall: async () => {}, SeoToolRateLimitError: admission.SeoToolRateLimitError },
      '@seo/lib/gemini': { geminiGenerateText: async () => '   ' },
    })
    const response = await api.POST({}, { params: Promise.resolve({ id: 'article' }) })
    assert.equal(response.status, 502)
    assert.equal(writes, 0)
  })

  await check('SEO reference parsing enforces the text cap and labels AI fallback honestly', async () => {
    let limited = true
    let aiCalls = 0
    const api = load('src/app/api/seo/reference/parse/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/net/safe-fetch': { safeFetchText: async () => { throw Error('No URL fetch expected') } },
      '@/lib/seo-tool-admission': {
        SeoToolRateLimitError: admission.SeoToolRateLimitError,
        reserveSeoToolCall: async (userId, tool) => { assert.equal(userId, 'owner'); assert.equal(tool, 'article-text-tools'); if (limited) throw new admission.SeoToolRateLimitError(100) },
      },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateJson: async () => { aiCalls++; return { axes: 'invalid' } } },
      zod: require('zod'),
    })
    const request = { json: async () => ({ text: '## 見出し\n本文です。' }) }
    assert.equal((await api.POST(request)).status, 429)
    assert.equal(aiCalls, 0)
    limited = false
    const response = await api.POST(request)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.aiAnalyzed, false)
    assert.equal(body.usedModel, null)
    assert.deepEqual(JSON.parse(JSON.stringify(body.template.axes)), [])
    assert.equal(aiCalls, 1)
  })

  await check('SEO public provider routes reject anonymous and exhausted requests before provider calls', async () => {
    for (const fixture of [
      { file: 'src/app/api/seo/title-suggestions/route.ts', provider: '@seo/lib/gemini', method: 'geminiGenerateJson', body: { keyword: 'SEO' } },
      { file: 'src/app/api/seo/compare/candidates/route.ts', provider: '@seo/lib/serpapi', method: 'serpapiSearchGoogle', body: { query: 'SEO比較' } },
    ]) {
      let calls = 0
      let authenticated = false
      let limited = false
      let reservations = 0
      const mocks = {
        'next/server': { NextResponse: Response },
        'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'owner' } } : null },
        '@/lib/auth': { authOptions: {} },
        zod: require('zod'),
        '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
        '@/lib/seo-tool-admission': {
          SeoToolRateLimitError: admission.SeoToolRateLimitError,
          reserveSeoToolCall: async () => { reservations++; if (limited) throw new admission.SeoToolRateLimitError(1) },
        },
        [fixture.provider]: {
          [fixture.method]: async () => { calls++; return fixture.method === 'geminiGenerateJson' ? { titles: ['SEOの選び方'] } : { organic: [] } },
          GEMINI_TEXT_MODEL_DEFAULT: 'test',
        },
      }
      const api = load(fixture.file, mocks, { process: { env: { SEO_SERPAPI_KEY: 'test' } } })
      const request = { json: async () => fixture.body }
      assert.equal((await api.POST(request)).status, 401)
      assert.equal(calls, 0)
      assert.equal(reservations, 0)
      authenticated = true
      const invalidResponse = await api.POST({ json: async () => fixture.method === 'geminiGenerateJson' ? { keyword: 'SEO', keywords: Array(13).fill('x') } : { query: 'x' } })
      assert.equal(invalidResponse.status, 400)
      assert.equal(reservations, 0)
      assert.equal(calls, 0)
      limited = true
      const limitResponse = await api.POST(request)
      assert.equal(limitResponse.status, 429)
      assert.equal((await limitResponse.json()).code, 'RATE_LIMIT')
      assert.equal(calls, 0)
      limited = false
      assert.equal((await api.POST(request)).status, 200)
      assert.equal(calls, fixture.method === 'geminiGenerateJson' ? 1 : 3)
    }
  })

  await check('SEO title suggestions return ten distinct choices when the provider returns none', async () => {
    let requestedPrompt = ''
    const api = load('src/app/api/seo/title-suggestions/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
      '@/lib/auth': { authOptions: {} },
      zod: require('zod'),
      '@/lib/seo-tool-admission': {
        SeoToolRateLimitError: admission.SeoToolRateLimitError,
        reserveSeoToolCall: async () => {},
      },
      '@seo/lib/gemini': {
        GEMINI_TEXT_MODEL_DEFAULT: 'test',
        geminiGenerateJson: async ({ prompt }) => { requestedPrompt = prompt; return { titles: [] } },
      },
    })
    const response = await api.POST({ json: async () => ({ keyword: 'SEO', count: 10 }) })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.titles.length, 10)
    assert.equal(new Set(body.titles).size, 10)
    assert.match(requestedPrompt, /10案すべて角度を変える/)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
