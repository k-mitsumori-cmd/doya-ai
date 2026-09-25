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
})().catch(error => { console.error(error); process.exitCode = 1 })
