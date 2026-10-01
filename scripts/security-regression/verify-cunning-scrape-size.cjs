const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const scraper = load('src/lib/cunning/scraper.ts', {
  dns: {},
  net: {},
  undici: { Agent: class {} },
  '@/lib/fetch-timeout': { withTimeout: async (_name, _ms, callback) => callback(new AbortController().signal) },
}, { TextDecoder })

;(async () => {
  await check('Cunning scraper accepts normal HTML and rejects declared oversized pages before reading', async () => {
    assert.equal(await scraper.readBoundedHtml(new Response('<title>Example</title>')), '<title>Example</title>')
    const declared = new Response('small body', { headers: { 'content-length': String(scraper.CUNNING_SCRAPE_MAX_BYTES + 1) } })
    await assert.rejects(scraper.readBoundedHtml(declared), error => error instanceof scraper.CunningScrapeTooLargeError)
  })

  await check('Cunning scraper stops chunked responses at the decoded byte ceiling', async () => {
    let cancelled = 0
    let sent = 0
    const body = new ReadableStream({
      pull(controller) {
        sent++
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
      },
      cancel() { cancelled++ },
    })
    await assert.rejects(scraper.readBoundedHtml(new Response(body)), error => error instanceof scraper.CunningScrapeTooLargeError)
    assert.equal(cancelled, 1)
    assert.ok(sent <= 3)
  })

  await check('Cunning URL consumers return actionable 413 without writing data', async () => {
    let writes = 0
    const tooLarge = async () => { throw new scraper.CunningScrapeTooLargeError() }
    const company = load('src/app/api/cunning/company/analyze/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { cunningCompanyProfile: { create: async () => { writes++ } } } },
      '@/lib/cunning/access': { getUserId: async () => 'owner' },
      '@/lib/cunning/company': { analyzeCompanyUrl: tooLarge },
      '@/lib/cunning/company-budget': { reserveCunningCompanyAnalysis: async () => {}, CUNNING_COMPANY_DAILY_LIMIT: 50, CunningCompanyDailyLimitError: class extends Error {} },
      '@/lib/cunning/scraper': { CunningScrapeTooLargeError: scraper.CunningScrapeTooLargeError },
    })
    assert.equal((await company.POST({ json: async () => ({ url: 'https://example.com' }) })).status, 413)
    const knowledge = load('src/app/api/cunning/knowledge/[id]/ingest/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { cunningKnowledgeBase: { findUnique: async () => ({ userId: 'owner' }) } } },
      '@/lib/cunning/access': { getUserId: async () => 'owner' },
      '@/lib/cunning/rag': { chunkText: () => { writes++; return ['Chunk'] }, CUNNING_KNOWLEDGE_MAX_CHUNKS: 500 },
      '@/lib/cunning/scraper': { scrapeUrl: tooLarge, CunningScrapeTooLargeError: scraper.CunningScrapeTooLargeError },
    })
    assert.equal((await knowledge.POST(
      { json: async () => ({ type: 'url', url: 'https://example.com' }) },
      { params: Promise.resolve({ id: 'base' }) },
    )).status, 413)
    assert.equal(writes, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
