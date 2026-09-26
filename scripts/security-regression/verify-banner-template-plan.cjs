const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(plan, customPrompt) {
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
    '@/lib/prisma': { prisma: { bannerTemplate: { findUnique: async () => ({ prompt: '保存済みテンプレート', isActive: true }) } } },
    '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [{ id: 't1', fullPrompt: '公式テンプレートの見た目、余白、配色、文字組み、写真の配置を維持して制作する。十分な長さを持つデザイン指示です。' }] },
    '@/lib/banner/monthly-quota': {
      reserveBannerMonthlyImages: async () => ({ state: 'reserved', reservation }),
      releaseBannerMonthlyImages: async (_, count) => { releases.push(count) },
    },
    '@/lib/nanobanner': { generateBanners: async (_, __, ___, options) => { modelCalls++; modelPrompts.push(options.customImagePrompt); return { banners: ['data:image/png;base64,AAAA'] } } },
  }, { console: { log() {}, error() {} } })
  const request = new Request('https://local.test/api/banner/test/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 't1', mainTitle: 'テスト', size: '1080x1080', count: 1, basePrompt: 'EVIL OVERRIDE THAT SHOULD NEVER BE USED FOR FREE USERS', customPrompt }),
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

  run = fixture('ENTERPRISE', '有料の詳細指示')
  assert.equal((await run.api.POST(run.request)).status, 200)
  assert.equal(run.modelCalls, 1)
  console.log('PASS template generation enforces Enterprise detailed instructions before paid image calls and refunds rejected reservations')
})().catch(error => { console.error(error); process.exitCode = 1 })
