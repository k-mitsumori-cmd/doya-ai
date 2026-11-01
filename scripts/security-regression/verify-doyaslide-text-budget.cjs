const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { z } = require('zod')
const { load, check } = require('./load-typescript.cjs')

const budget = load('src/lib/doyaslide/text-budget.ts', {
  'node:crypto': { createHash },
  '@/lib/prisma': { prisma: {} },
})

function database(initial) {
  const rows = new Map(initial)
  let tail = Promise.resolve()
  const tx = {
    $executeRaw: async () => {},
    $queryRaw: async () => [{id: 'owner'}],
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
      deleteMany: async ({where}) => { if(rows.get(where.key) === where.value) rows.delete(where.key); return {count: 1} },
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
  await check('DoyaSlide text calls serialize at the JST daily ceiling and reset at midnight', async () => {
    const key = budget.doyaSlideTextUsageKey('owner', 'url-analysis')
    const db = database([[key, '2026-09-25:49']])
    const now = new Date('2026-09-25T14:59:59Z')
    const attempts = await Promise.allSettled([
      budget.reserveDoyaSlideTextCall('owner', 'url-analysis', db, now),
      budget.reserveDoyaSlideTextCall('owner', 'url-analysis', db, now),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof budget.DoyaSlideTextLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:50')
    assert.equal((await budget.reserveDoyaSlideTextCall('owner', 'url-analysis', db, new Date('2026-09-25T15:00:00Z'))).used, 1)
    assert.equal(db.rows.get(key), '2026-09-26:1')
  })

  await check('DoyaSlide text ledger corruption fails closed', async () => {
    const key = budget.doyaSlideTextUsageKey('owner', 'structure')
    const db = database([[key, 'invalid']])
    await assert.rejects(budget.reserveDoyaSlideTextCall('owner', 'structure', db), /ledger invalid/)
    assert.equal(db.rows.get(key), 'invalid')
  })

  await check('DoyaSlide URL analysis rejects the cap before fetching or calling AI', async () => {
    let fetches = 0
    let modelCalls = 0
    const db = database([[budget.doyaSlideTextUsageKey('owner', 'url-analysis'), new Date(Date.now()+9*3600000).toISOString().slice(0,10)+':50']])
    const operation = load('src/lib/doyaslide/url-analysis-operation.ts', {
      'node:crypto': require('node:crypto'), '@/lib/prisma': { prisma: db },
      './text-budget': budget,
    })
    const api = load('src/app/api/doyaslide/analyze/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/doyaslide/access': { getUserId: async () => 'owner' },
      '@/lib/doyaslide/url-analysis-operation': operation,
      '@/lib/doyaslide/scrape': { scrapeUrlText: async () => { fetches++; return { title: 'Example', description: 'Summary', text: 'Content' } } },
      '@/lib/doyaslide/prompts': { buildAnalyzePrompt: () => 'prompt' },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'mock', geminiGenerateJson: async () => { modelCalls++; return { title: 'AI title', brief: 'AI brief' } } },
    }, { TextDecoder })
    let sequence = 0
    const post = url => api.POST(new Request('https://example.invalid/api/doyaslide/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({url, operationId: '10000000-0000-4000-8000-'+String(++sequence).padStart(12,'0') }),
    }))
    assert.equal((await post(42)).status, 400)
    assert.equal((await post('ftp://example.com')).status, 400)
    assert.equal((await post('https://example.com/' + 'a'.repeat(2050))).status, 400)
    assert.equal(db.rows.size, 1)
    const blocked = await post('https://example.com')
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).code, 'DOYASLIDE_TEXT_DAILY_LIMIT')
    assert.equal(fetches, 0)
    assert.equal(modelCalls, 0)
    db.rows.delete(budget.doyaSlideTextUsageKey('owner','url-analysis'))
    assert.equal((await post('https://example.com')).status, 200)
    assert.equal(fetches, 1)
    assert.equal(modelCalls, 1)
  })

  await check('DoyaSlide structure cap releases its claim and blocks paid dependencies', async () => {
    let status = 'draft'
    let searches = 0
    let modelCalls = 0
    const updatedAt = new Date(0)
    const api = load('src/app/api/doyaslide/structure/route.ts', {
      'next/server': { NextResponse: Response },
      zod: { z },
      '@/lib/doyaslide/access': { getUserId: async () => 'owner' },
      '@/lib/doyaslide/text-budget': {
        DoyaSlideTextLimitError: budget.DoyaSlideTextLimitError,
        reserveDoyaSlideTextCall: async (userId, tool) => {
          assert.equal(userId, 'owner')
          assert.equal(tool, 'structure')
          throw new budget.DoyaSlideTextLimitError(50)
        },
      },
      '@/lib/prisma': { prisma: {
        doyaSlideProject: {
          findFirst: async () => ({ id: 'project', userId: 'owner', status, updatedAt }),
          updateMany: async ({ data }) => { status = data.status; return { count: 1 } },
        },
        doyaSlideSlide: { count: async () => 0 },
      } },
      '@/lib/doyaslide/prompts': { buildStructurePrompt: () => 'prompt' },
      '@/lib/doyaslide/scrape': { scrapeUrlText: async () => { searches++; return { title: '', text: '' } } },
      '@seo/lib/serpapi': { hasSerpApiKey: () => { searches++; return false } },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'mock', geminiGenerateJson: async () => { modelCalls++; return { slides: [] } } },
      '@/lib/doyaslide/errors': { errorSuffix: () => '' },
    })
    const response = await api.POST({ json: async () => ({ projectId: 'project', referenceUrl: 'https://example.com' }) })
    assert.equal(response.status, 429)
    assert.equal((await response.json()).code, 'DOYASLIDE_TEXT_DAILY_LIMIT')
    assert.equal(status, 'error')
    assert.equal(searches, 0)
    assert.equal(modelCalls, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
