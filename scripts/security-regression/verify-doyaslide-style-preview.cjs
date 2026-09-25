const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  await check('style preview lease serializes duplicate requests and expires safely', async () => {
    const lease = load('src/lib/doyaslide/style-preview-lease.ts', {
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
      $transaction: async fn => {
        let release
        const before = tail
        tail = new Promise(resolve => { release = resolve })
        await before
        try { return await fn(tx) } finally { release() }
      },
      systemSetting: { deleteMany: async ({ where }) => { if (rows.get(where.key) === where.value) rows.delete(where.key) } },
    }
    const first = await lease.claimStylePreviewLease('corporate', db, 1000)
    const contenders = await Promise.allSettled([
      lease.claimStylePreviewLease('corporate', db, 1000),
      lease.claimStylePreviewLease('corporate', db, 1000),
    ])
    assert.equal(contenders.filter(result => result.reason instanceof lease.StylePreviewInProgressError).length, 2)
    await lease.releaseStylePreviewLease('corporate', 'wrong-token', db)
    await assert.rejects(lease.claimStylePreviewLease('corporate', db, 1000), lease.StylePreviewInProgressError)
    await lease.releaseStylePreviewLease('corporate', first, db)
    const second = await lease.claimStylePreviewLease('corporate', db, 1000)
    assert.notEqual(first, second)
    assert.notEqual(await lease.claimStylePreviewLease('corporate', db, 361001), second)
    await assert.rejects(lease.claimStylePreviewLease('../other', db), /Invalid style/)

    const budgetKey = 'doyaslide-style-preview-budget:v1'
    rows.set(budgetKey, '2026-09-25:118')
    const now = new Date('2026-09-25T01:00:00.000Z')
    const attempts = await Promise.allSettled([
      lease.reserveStylePreviewImages(2, db, now),
      lease.reserveStylePreviewImages(2, db, now),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof lease.StylePreviewBudgetError).length, 1)
    assert.equal(rows.get(budgetKey), '2026-09-25:120')
    await lease.reserveStylePreviewImages(3, db, new Date('2026-09-25T15:00:00.000Z'))
    assert.equal(rows.get(budgetKey), '2026-09-26:3')
  })

  await check('storage lookup errors fail closed before provider calls', async () => {
    let providers = 0
    const api = load('src/app/api/doyaslide/style-preview/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/image-generator': { generateImageWithFallback: async () => { providers++ } },
      '@/lib/doyaslide/access': { getUserId: async () => 'user' },
      '@/lib/doyaslide/prompts': { buildImagePrompt: () => 'prompt' },
      '@/lib/doyaslide/constants': { STYLE_PRESETS: [{ value: 'corporate' }], STYLE_PREVIEW_SAMPLE_SLIDES: [{ index: 1 }, { index: 2 }, { index: 3 }], getStylePreviewColor: () => '#123' },
      '@/lib/doyaslide/storage': { stylePreviewExists: async () => { throw Error('storage offline') }, stylePreviewPublicUrl: () => 'url', uploadStylePreview: async () => { throw Error('unexpected upload') } },
      '@/lib/doyaslide/aspect': { normalizeGeneratedSlide: async () => ({ base64: 'png' }) },
      '@/lib/doyaslide/style-preview-lease': { StylePreviewBudgetError: class extends Error {}, reserveStylePreviewImages: async () => {}, StylePreviewInProgressError: class extends Error {}, claimStylePreviewLease: async () => { throw Error('unexpected claim') }, releaseStylePreviewLease: async () => {} },
    })
    const response = await api.GET(new Request('https://example.test/api/doyaslide/style-preview?style=corporate'))
    assert.equal(response.status, 500)
    assert.equal(providers, 0)
  })

  await check('storage helper distinguishes missing preview from failed listing', async () => {
    let result = { data: [], error: null }
    const storage = load('src/lib/doyaslide/storage.ts', {
      '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ list: async () => result }) } }) },
      crypto: { randomUUID: () => 'uuid' },
    })
    assert.equal(await storage.stylePreviewExists('corporate', 0), false)
    result = { data: null, error: { message: 'unavailable' } }
    await assert.rejects(storage.stylePreviewExists('corporate', 0), /確認できません/)
  })

  await check('in-progress preview returns retry signal without duplicate generation', async () => {
    let providers = 0
    class InProgress extends Error {}
    const api = load('src/app/api/doyaslide/style-preview/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/image-generator': { generateImageWithFallback: async () => { providers++ } },
      '@/lib/doyaslide/access': { getUserId: async () => 'user' },
      '@/lib/doyaslide/prompts': { buildImagePrompt: () => 'prompt' },
      '@/lib/doyaslide/constants': { STYLE_PRESETS: [{ value: 'corporate' }], STYLE_PREVIEW_SAMPLE_SLIDES: [{ index: 1 }, { index: 2 }, { index: 3 }], getStylePreviewColor: () => '#123' },
      '@/lib/doyaslide/storage': { stylePreviewExists: async () => false, stylePreviewPublicUrl: () => 'url', uploadStylePreview: async () => { throw Error('unexpected upload') } },
      '@/lib/doyaslide/aspect': { normalizeGeneratedSlide: async () => ({ base64: 'png' }) },
      '@/lib/doyaslide/style-preview-lease': { StylePreviewBudgetError: class extends Error {}, reserveStylePreviewImages: async () => {}, StylePreviewInProgressError: InProgress, claimStylePreviewLease: async () => { throw new InProgress() }, releaseStylePreviewLease: async () => {} },
    })
    const response = await api.GET(new Request('https://example.test/api/doyaslide/style-preview?style=corporate'))
    assert.equal(response.status, 202)
    assert.equal((await response.json()).pending, true)
    assert.equal(providers, 0)
  })
  await check('successful preview generation is cached and releases its lease', async () => {
    const cached = new Set()
    let providers = 0
    let claims = 0
    let releases = 0
    const api = load('src/app/api/doyaslide/style-preview/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/image-generator': { generateImageWithFallback: async () => { providers++; return { base64: 'png', mimeType: 'image/png' } } },
      '@/lib/doyaslide/access': { getUserId: async () => 'user' },
      '@/lib/doyaslide/prompts': { buildImagePrompt: () => 'prompt' },
      '@/lib/doyaslide/constants': { STYLE_PRESETS: [{ value: 'corporate' }], STYLE_PREVIEW_SAMPLE_SLIDES: [{ index: 1 }, { index: 2 }, { index: 3 }], getStylePreviewColor: () => '#123' },
      '@/lib/doyaslide/storage': { stylePreviewExists: async (_, page) => cached.has(page), stylePreviewPublicUrl: (_, page) => `url-${page}`, uploadStylePreview: async (_, __, page) => { cached.add(page); return `url-${page}` } },
      '@/lib/doyaslide/aspect': { normalizeGeneratedSlide: async base64 => ({ base64 }) },
      '@/lib/doyaslide/style-preview-lease': { StylePreviewBudgetError: class extends Error {}, reserveStylePreviewImages: async () => {}, StylePreviewInProgressError: class extends Error {}, claimStylePreviewLease: async () => { claims++; return 'token' }, releaseStylePreviewLease: async () => { releases++ } },
    })
    const request = new Request('https://example.test/api/doyaslide/style-preview?style=corporate')
    assert.equal((await api.GET(request)).status, 200)
    assert.equal(providers, 3)
    assert.equal(claims, 1)
    assert.equal(releases, 1)
    const again = await api.GET(request)
    assert.equal((await again.json()).urls.length, 3)
    assert.equal(providers, 3)
    assert.equal(claims, 1)
  })
  await check('daily provider ceiling rejects before generating and releases the lease', async () => {
    class BudgetError extends Error {}
    let providers = 0
    let releases = 0
    const api = load('src/app/api/doyaslide/style-preview/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/image-generator': { generateImageWithFallback: async () => { providers++ } },
      '@/lib/doyaslide/access': { getUserId: async () => 'user' },
      '@/lib/doyaslide/prompts': { buildImagePrompt: () => 'prompt' },
      '@/lib/doyaslide/constants': { STYLE_PRESETS: [{ value: 'corporate' }], STYLE_PREVIEW_SAMPLE_SLIDES: [{ index: 1 }, { index: 2 }, { index: 3 }], getStylePreviewColor: () => '#123' },
      '@/lib/doyaslide/storage': { stylePreviewExists: async () => false, stylePreviewPublicUrl: () => 'url', uploadStylePreview: async () => { throw Error('unexpected upload') } },
      '@/lib/doyaslide/aspect': { normalizeGeneratedSlide: async () => ({ base64: 'png' }) },
      '@/lib/doyaslide/style-preview-lease': { StylePreviewBudgetError: BudgetError, StylePreviewInProgressError: class extends Error {}, claimStylePreviewLease: async () => 'token', reserveStylePreviewImages: async () => { throw new BudgetError() }, releaseStylePreviewLease: async () => { releases++ } },
    })
    const response = await api.GET(new Request('https://example.test/api/doyaslide/style-preview?style=corporate'))
    assert.equal(response.status, 429)
    assert.equal((await response.json()).code, 'STYLE_PREVIEW_DAILY_CAP')
    assert.equal(providers, 0)
    assert.equal(releases, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
