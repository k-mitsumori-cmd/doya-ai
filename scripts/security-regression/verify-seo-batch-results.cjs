const assert = require('node:assert/strict')
const { z } = require('zod')
const { load, check, results } = require('./load-typescript.cjs')

function fixture(fail = 0) {
  let calls = 0
  let saved = 0
  let reserved = 0
  const api = load('src/app/api/seo/articles/[id]/images/batch/route.ts', {
    'next/server': { NextResponse: Response },
    zod: { z },
    '@/lib/seo-image-access': { requireSeoImageAccess: async () => ({ ok: true, userId: 'u' }) },
    '@/lib/seo-tool-admission': { SeoToolRateLimitError: class extends Error {}, reserveSeoToolCalls: async (_userId, tool, count) => { assert.equal(tool, 'article-images'); reserved += count } },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@seo/lib/storage': { ensureSeoStorage: async () => {}, saveBase64ToFile: async () => { saved++; return { relativePath: 'image.png' } } },
    '@seo/lib/gemini': { geminiGenerateImagePng: async () => { calls++; return { dataBase64: calls <= fail ? '' : 'AA==' } } },
    '@/lib/prisma': { prisma: { seoArticle: { findFirst: async () => ({ id: 'a' }) }, seoImage: { create: async () => ({ id: `image-${saved}` }) } } },
  }, { setTimeout: fn => fn() })
  return {
    run: body => api.POST({ json: async () => body }, { params: Promise.resolve({ id: 'a' }) }),
    calls: () => calls,
    saved: () => saved,
    reserved: () => reserved,
  }
}

;(async () => {
  for (const body of [null, {}, { diagrams: [] }, { diagrams: 'bad' }, { diagrams: [{ title: '', description: 'x' }] }, { diagrams: Array.from({ length: 11 }, () => ({ title: 'x', description: 'y' })) }]) {
    await check(`invalid batch ${JSON.stringify(body)}`, async () => {
      const fixtureCase = fixture()
      assert.equal((await fixtureCase.run(body)).status, 400)
      assert.equal(fixtureCase.calls(), 0)
      assert.equal(fixtureCase.reserved(), 0)
    })
  }
  for (const fail of [0, 1, 2]) {
    await check(`two images ${fail} failures`, async () => {
      const fixtureCase = fixture(fail)
      const response = await fixtureCase.run({ diagrams: [{ title: 'a', description: 'x' }, { title: 'b', description: 'y' }] })
      const body = await response.json()
      assert.equal(response.status, fail ? 502 : 200)
      assert.equal(body.success, fail === 0)
      assert.equal(body.summary.total, 2)
      assert.equal(body.summary.failed, fail)
      assert.equal(body.summary.success, 2 - fail)
      assert.equal(fixtureCase.saved(), 2 - fail)
      assert.equal(body.results.filter(result => result.imageId).length, 2 - fail)
      assert.equal(fixtureCase.reserved(), 2)
    })
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
