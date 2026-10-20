// 利用者が押していないのに有料の画像APIを呼ばないことの確認（2026-10-19 原価見直し）。
//  1) ドヤスライド: 新規作成の画面を開く・見本を GET しても、画像生成は呼ばれない。見本が無ければ静的な SVG を出す。
//  2) インタビュー: 自動生成を停止。初回はボタン操作で記事に付属し、再生成だけ追加AI編集枠を消費する。
// 外部APIは呼ばない。画像生成はモックにして、呼び出し回数を数える。
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const React = require('react')
const { JSDOM } = require('jsdom')
const { load, check } = require('./load-typescript.cjs')

const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/doyaslide/new' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')

const constants = load('src/lib/doyaslide/constants.ts')
const placeholder = load('src/lib/doyaslide/style-placeholder.ts', { './constants': constants })

function styleRoute(counters, cached) {
  return load('src/app/api/doyaslide/style-preview/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/image-generator': { generateImageWithFallback: async () => { counters.providers++; throw Error('paid image API must not be called') } },
    '@/lib/doyaslide/constants': constants,
    '@/lib/doyaslide/storage': {
      stylePreviewExists: async (style, page) => cached.has(`${style}-${page}`),
      stylePreviewPublicUrl: (style, page) => `https://cdn.example.test/${style}-${page}.png`,
      uploadStylePreview: async () => { counters.uploads++ },
    },
  })
}

function threadInterviewRoute(state) {
  const project = state.project
  const lease = load('src/lib/interview/thumbnail-lease.ts', { 'node:crypto': { randomUUID: () => 'r' }, '@/lib/prisma': { prisma: {
    systemSetting: { createMany: async ({ data }) => { const fresh = data.filter(row => !state.settings.has(row.key)); fresh.forEach(row => state.settings.set(row.key, row.value)); return { count: fresh.length } } },
  } } })
  return load('src/app/api/interview/projects/[id]/thumbnail/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {
      interviewProject: { findUnique: async () => project },
      interviewDraft: { findFirst: async () => null },
      interviewTranscription: { findMany: async () => [] },
      $transaction: async fn => fn({ $executeRaw: async () => {}, interviewProject: {
        findUnique: async () => project,
        update: async ({ data }) => { project.thumbnailUrl = data.thumbnailUrl; return { updatedAt: new Date(2000) } },
      } }),
    } },
    '@/lib/interview/access': {
      getInterviewUser: async () => ({ userId: state.userId, plan: state.userId ? 'FREE' : 'GUEST' }),
      getGuestIdFromRequest: () => state.userId ? null : 'guest-1',
      checkOwnership: (resource, userId, guestId) => (userId ? resource.userId === userId : resource.guestId === guestId) ? null : Response.json({ error: 'not found' }, { status: 404 }),
      requireDatabase: () => null,
    },
    '@/lib/resolve-image-model': { callGeminiImageAPI: async () => {
      state.providerCalls++
      if (state.providerFails) throw new Error('provider failed')
      return { response: { json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }] } }] }) }, model: 'test' }
    } },
    '@/lib/interview/thumbnail-storage': {
      THUMBNAIL_STORAGE_MARKER: 'marker', thumbnailOwner: () => 'owner',
      thumbnailUrlForClient: (_id, stored) => stored === 'marker' ? '/thumb' : stored,
      uploadInterviewThumbnail: async () => {}, signedInterviewThumbnailUrl: async () => 'https://private.example/t',
    },
    '@/lib/interview/thumbnail-lease': {
      ThumbnailGenerationInProgressError: lease.ThumbnailGenerationInProgressError,
      claimThumbnailLease: async () => { state.leases++; return 'token' },
      releaseThumbnailLease: async () => {},
    },
    '@/lib/interview/aux-budget': {
      claimAuxBudget: async () => { state.budgetClaims++; return state.budgetLeft > 0 ? (state.budgetLeft--, { state: 'allowed', claim: { key: 'k', day: 'd' } }) : { state: 'limit', limit: 5 } },
      refundAuxBudget: async () => { state.budgetLeft++; state.refunds++ },
      auxAdmissionError: admission => Response.json({ success: false, code: 'INTERVIEW_AUX_LIMIT_REACHED', limit: admission.limit }, { status: 429 }),
    },
  }, { process: { env: { GOOGLE_GENAI_API_KEY: 'test-key' } } })
}

