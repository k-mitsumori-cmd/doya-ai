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

  const loadRoute = (storage, counters) => load('src/app/api/doyaslide/style-preview/route.ts', {
    'next/server': { NextResponse: Response },
    // 画像生成と lease は GET から呼ばれてはいけない。import されたら数える。
    '@/lib/image-generator': { generateImageWithFallback: async () => { counters.providers++ } },
    '@/lib/doyaslide/style-preview-lease': new Proxy({}, { get: () => { counters.lease++; return async () => {} } }),
    '@/lib/doyaslide/access': { getUserId: async () => 'user' },
    '@/lib/doyaslide/constants': { STYLE_PRESETS: [{ value: 'corporate' }], STYLE_PREVIEW_SAMPLE_SLIDES: [{ index: 1 }, { index: 2 }, { index: 3 }], getStylePreviewColor: () => '#123' },
    '@/lib/doyaslide/storage': { ...storage, uploadStylePreview: async () => { counters.uploads++ } },
  })
  await check('storage lookup errors fail closed before provider calls', async () => {
    const counters = { providers: 0, lease: 0, uploads: 0 }
    const api = loadRoute({ stylePreviewExists: async () => { throw Error('storage offline') }, stylePreviewPublicUrl: () => 'url' }, counters)
    const response = await api.GET(new Request('https://example.test/api/doyaslide/style-preview?style=corporate'))
    assert.equal(response.status, 500)
    assert.deepEqual(counters, { providers: 0, lease: 0, uploads: 0 })
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

  await check('GET never generates missing previews, even for signed-in users (cost guard)', async () => {
    const counters = { providers: 0, lease: 0, uploads: 0 }
    const cached = new Set([1])
    const api = loadRoute({ stylePreviewExists: async (_, page) => cached.has(page), stylePreviewPublicUrl: (_, page) => `url-${page}` }, counters)
    const request = new Request('https://example.test/api/doyaslide/style-preview?style=corporate')
    for (let i = 0; i < 3; i++) {
      const response = await api.GET(request)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { url: 'url-1', urls: ['url-1'], pending: false })
    }
    cached.clear()
    const empty = await api.GET(request)
    assert.deepEqual(await empty.json(), { url: null, urls: [], pending: false })
    assert.deepEqual(counters, { providers: 0, lease: 0, uploads: 0 })
  })
  await check('fully cached previews are returned as-is', async () => {
    const counters = { providers: 0, lease: 0, uploads: 0 }
    const api = loadRoute({ stylePreviewExists: async () => true, stylePreviewPublicUrl: (_, page) => `url-${page}` }, counters)
    const response = await api.GET(new Request('https://example.test/api/doyaslide/style-preview?style=corporate'))
    assert.deepEqual((await response.json()).urls, ['url-0', 'url-1', 'url-2'])
    assert.equal(counters.providers, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
