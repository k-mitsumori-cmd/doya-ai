const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const profileInput = load('src/lib/quote/profile-input.ts')
const counters = { analyze: 0, suggest: 0, estimate: 0 }
const profile = { summary: '説明', publishedPrices: ['月額10,000円'] }
const deps = {
  'next/server': { NextResponse: Response },
  '@/lib/quote/access': { getQuoteContext: async () => ({ organizationId: 'org' }), orgSlugFrom: () => 'org' },
  '@/lib/prisma': { prisma: { quoteProduct: { findFirst: async () => ({ id: 'product', name: '商材', profile }) } } },
  '@/lib/quote/profile-input': profileInput,
  '@/lib/quote/analyze': {
    analyzeProduct: async () => { counters.analyze++; return profile },
    suggestItems: async input => { counters.suggest++; assert.equal(input.productName, '商材'); return [] },
    estimateItem: async input => { counters.estimate++; assert.equal(input.itemName, '作業'); return {} },
  },
}
const analyze = load('src/app/api/quote/products/analyze/route.ts', deps)
const suggest = load('src/app/api/quote/documents/suggest/route.ts', deps)
const estimate = load('src/app/api/quote/documents/estimate-item/route.ts', deps)
const request = body => ({ json: async () => body })

;(async () => {
  await check('quote AI rejects malformed inputs before provider calls', async () => {
    for (const body of [{ url: {} }, { url: 'a'.repeat(2049) }, []]) {
      assert.equal((await analyze.POST(request(body))).status, 400)
    }
    for (const body of [{ productName: {} }, { productName: '商材', profile: [] }, { productName: '商材', profile, budget: '1.5' }, { productName: '商材', profile, situation: {} }]) {
      assert.equal((await suggest.POST(request(body))).status, 400)
    }
    for (const body of [{ itemName: {} }, { itemName: '作業', spec: {} }, { itemName: '作業', productId: {} }]) {
      assert.equal((await estimate.POST(request(body))).status, 400)
    }
    assert.deepEqual(counters, { analyze: 0, suggest: 0, estimate: 0 })
  })
  await check('quote AI still accepts normal input and bounds prompt fields', async () => {
    const cleaned = profileInput.sanitizeProductProfile({
      summary: '長'.repeat(1000),
      publishedPrices: ['価格'.repeat(500), {}, ...Array(30).fill('追加')],
      optionCandidates: 'invalid',
    })
    assert.equal(cleaned.summary.length, 600)
    assert.equal(cleaned.publishedPrices.length, 20)
    assert.equal(cleaned.publishedPrices[0].length, 300)
    assert.equal(cleaned.optionCandidates, undefined)
    assert.equal((await analyze.POST(request({ url: 'example.com' }))).status, 200)
    assert.equal((await suggest.POST(request({ productId: 'product', budget: 100000 }))).status, 200)
    assert.equal((await estimate.POST(request({ itemName: '作業', productId: 'product' }))).status, 200)
    assert.deepEqual(counters, { analyze: 1, suggest: 1, estimate: 1 })
  })
  await check('quote provider malformed price arrays do not discard valid analysis', async () => {
    const module = load('src/lib/quote/analyze.ts', {
      '@/lib/net/safe-fetch': { safeFetchText: async () => '<title>会社</title>' + '内容'.repeat(150), htmlToText: html => html },
      '@seo/lib/gemini': { geminiGenerateJson: async () => ({ companyName: '会社', publishedPrices: 'wrong', optionCandidates: ['案', {}] }), GEMINI_TEXT_MODEL_DEFAULT: 'test' },
      './market': { lookupMarket: () => null, marketTableForPrompt: () => '' },
    })
    const result = await module.analyzeProduct('https://example.com')
    assert.deepEqual(Array.from(result.publishedPrices), [])
    assert.deepEqual(Array.from(result.optionCandidates), ['案'])
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
