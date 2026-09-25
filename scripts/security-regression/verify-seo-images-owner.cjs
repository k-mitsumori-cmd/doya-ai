const assert = require('node:assert/strict')
const { z } = require('zod')
const { load, check, results } = require('./load-typescript.cjs')

;(async () => {
  for (const route of ['banner', 'diagram', 'batch', 'suggest']) {
    for (const identity of ['owner', 'other', 'guest', 'other-guest', 'anonymous']) {
      for (const kind of ['user', 'guest']) {
        await check(`${route} ${identity} ${kind}`, async () => {
          const row = { id: 'article', userId: kind === 'user' ? 'u' : null, guestId: 'g', title: 'title', finalMarkdown: '## Heading\nbody', keywords: [] }
          let ai = 0
          let writes = 0
          let storage = 0
          let reserved = 0
          const owner = load('src/lib/seoArticleOwner.ts', {
            'next-auth': { getServerSession: async () => ['owner', 'other'].includes(identity) ? { user: { id: identity === 'owner' ? 'u' : 'x' } } : null },
            '@/lib/auth': {},
            '@/lib/seoAccess': { getGuestIdFromRequest: () => identity === 'guest' ? 'g' : identity === 'other-guest' ? 'x' : null },
          })
          const access = async () => ['owner', 'other'].includes(identity)
            ? { ok: true, userId: identity === 'owner' ? 'u' : 'x' }
            : { ok: false, response: new Response('{}', { status: 401 }) }
          const api = load(`src/app/api/seo/articles/[id]/images/${route}/route.ts`, {
            'next/server': { NextResponse: Response },
            zod: { z },
            '@/lib/seoArticleOwner': owner,
            '@/lib/seo-image-access': { requireSeoImageAccess: access },
            '@/lib/seo-tool-admission': { SeoToolRateLimitError: class extends Error {}, reserveSeoToolCalls: async () => { reserved++ }, reserveSeoToolCall: async () => { reserved++ } },
            '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
            '@seo/lib/bannerPlan': { guessArticleGenreJa: () => '', pickRandomPatterns: () => [{ label: 'pattern' }], buildBannerPromptFromPattern: () => '' },
            '@seo/lib/storage': { ensureSeoStorage: async () => {}, saveBase64ToFile: async () => { storage++; return { relativePath: 'synthetic.png' } } },
            '@seo/lib/gemini': { geminiGenerateImagePng: async () => { ai++; return { dataBase64: 'AA==' } }, geminiGenerateJson: async () => { ai++; return { diagrams: [] } } },
            '@/lib/prisma': { prisma: {
              seoArticle: { findFirst: async ({ where }) => Object.entries(where).every(([key, value]) => row[key] === value) ? row : null },
              seoImage: { create: async () => { writes++; return { id: 'image' } } },
            } },
          }, { setTimeout: fn => fn() })
          const response = await api.POST({ json: async () => ({ title: 'concept', description: 'detail', diagrams: [{ title: 'concept', description: 'detail' }] }) }, { params: Promise.resolve({ id: 'article' }) })
          const allowed = identity === 'owner' && kind === 'user'
          const expectedStatus = allowed ? 200 : !['owner', 'other'].includes(identity) ? 401 : 404
          assert.equal(response.status, expectedStatus)
          assert.equal(ai, allowed ? 1 : 0)
          assert.equal(writes, allowed && route !== 'suggest' ? 1 : 0)
          assert.equal(storage, writes)
          assert.equal(reserved, allowed ? 1 : 0)
        })
      }
    }
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
