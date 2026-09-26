const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const templateAccess = load('src/lib/banner/template-access.ts')

function fixture(plan, customPrompt, templateId = 't1', dbError = false, atLimit = false) {
  let modelCalls = 0
  const modelPrompts = []
  const releases = []
  const reservation = {
    id: 'sub', lastUsageReset: new Date(), requested: 1, count: 1, plan,
    usage: { monthlyLimit: plan === 'ENTERPRISE' ? 1000 : 15, monthlyUsed: 1, monthlyRemaining: 14 },
  }
  const api = load('src/app/api/banner/test/generate/route.ts', {
    'next/server': { NextResponse: { json: (body, opts) => new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user', plan: 'ENTERPRISE' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { bannerTemplate: { findUnique: async () => {
      if (dbError) throw Error('SENSITIVE_DB_DETAIL')
      return { prompt: '保存済みテンプレート', isActive: true }
    } } } },
    '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [{ id: 't1', fullPrompt: '公式テンプレートの見た目、余白、配色、文字組み、写真の配置を維持して制作する。十分な長さを持つデザイン指示です。' }] },
    '@/lib/banner/template-access': templateAccess,
    '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: 'https://example.test/contact' },
    '@/lib/banner/monthly-quota': {
      reserveBannerMonthlyImages: async () => atLimit ? { state: 'limit', plan, usage: reservation.usage } : { state: 'reserved', reservation },
      releaseBannerMonthlyImages: async (_, count) => { releases.push(count) },
    },
    '@/lib/nanobanner': { generateBanners: async (_, __, ___, options) => { modelCalls++; modelPrompts.push(options.customImagePrompt); return { banners: ['data:image/png;base64,AAAA'] } } },
  }, { console: { log() {}, error() {} } })
  const request = new Request('https://local.test/api/banner/test/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId, mainTitle: 'テスト', size: '1080x1080', count: 1, basePrompt: 'EVIL OVERRIDE THAT SHOULD NEVER BE USED FOR FREE USERS', customPrompt }),
  })
  return { api, request, get modelCalls() { return modelCalls }, modelPrompts, releases }
}

;(async () => {
  let run = fixture('FREE', '有料の詳細指示')
  const denied = await run.api.POST(run.request)
  assert.equal(denied.status, 403)
  assert.equal((await denied.json()).code, 'PLAN_UPGRADE_REQUIRED')
  assert.equal(run.modelCalls, 0)
  assert.deepEqual(run.releases, [1])

  run = fixture('FREE', undefined)
  assert.equal((await run.api.POST(run.request)).status, 200)
  assert.equal(run.modelCalls, 1)
  assert(run.modelPrompts[0].includes('公式テンプレートの見た目'))
  assert(!run.modelPrompts[0].includes('EVIL OVERRIDE'))

  run = fixture('FREE', undefined, 'brand-001')
  assert.equal((await run.api.POST(run.request)).status, 403)
  assert.equal(run.modelCalls, 0)
  assert.deepEqual(run.releases, [1])

  run = fixture('LIGHT', undefined, 'brand-001')
  assert.equal((await run.api.POST(run.request)).status, 200)
  assert.equal(run.modelCalls, 1)

  run = fixture('LIGHT', undefined, 't21')
  assert.equal((await run.api.POST(run.request)).status, 403)
  assert.equal(run.modelCalls, 0)
  assert.deepEqual(run.releases, [1])

  run = fixture('PRO', undefined, 't21')
  assert.equal((await run.api.POST(run.request)).status, 200)
  assert.equal(run.modelCalls, 1)

  run = fixture('FREE', undefined, 't1', true)
  const failed = await run.api.POST(run.request)
  assert.equal(failed.status, 500)
  assert(!JSON.stringify(await failed.json()).includes('SENSITIVE_DB_DETAIL'))
  assert.equal(run.modelCalls, 0)
  assert.deepEqual(run.releases, [1])

  run = fixture('ENTERPRISE', '有料の詳細指示')
  assert.equal((await run.api.POST(run.request)).status, 200)
  assert.equal(run.modelCalls, 1)
  for (const plan of ['FREE', 'PRO']) {
    run = fixture(plan, undefined, 't1', false, true)
    const blocked = await run.api.POST(run.request)
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).upgradeUrl, plan === 'FREE' ? '/banner/pricing' : 'https://example.test/contact')
    assert.equal(run.modelCalls, 0)
  }
  console.log('PASS template generation enforces plan tiers, canonical prompts, quota guidance and Enterprise instructions before paid image calls')
})().catch(error => { console.error(error); process.exitCode = 1 })
