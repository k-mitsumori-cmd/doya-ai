// SEO記事を開いたときの自動の画像づくりは1記事1回だけ。有料の画像APIはモックで数え、実際には呼ばない。
const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function makeWorld() {
  const settings = new Map()
  const systemSetting = {
    create: async ({ data }) => {
      if (settings.has(data.key)) { const error = new Error('Unique constraint failed'); error.code = 'P2002'; throw error }
      settings.set(data.key, data.value)
      return data
    },
  }
  const attempt = load('src/lib/seo-image-auto-attempt.ts', { '@/lib/prisma': { prisma: { systemSetting } } })
  const state = { provider: 0, fail: false, released: 0, reserved: [] }
  const article = { id: 'article', userId: 'owner', title: 'Title', finalMarkdown: '## 見出し\n本文', images: [] }
  const route = load('src/app/api/seo/articles/[id]/images/ensure/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/seo-image-access': { requireSeoImageAccess: async () => ({ ok: true, userId: 'owner' }) },
    '@/lib/prisma': { prisma: {
      seoArticle: { findUnique: async ({ select }) => select ? { userId: 'owner' } : article },
      seoImage: { create: async () => ({}) },
      systemSetting,
    } },
    '@/lib/seo-tool-admission': { SeoToolRateLimitError: class extends Error {}, reserveSeoToolCalls: async (_user, _tool, count) => { state.reserved.push(count) } },
    '@/lib/seo-image-lease': { SeoImageGenerationInProgressError: class extends Error {}, claimSeoImageLease: async () => 'token', releaseSeoImageLease: async () => { state.released++ } },
    '@/lib/seo-image-auto-attempt': attempt,
    '@seo/lib/gemini': {
      geminiGenerateImagePng: async () => { state.provider++; if (state.fail) throw new Error('provider down'); return { dataBase64: 'cG5n', mimeType: 'image/png' } },
      geminiGenerateJson: async () => ({ diagrams: [] }),
      GEMINI_IMAGE_MODEL_DEFAULT: 'test', GEMINI_TEXT_MODEL_DEFAULT: 'test',
    },
    '@seo/lib/storage': { ensureSeoStorage: async () => {}, saveBase64ToFile: async () => ({ relativePath: 'images/x.png' }) },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@seo/lib/bannerPlan': { guessArticleGenreJa: () => '', pickRandomPatterns: count => Array(count).fill({ label: 'A' }), buildBannerPromptFromPattern: () => 'prompt' },
  }, { setTimeout: fn => { fn(); return 0 } })
  const open = async body => {
    const response = await route.POST({ json: async () => body }, { params: Promise.resolve({ id: 'article' }) })
    return { status: response.status, body: await response.json() }
  }
  return { open, state }
}

;(async () => {
  {
    const world = makeWorld()
    const first = await world.open({ trigger: 'auto' })
    assert.equal(first.status, 200)
    assert.ok(world.state.provider > 0)
    const callsAfterFirst = world.state.provider
    const second = await world.open({ trigger: 'auto' })
    assert.equal(second.status, 200)
    assert.equal(second.body.skipped, true)
    assert.equal(world.state.provider, callsAfterFirst)
    // 本文の無い古い画面からの呼び出しも自動として扱う
    const legacy = await world.open({})
    assert.equal(legacy.body.skipped, true)
    assert.equal(world.state.provider, callsAfterFirst)
    console.log('PASS second automatic open does not call the image API')
  }
  {
    const world = makeWorld()
    world.state.fail = true
    const first = await world.open({ trigger: 'auto' })
    assert.equal(first.status, 500)
    const callsAfterFailure = world.state.provider
    assert.ok(callsAfterFailure > 0)
    world.state.fail = false
    for (let i = 0; i < 3; i++) {
      const again = await world.open({ trigger: 'auto' })
      assert.equal(again.status, 200)
      assert.equal(again.body.skipped, true)
    }
    assert.equal(world.state.provider, callsAfterFailure)
    console.log('PASS opening again after a failure does not call the image API')
    const manual = await world.open({ trigger: 'manual' })
    assert.equal(manual.status, 200)
    assert.ok(world.state.provider > callsAfterFailure)
    console.log('PASS the button (manual) can still regenerate after a failed automatic attempt')
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
