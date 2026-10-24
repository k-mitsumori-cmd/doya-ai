// Shodan の AI 回数: 予約 → AI 呼び出し前の失敗だけ戻す。時間切れ・呼び出し後の失敗・月またぎは戻さない/別月を減らさない。
// 実際の route と ai-quota を読み込む。DB は同期のメモリ差し替え。実 AI・実 DB は使わない。
const assert = require('node:assert/strict'), { load, check, results, DEFAULT_MOCKS } = require('./load-typescript.cjs')
const helpers = require('./shodan-editor-test-helpers.cjs')

function memoryDb() {
  const store = new Map()
  const tx = {
    $executeRaw: async () => 1,
    systemSetting: {
      findUnique: async ({ where }) => store.has(where.key) ? { value: store.get(where.key) } : null,
      upsert: async ({ where, create, update }) => { store.set(where.key, store.has(where.key) ? update.value : create.value) },
      update: async ({ where, data }) => { store.set(where.key, data.value) },
    },
  }
  return { store, db: { $transaction: async (fn) => fn(tx) } }
}
const quotaMod = (m) => load('src/lib/shodan/ai-quota.ts', { '@/lib/prisma': { prisma: m.db }, './types': { SHODAN_AI_MONTHLY_LIMIT: { PRO: 600, ENTERPRISE: 3000 } } })

// 実 ai-quota を route に差し込む（DB はメモリ）
function realQuota(m) {
  const q = quotaMod(m)
  return { '@/lib/shodan/ai-quota': { ...q, reserveShodanAi: (o, n, l) => q.reserveShodanAi(o, n, l, m.db), refundShodanAi: (k, n) => q.refundShodanAi(k, n, m.db) } }
}
const ctxOf = () => ({ organizationId: 'org', organizationSlug: 'o', userId: 'owner', role: 'owner' })
const used = (m) => Number([...m.store.values()][0] ?? 0)

function generateFixture(mode) {
  const m = memoryDb()
  const row = { id: 'p', organizationId: 'org', updatedAt: new Date(0), research: { companyName: 'X' }, status: 'done', errorMessage: null }
  const route = load('src/app/api/shodan/preparations/[id]/generate/route.ts', {
    'next/server': { NextResponse: Response }, ...realQuota(m),
    '@/lib/prisma': { prisma: { shodanCompanyProfile: { findUnique: async () => { if (mode === 'before-ai') throw Error('db'); return null } },
      shodanPreparation: { findFirst: async () => ({ ...row }), updateMany: async ({ data }) => { Object.assign(row, data); return { count: 1 } } } } },
    '@/lib/shodan/access': { getShodanContext: async () => ctxOf(), orgSlugFrom: () => 'o' },
    '@/lib/shodan/billing': { getShodanBilling: async () => ({ ownerUserId: 'owner', plan: 'PRO' }) }, '@/lib/unified-plan': { isPaidPlan: () => true },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    '@/lib/shodan/slide-generation-lease': { ShodanSlideGenerationInProgressError: class extends Error {}, claimShodanSlideLease: async () => 'l', releaseShodanSlideLease: async () => {} },
    '@/lib/shodan/ai': { analyzeCompany: async () => { if (mode === 'ai-fail') throw Error('upstream'); return {} }, generateProposal: async () => 'md', generateSlides: async () => [{ title: 't' }] },
  })
  return { m, run: () => route.POST({}, { params: Promise.resolve({ id: 'p' }) }) }
}