const newState = (over = {}) => ({ userId: 'u1', project: { id: 'p1', userId: 'u1', guestId: null, thumbnailUrl: null, updatedAt: new Date(1000), title: 'T', genre: 'OTHER' }, settings: new Map(), providerCalls: 0, providerFails: false, leases: 0, budgetClaims: 0, budgetLeft: 5, refunds: 0, ...over })
const ctx = { params: Promise.resolve({ id: 'p1' }) }
const post = (api, body) => api.POST({ json: async () => body, cookies: {} }, ctx)

;(async () => {
  await check('slide wizard: opening the new-deck screen never calls the paid image API and shows static style samples', async () => {
    const counters = { providers: 0, uploads: 0 }
    const cached = new Set(['minimal-0', 'minimal-1', 'minimal-2'])
    const route = styleRoute(counters, cached)
    let reads = 0
    const reader = { readStylePreview: async (style) => {
      reads++
      const res = await route.GET(new Request(`https://example.test/api/doyaslide/style-preview?style=${encodeURIComponent(style)}`))
      const body = await res.json()
      return { urls: body.urls, pending: body.pending, capped: false }
    } }
    const hook = load('src/lib/doyaslide/use-style-previews.ts', { react: React, './style-preview-client': reader, './style-placeholder': placeholder }, { AbortController, setTimeout, clearTimeout })
    const styles = constants.STYLE_PRESETS.filter(p => !p.sampleImages?.length).map(p => p.value)
    let latest
    function Probe() { latest = hook.useStylePreviews('alpha', styles); return null }
    const c = document.createElement('div'); document.body.append(c)
    const root = createRoot(c)
    const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 40; i++) await new Promise(r => setImmediate(r)) })
    await act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(Probe))))
    assert.ok(reads >= styles.length, 'every style is looked up (read-only)')
    assert.equal(counters.providers, 0, 'no paid image generation on mount')
    assert.equal(counters.uploads, 0)
    assert.equal(latest.entries.minimal.status, 'ready')
    assert.deepEqual(latest.entries.minimal.urls, ['https://cdn.example.test/minimal-0.png', 'https://cdn.example.test/minimal-1.png', 'https://cdn.example.test/minimal-2.png'])
    const corporate = latest.entries.corporate
    assert.equal(corporate.status, 'empty')
    assert.equal(corporate.urls.length, 3)
    assert.ok(corporate.urls.every(url => url.startsWith('data:image/svg+xml;charset=utf-8,')))
    assert.match(decodeURIComponent(corporate.urls[0]), /<svg[\s\S]*コーポレート/)
    // 「見本を再確認」を押しても生成は走らない
    await act(() => latest.retry('corporate'))
    assert.equal(counters.providers, 0)
    assert.equal(latest.entries.corporate.status, 'empty')
    await act(() => root.unmount())
  })

  await check('style placeholders are self-contained SVG with escaped text for every style', async () => {
    for (const preset of constants.STYLE_PRESETS) {
      const pages = placeholder.buildStylePlaceholderPages(preset.value)
      assert.equal(pages.length, 3)
      for (const page of pages) {
        const svg = decodeURIComponent(page.slice('data:image/svg+xml;charset=utf-8,'.length))
        assert.match(svg, /^<svg [^>]*viewBox="0 0 1600 900"/)
        assert.doesNotMatch(svg, /<script|href=|<image/i)
      }
    }
  })

  await check('interview: opening the editor cannot request thumbnail generation', async () => {
    const ts = require('typescript'), fs = require('node:fs')
    const file = 'src/app/(shell)/interview/projects/[id]/edit/page.tsx'
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let clicks = 0
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'generateBanner') {
        let parent = node.parent
        while (parent && !ts.isJsxAttribute(parent)) parent = parent.parent
        assert(parent && parent.name.getText(source) === 'onClick', 'generation must originate from a click handler')
        clicks++
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    assert.equal(clicks, 2, 'initial creation and regeneration remain available')
  })

  for (const options of [{}, { budgetLeft: 0 }, { project: { id: 'p1', userId: 'u1', thumbnailUrl: 'marker', updatedAt: new Date(1000) } }]) {
    await check('interview: automatic requests never call a provider, reserve quota or write an attempt', async () => {
      const state = newState(options), api = threadInterviewRoute(state)
      for (const body of [{ auto: true }, { auto: true, force: true }, { auto: true }]) {
        const response = await post(api, body)
        assert.equal(response.status, 200)
        assert.equal((await response.json()).code, 'THUMBNAIL_AUTO_SKIPPED')
      }
      assert.equal(state.providerCalls, 0)
      assert.equal(state.leases, 0)
      assert.equal(state.budgetClaims, 0)
      assert.equal(state.settings.size, 0)
    })
  }

  await check('interview: legacy automatic requests without the auto flag never generate or spend quota', async () => {
    const state = newState(), api = threadInterviewRoute(state)
    for (const body of [{ force: false }, {}]) {
      const response = await post(api, body)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).code, 'THUMBNAIL_AUTO_SKIPPED')
    }
    assert.equal(state.providerCalls, 0)
    assert.equal(state.leases, 0)
    assert.equal(state.budgetClaims, 0)
  })

  await check('interview: guest automatic requests are skipped before quota and provider', async () => {
    const state = newState({ userId: null, project: { id: 'p1', userId: null, guestId: 'guest-1', thumbnailUrl: null, updatedAt: new Date(1000), title: 'T', genre: 'OTHER' } })
    const response = await post(threadInterviewRoute(state), { auto: true })
    assert.equal((await response.json()).code, 'THUMBNAIL_AUTO_SKIPPED')
    assert.equal(state.providerCalls, 0)
    assert.equal(state.budgetClaims, 0)
  })

  await check('interview: explicit first creation is included even when additional edit quota is zero', async () => {
    const state = newState({ budgetLeft: 0 }), api = threadInterviewRoute(state)
    const response = await post(api, { force: false, manual: true })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).thumbnailUrl, '/thumb')
    assert.equal(state.providerCalls, 1)
    assert.equal(state.budgetClaims, 0)
    assert.equal(state.budgetLeft, 0)
    assert.equal((await post(api, {})).status, 200)
    assert.equal(state.providerCalls, 1, 'reuse never creates a second image')
  })

  await check('interview: first-create click reuses an image completed in another tab without spending a credit', async () => {
    const state = newState({ budgetLeft: 0, project: { id: 'p1', userId: 'u1', thumbnailUrl: 'marker', updatedAt: new Date(1000) } })
    const response = await post(threadInterviewRoute(state), { force: false, manual: true })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).thumbnailUrl, '/thumb')
    assert.equal(state.providerCalls, 0)
    assert.equal(state.budgetClaims, 0)
    assert.equal(state.leases, 0)
  })

  await check('interview: explicit regeneration spends exactly one additional edit credit', async () => {
    const state = newState({ budgetLeft: 1, project: { id: 'p1', userId: 'u1', thumbnailUrl: 'marker', updatedAt: new Date(1000) } }), api = threadInterviewRoute(state)
    assert.equal((await post(api, { force: true })).status, 200)
    assert.equal(state.providerCalls, 1)
    assert.equal(state.budgetLeft, 0)
    assert.equal(state.budgetClaims, 1)
    assert.equal((await post(api, { force: true })).status, 429)
    assert.equal(state.providerCalls, 1)
  })

  await check('interview: failed explicit regeneration returns the additional edit credit', async () => {
    const state = newState({ providerFails: true, project: { id: 'p1', userId: 'u1', thumbnailUrl: 'marker', updatedAt: new Date(1000) } })
    assert.equal((await post(threadInterviewRoute(state), { force: true })).status, 500)
    assert.equal(state.refunds, 1)
    assert.equal(state.budgetLeft, 5)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
