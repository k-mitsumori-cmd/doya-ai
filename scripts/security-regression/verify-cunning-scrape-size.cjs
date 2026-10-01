const assert = require('node:assert/strict')
const net = require('node:net')
const { load, check } = require('./load-typescript.cjs')

const agents = []
const requests = []
const responses = []
class FakeAgent {
  constructor(options) { this.options = options; this.destroyed = false; agents.push(this) }
  async destroy() { this.destroyed = true }
}
const scraper = load('src/lib/cunning/scraper.ts', {
  net,
  undici: { Agent: FakeAgent, fetch: async (url, options) => {
    requests.push({ url, options })
    return responses.shift()
  } },
  '@/lib/fetch-timeout': { withTimeout: async (_name, _ms, callback) => callback(new AbortController().signal) },
  '@/lib/net/safe-fetch': { assertUrlSafe: async raw => {
    const url = new URL(raw)
    if (url.hostname === '127.0.0.1') throw new Error('private address rejected')
    return { url, pinnedIp: '93.184.216.34' }
  } },
}, { TextDecoder, AbortController, fetch: async () => { throw new Error('framework fetch must not run') } })

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

  await check('Cunning scraper pins every fetch and cancels a redirect before rejecting private destinations', async () => {
    responses.push(new Response('<title>Acme</title><p>Company</p>'))
    const page = await scraper.scrapeUrl('https://example.com')
    assert.equal(page.title, 'Acme')
    assert.equal(page.text, 'Acme Company')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].options.dispatcher, agents[0])
    assert.equal(agents[0].destroyed, true)
    assert.equal(requests[0].options.redirect, 'manual')
    await new Promise(resolve => agents[0].options.connect.lookup('example.com', { all: true }, (_err, addresses) => {
      assert.equal(addresses[0].address, '93.184.216.34')
      resolve()
    }))

    let cancelled = 0
    const redirectBody = new ReadableStream({ cancel() { cancelled++ } })
    responses.push(new Response(redirectBody, { status: 302, headers: { location: 'http://127.0.0.1/metadata' } }))
    await assert.rejects(scraper.scrapeUrl('https://example.com'), /private address rejected/)
    assert.equal(requests.length, 2, 'private redirect must stop before another network request')
    assert.equal(cancelled, 1)
    assert.equal(agents[1].destroyed, true)
  })

  await check('Cunning scraper stops before fetch when DNS does not answer by the deadline', async () => {
    let fetches = 0
    const stalled = load('src/lib/cunning/scraper.ts', {
      net,
      undici: { Agent: FakeAgent, fetch: async () => { fetches++; return new Response('unexpected') } },
      '@/lib/net/safe-fetch': { assertUrlSafe: async () => new Promise(() => {}) },
      '@/lib/fetch-timeout': { withTimeout: async (_name, _ms, callback) => {
        const controller = new AbortController()
        const result = callback(controller.signal)
        controller.abort(new Error('deadline'))
        return result
      } },
    }, { TextDecoder, AbortController })
    await assert.rejects(stalled.scrapeUrl('https://example.com'), /deadline/)
    assert.equal(fetches, 0)
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
