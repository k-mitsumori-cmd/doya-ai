const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const seoAccess = load('src/lib/seoAccess.ts', { 'next/server': { NextResponse: Response } })

;(async () => {
  await check('SEO image access matches plan entitlements including the first-hour trial', async () => {
    let user = null
    const access = load('src/lib/seo-image-access.ts', {
      'next-auth': { getServerSession: async () => user ? { user } : null },
      'next/server': { NextResponse: Response },
      '@/lib/auth': { authOptions: {} },
      '@/lib/seoAccess': seoAccess,
    })
    assert.equal((await access.requireSeoImageAccess()).response.status, 401)
    user = { id: 'owner', seoPlan: 'FREE', firstLoginAt: '2020-01-01T00:00:00Z' }
    const free = await access.requireSeoImageAccess()
    assert.equal(free.response.status, 403)
    assert.equal((await free.response.json()).code, 'SEO_IMAGE_PLAN_REQUIRED')
    user.firstLoginAt = new Date().toISOString()
    assert.equal((await access.requireSeoImageAccess()).userId, 'owner', 'active first-hour trial can generate')
    user = { id: 'owner', seoPlan: 'LIGHT', firstLoginAt: '2020-01-01T00:00:00Z' }
    assert.equal((await access.requireSeoImageAccess()).userId, 'owner')
  })

  await check('SEO image lease prevents concurrent fill, checks token on release, and recovers after expiry', async () => {
    const lease = load('src/lib/seo-image-lease.ts', {
      'node:crypto': { randomUUID: () => Math.random().toString(36).slice(2) },
      '@/lib/prisma': { prisma: {} },
    })
    const rows = new Map()
    let tail = Promise.resolve()
    const tx = {
      $executeRaw: async () => {},
      systemSetting: {
        findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
        upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
      },
    }
    const db = {
      $transaction: async callback => {
        let release
        const prior = tail
        tail = new Promise(resolve => { release = resolve })
        await prior
        try { return await callback(tx) } finally { release() }
      },
      systemSetting: {
        deleteMany: async ({ where }) => {
          if (rows.get(where.key) === where.value) { rows.delete(where.key); return { count: 1 } }
          return { count: 0 }
        },
      },
    }
    const first = await lease.claimSeoImageLease('article', db, 1000)
    const contenders = await Promise.allSettled([
      lease.claimSeoImageLease('article', db, 1000),
      lease.claimSeoImageLease('article', db, 1000),
    ])
    assert.equal(contenders.filter(result => result.reason instanceof lease.SeoImageGenerationInProgressError).length, 2)
    await lease.releaseSeoImageLease('article', 'other-token', db)
    await assert.rejects(lease.claimSeoImageLease('article', db, 1000), lease.SeoImageGenerationInProgressError)
    await lease.releaseSeoImageLease('article', first, db)
    const second = await lease.claimSeoImageLease('article', db, 1000)
    assert.notEqual(second, first)
    const recovered = await lease.claimSeoImageLease('article', db, 361001)
    assert.notEqual(recovered, second)
  })

  await check('Every SEO image writer denies ineligible callers before provider or database work', async () => {
    const files = [
      'src/app/api/seo/articles/[id]/images/banner/route.ts',
      'src/app/api/seo/articles/[id]/images/diagram/route.ts',
      'src/app/api/seo/articles/[id]/images/batch/route.ts',
      'src/app/api/seo/articles/[id]/images/suggest/route.ts',
      'src/app/api/seo/articles/[id]/images/ensure/route.ts',
      'src/app/api/seo/images/[id]/regenerate/route.ts',
    ]
    for (const file of files) {
      let providerCalls = 0
      let databaseCalls = 0
      const api = load(file, {
        'next/server': { NextResponse: Response },
        '@/lib/seo-image-access': { requireSeoImageAccess: async () => ({ ok: false, response: new Response('{}', { status: 403 }) }) },
        '@/lib/prisma': { prisma: { seoArticle: { findUnique: async () => { databaseCalls++ } } } },
        '@/lib/seo-tool-admission': { SeoToolRateLimitError: class extends Error {}, reserveSeoToolCalls: async () => { throw Error('unexpected reservation') }, reserveSeoToolCall: async () => { throw Error('unexpected reservation') } },
        '@/lib/seo-image-lease': { SeoImageGenerationInProgressError: class extends Error {}, claimSeoImageLease: async () => { throw Error('unexpected lease') }, releaseSeoImageLease: async () => {} },
        '@seo/lib/gemini': { geminiGenerateImagePng: async () => { providerCalls++ }, GEMINI_IMAGE_MODEL_DEFAULT: 'test' },
        '@seo/lib/storage': { ensureSeoStorage: async () => {}, saveBase64ToFile: async () => {} },
        '@seo/lib/bootstrap': { ensureSeoSchema: async () => { databaseCalls++ } },
        '@seo/lib/bannerPlan': { guessArticleGenreJa: () => '', pickRandomPatterns: () => [], buildBannerPromptFromPattern: () => '' },
        zod: require('zod'),
      })
      const response = await api.POST({ json: async () => ({}) }, { params: Promise.resolve({ id: 'article' }) })
      assert.equal(response.status, 403, file)
      assert.equal(providerCalls, 0, file)
      assert.equal(databaseCalls, 0, file)
    }
  })

  await check('SEO image writers reject exhausted reservations before any image provider call', async () => {
    const files = [
      ['src/app/api/seo/articles/[id]/images/banner/route.ts', {}, 4],
      ['src/app/api/seo/articles/[id]/images/diagram/route.ts', { title: '図解', description: '内容' }, 1],
      ['src/app/api/seo/articles/[id]/images/batch/route.ts', { diagrams: [{ title: 'A', description: '内容' }, { title: 'B', description: '内容' }] }, 2],
      ['src/app/api/seo/articles/[id]/images/suggest/route.ts', {}, 1],
      ['src/app/api/seo/articles/[id]/images/ensure/route.ts', {}, 14],
      ['src/app/api/seo/images/[id]/regenerate/route.ts', { prompt: '図解を再生成する' }, 1],
    ]
    class Limit extends Error { constructor() { super('limit'); this.limit = 100 } }
    for (const [file, body, expectedCount] of files) {
      let providerCalls = 0
      let released = 0
      let reserved = 0
      const article = { id: 'article', userId: 'owner', title: 'Title', finalMarkdown: '## 見出し', images: [] }
      const api = load(file, {
        'next/server': { NextResponse: Response },
        '@/lib/seo-image-access': { requireSeoImageAccess: async () => ({ ok: true, userId: 'owner' }) },
        '@/lib/prisma': { prisma: {
          seoArticle: { findFirst: async () => article, findUnique: async ({ select }) => select ? { userId: 'owner' } : article },
          seoImage: { findUnique: async () => ({ articleId: 'article', kind: 'DIAGRAM' }) },
        } },
        '@/lib/seo-tool-admission': { SeoToolRateLimitError: Limit, reserveSeoToolCalls: async (_userId, tool, count) => { assert.equal(tool, 'article-images'); reserved = count; throw new Limit() }, reserveSeoToolCall: async (_userId, tool) => { assert.equal(tool, 'image-suggestions'); reserved = 1; throw new Limit() } },
        '@/lib/seo-image-lease': { SeoImageGenerationInProgressError: class extends Error {}, claimSeoImageLease: async () => 'token', releaseSeoImageLease: async () => { released++ } },
        '@seo/lib/gemini': { geminiGenerateImagePng: async () => { providerCalls++ }, GEMINI_IMAGE_MODEL_DEFAULT: 'test' },
        '@seo/lib/storage': { ensureSeoStorage: async () => {}, saveBase64ToFile: async () => {} },
        '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
        '@seo/lib/bannerPlan': { guessArticleGenreJa: () => '', pickRandomPatterns: count => Array(count).fill({ label: 'A' }), buildBannerPromptFromPattern: () => '' },
        zod: require('zod'),
      })
      const response = await api.POST({ json: async () => body }, { params: Promise.resolve({ id: 'article' }) })
      assert.equal(response.status, 429, file)
      assert.equal(reserved, expectedCount, file)
      assert.equal(providerCalls, 0, file)
      if (file.includes('/ensure/')) assert.equal(released, 1)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
