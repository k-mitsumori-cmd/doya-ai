const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  await check('Cunning knowledge chunking never leaves oversized sentences unsplit', async () => {
    const rag = load('src/lib/cunning/rag.ts', { '@/lib/prisma': { prisma: {} } })
    const text = 'A'.repeat(2501)
    const chunks = rag.chunkText(text)
    assert.equal(chunks.join(''), text)
    assert.ok(chunks.length >= 3)
    assert.ok(chunks.every(chunk => chunk.length <= 1000))
    const emoji = '😀'.repeat(1200)
    const emojiChunks = rag.chunkText(emoji)
    assert.equal(emojiChunks.join(''), emoji)
    assert.ok(emojiChunks.every(chunk => chunk.length <= 1000))
    assert.ok(rag.chunkText('A' + ' '.repeat(2000) + 'B').every(chunk => chunk.length > 0))
  })

  await check('Cunning knowledge retrieval prefers recent chunks for historical oversized bases', async () => {
    let query
    const rag = load('src/lib/cunning/rag.ts', { '@/lib/prisma': { prisma: {
      cunningKnowledgeChunk: { findMany: async options => { query = options; return [] } },
    } } })
    await rag.retrieveChunks('base', 'question')
    assert.equal(query.take, 500)
    assert.equal(query.orderBy[0].createdAt, 'desc')
    assert.equal(query.orderBy[1].id, 'desc')
  })

  await check('Cunning knowledge capacity serializes concurrent ingests and prevents hidden chunks', async () => {
    let count = 499
    let writes = 0
    let tail = Promise.resolve()
    const tx = {
      $executeRaw: async () => {},
      cunningKnowledgeChunk: {
        count: async () => count,
        createMany: async ({ data }) => { count += data.length; writes++; return { count: data.length } },
      },
      cunningKnowledgeBase: { update: async () => ({}) },
    }
    const db = {
      cunningKnowledgeBase: { findUnique: async () => ({ userId: 'owner' }) },
      $transaction: async callback => {
        let release
        const previous = tail
        tail = new Promise(resolve => { release = resolve })
        await previous
        try { return await callback(tx) } finally { release() }
      },
    }
    const route = load('src/app/api/cunning/knowledge/[id]/ingest/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: db },
      '@/lib/cunning/access': { getUserId: async () => 'owner' },
      '@/lib/cunning/rag': { chunkText: () => ['Chunk'], CUNNING_KNOWLEDGE_MAX_CHUNKS: 500 },
      '@/lib/cunning/scraper': { scrapeUrl: async () => ({ text: 'Text', url: 'https://example.com', title: 'Example' }), CunningScrapeTooLargeError: class extends Error {} },
    })
    const request = { json: async () => ({ type: 'text', text: 'Text' }) }
    const ctx = { params: Promise.resolve({ id: 'base' }) }
    const responses = await Promise.all([route.POST(request, ctx), route.POST(request, ctx)])
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
    assert.equal(count, 500)
    assert.equal(writes, 1)
    const blocked = responses.find(response => response.status === 409)
    assert.equal((await blocked.json()).code, 'CUNNING_KNOWLEDGE_CAPACITY')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
