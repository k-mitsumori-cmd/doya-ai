const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { z } = require('zod')
const { load, check } = require('./load-typescript.cjs')

const budget = load('src/lib/cunning/company-budget.ts', {
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
  await check('Cunning company analysis serializes at the JST daily ceiling and resets at midnight', async () => {
    const key = budget.cunningCompanyUsageKey('owner')
    const db = database([[key, '2026-09-25:49']])
    const now = new Date('2026-09-25T14:59:59Z')
    const attempts = await Promise.allSettled([
      budget.reserveCunningCompanyAnalysis('owner', db, now),
      budget.reserveCunningCompanyAnalysis('owner', db, now),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof budget.CunningCompanyDailyLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:50')
    await budget.reserveCunningCompanyAnalysis('owner', db, new Date('2026-09-25T15:00:00Z'))
    assert.equal(db.rows.get(key), '2026-09-26:1')
  })

  await check('Cunning company analysis rejects invalid input and cap before external work', async () => {
    let reserves = 0
    let calls = 0
    let writes = 0
    let limited = true
    const api = load('src/app/api/cunning/company/analyze/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { cunningCompanyProfile: { create: async () => { writes++; return { id: 'profile' } } } } },
      '@/lib/cunning/access': { getUserId: async () => 'owner' },
      '@/lib/cunning/company-budget': {
        ...budget,
        reserveCunningCompanyAnalysis: async () => { reserves++; if (limited) throw new budget.CunningCompanyDailyLimitError() },
      },
      '@/lib/cunning/company': { analyzeCompanyUrl: async () => {
        calls++
        return { extract: { companyName: 'Acme', businessSummary: 'Summary', requirements: {} }, rawText: 'Text' }
      } },
      '@/lib/cunning/scraper': { CunningScrapeTooLargeError: class extends Error {} },
    })
    const request = url => ({ json: async () => ({ url }) })
    for (const url of ['ftp://example.com', 'invalid', 'https://example.com/' + 'a'.repeat(2050)]) {
      assert.equal((await api.POST(request(url))).status, 400)
    }
    assert.equal(reserves, 0)
    const blocked = await api.POST(request('https://example.com'))
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).code, 'CUNNING_COMPANY_DAILY_LIMIT')
    assert.equal(calls, 0)
    assert.equal(writes, 0)
    limited = false
    assert.equal((await api.POST(request('https://example.com'))).status, 200)
    assert.equal(calls, 1)
    assert.equal(writes, 1)
  })

  await check('Cunning company extraction rejects malformed or empty AI output', async () => {
    let response
    const company = load('src/lib/cunning/company.ts', {
      zod: { z },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'mock', geminiGenerateJson: async () => response },
      './scraper': { scrapeUrl: async () => ({ url: 'https://example.com', title: 'Acme', text: 'Company text' }) },
    })
    response = { companyName: 'Acme', businessSummary: 'Summary', requirements: {
      idealCandidate: [], responsibilities: [], values: [], keywords: [],
    } }
    assert.equal((await company.analyzeCompanyUrl('https://example.com')).extract.companyName, 'Acme')
    response = { companyName: 'Acme', businessSummary: 'Summary', requirements: null }
    await assert.rejects(company.analyzeCompanyUrl('https://example.com'))
    response = { companyName: '', businessSummary: '', requirements: {
      idealCandidate: [], responsibilities: [], values: [], keywords: [],
    } }
    await assert.rejects(company.analyzeCompanyUrl('https://example.com'), /no information/)
  })

  await check('Cunning company operational ceiling is not presented as an upgrade allowance', async () => {
    const limitUi = load('src/lib/service-limit-ui.ts', {
      './services': { SERVICES: [{ id: 'cunning', name: 'ドヤカンニング', pricingHref: '/cunning/pricing' }] },
    })
    assert.equal(limitUi.classifyServiceLimit('/api/cunning/company/analyze', 429, {
      code: 'CUNNING_COMPANY_DAILY_LIMIT', error: '本日の企業URL解析の運用上限に達しました',
    }), null)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