function slideFixture(file, mode, body) {
  const m = memoryDb()
  class NotStarted extends Error { constructor() { super('x'); this.aiNotInvoked = true } }
  const err = () => mode === 'not-started' ? new NotStarted() : mode === 'timeout' ? Error('slideGen timeout (220000ms)') : Error('after provider')
  const prep = { id: 'p', organizationId: 'org', updatedAt: new Date(0), slidesJson: [{ title: 'a', type: 'cover' }, { title: 'b', type: 'content' }], slideImages: [] }
  const route = load(file, {
    'next/server': { NextResponse: Response }, ...helpers, ...realQuota(m),
    '@/lib/prisma': { prisma: { shodanPreparation: { findFirst: async () => ({ ...prep }) }, shodanCompanyProfile: { findUnique: async () => null } } },
    '@/lib/shodan/access': { getShodanContext: async () => ctxOf(), orgSlugFrom: () => 'o' },
    '@/lib/shodan/billing': { getShodanBilling: async () => ({ ownerUserId: 'owner', plan: 'PRO' }) }, '@/lib/unified-plan': { isPaidPlan: () => true },
    '@/lib/shodan/slide-generation-lease': { ShodanSlideGenerationInProgressError: class extends Error {}, claimShodanSlideLease: async () => 'l', releaseShodanSlideLease: async () => {} },
    '@/lib/shodan/save-slide-images': { saveSlideImages: async () => [], SlideImageConflict: class extends Error {} },
    '@/lib/shodan/slide-image': { generateSlideImage: async () => { if (mode === 'ok') return { title: 'a', imagePath: 'p.png' }; throw err() } },
    '@/lib/shodan/storage': { signedUrl: async () => 'https://x.invalid/a.png' },
    '@/lib/fetch-timeout': { raceTimeout: async (_, __, p) => p },
  })
  return { m, run: () => route.POST(new Request('https://offline.invalid/api', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'p' }) }) }
}

;(async () => {
  await check('AI 呼び出し後の失敗では提案資料の回数を戻さない', async () => {
    const f = generateFixture('ai-fail'); assert.equal((await f.run()).status, 500); assert.equal(used(f.m), 1)
  })
  await check('AI 呼び出し前の失敗は回数を戻す', async () => {
    const f = generateFixture('before-ai'); assert.equal((await f.run()).status, 500); assert.equal(used(f.m), 0)
  })
  await check('成功では 1 回数える', async () => {
    const f = generateFixture('ok'); assert.equal((await f.run()).status, 200); assert.equal(used(f.m), 1)
  })
  const regen = 'src/app/api/shodan/preparations/[id]/slides/regenerate/route.ts', gen = 'src/app/api/shodan/preparations/[id]/slides/generate/route.ts'
  const rb = { index: 0, expectedUpdatedAt: '1970-01-01T00:00:00.000Z' }
  for (const [file, body] of [[regen, rb], [gen, {}]]) {
    const n = file === gen ? 2 : 1
    await check(`${file.split('/').slice(-2).join('/')}: 時間切れ・呼び出し後の失敗は戻さない`, async () => {
      for (const mode of ['timeout', 'after-provider']) { const f = slideFixture(file, mode, body); await f.run(); assert.equal(used(f.m), n, mode) }
    })
    await check(`${file.split('/').slice(-2).join('/')}: 呼ぶ前と分かる失敗だけ戻す`, async () => {
      const f = slideFixture(file, 'not-started', body); await f.run(); assert.equal(used(f.m), 0)
    })
  }
  await check('月をまたいでも、予約した月のキーだけを戻す', async () => {
    const m = memoryDb(), q = quotaMod(m)
    const oct = Date.parse('2026-10-31T14:59:00Z'), nov = Date.parse('2026-10-31T15:01:00Z') // JST で 10/31 23:59 と 11/1 0:01
    const a = await q.reserveShodanAi('org', 3, 600, m.db, oct); assert.ok(a.ok)
    const b = await q.reserveShodanAi('org', 5, 600, m.db, nov); assert.ok(b.ok); assert.notEqual(a.key, b.key)
    await q.refundShodanAi(a.key, 3, m.db) // 戻す時刻が 11 月でも 10 月のキーを使う
    assert.equal(m.store.get(a.key), '0'); assert.equal(m.store.get(b.key), '5')
    await q.refundShodanAi(a.key, 9, m.db); assert.equal(m.store.get(a.key), '0') // 0 を下回らない
    await q.refundShodanAi('bad-key', 1, m.db); assert.equal(m.store.get(b.key), '5')
  })
  await check('上限を超える予約は断る', async () => {
    const m = memoryDb(), q = quotaMod(m)
    assert.ok((await q.reserveShodanAi('org', 600, 600, m.db)).ok); assert.equal((await q.reserveShodanAi('org', 1, 600, m.db)).ok, false)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(e => { console.error(e); process.exitCode = 1 })
