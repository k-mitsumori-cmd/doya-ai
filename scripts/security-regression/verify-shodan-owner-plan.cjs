const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const getShodanBilling = load('src/lib/shodan/billing.ts').getShodanBilling
const routes = [
  'src/app/api/shodan/preparations/[id]/generate/route.ts',
  'src/app/api/shodan/preparations/[id]/slides/generate/route.ts',
  'src/app/api/shodan/preparations/[id]/slides/regenerate/route.ts',
]

function fixture(ownerPlan, actorPlan, role, owners = ['owner']) {
  let providerCalls = 0
  const member = { organizationId: 'org-id', organizationSlug: 'org-slug', userId: role === 'owner' ? 'owner' : 'member', role }
  const prisma = {
    shodanMember: { findMany: async () => owners.map((userId) => ({ userId })) },
    user: { findUnique: async ({ where }) => ({ plan: where.id === 'owner' ? ownerPlan : actorPlan }) },
    shodanPreparation: { findFirst: async () => ({ id: 'prep', updatedAt: new Date(), research: { companyName: 'Example' }, slidesJson: [{ title: 'Title' }], slideImages: [{ title: 'Title', imagePath: 'old' }] }) },
    shodanCompanyProfile: { findUnique: async () => null },
  }
  const mocks = {
    'next/server': { NextResponse: Response },
  ...require('./shodan-editor-test-helpers.cjs'),

    '@/lib/prisma': { prisma },
    '@/lib/shodan/access': { getShodanContext: async () => member, orgSlugFrom: () => 'org-slug' },
    '@/lib/shodan/billing': { getShodanBilling: (db, orgId) => getShodanBilling(db, orgId) },
    '@/lib/shodan/slide-generation-lease': { claimShodanSlideLease: async () => 'lease', releaseShodanSlideLease: async () => {}, ShodanSlideGenerationInProgressError: class extends Error {} },
    '@/lib/unified-plan': { isPaidPlan: (plan) => plan === 'PRO' || plan === 'ENTERPRISE' },
    '@/lib/shodan/ai': { analyzeCompany: async () => { providerCalls++; return {} }, generateProposal: async () => '', generateSlides: async () => [] },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    '@/lib/shodan/slide-image': { generateSlideImage: async () => { providerCalls++; return {} } },
    '@/lib/shodan/storage': { signedUrl: async () => '' },
    '@/lib/shodan/save-slide-images': { saveSlideImages: async () => {}, SlideImageConflict: class extends Error {} },
    '@/lib/fetch-timeout': { raceTimeout: async (_, __, promise) => promise },
  }
  return { mocks, get providerCalls() { return providerCalls } }
}

;(async () => {
  for (const file of routes) {
    await check(`${file}: PRO member cannot bypass FREE owner`, async () => {
      const f = fixture('FREE', 'PRO', 'member')
      const route = load(file, f.mocks)
      const res = await route.POST(new Request('http://offline.invalid/api?org=org-slug', { method: 'POST', body: JSON.stringify({ index: 0 }) }), { params: Promise.resolve({ id: 'prep' }) })
      const body = await res.json()
      assert.equal(res.status, 402)
      assert.equal(body.code, 'PLAN')
      assert.equal(body.canManageBilling, false)
      assert.equal(body.upgradeUrl, undefined)
      assert.match(body.error, /組織オーナー/)
      assert.equal(f.providerCalls, 0)
    })
    await check(`${file}: FREE owner sees organization pricing`, async () => {
      const f = fixture('FREE', 'FREE', 'owner')
      const route = load(file, f.mocks)
      const res = await route.POST(new Request('http://offline.invalid/api?org=org-slug', { method: 'POST', body: JSON.stringify({ index: 0 }) }), { params: Promise.resolve({ id: 'prep' }) })
      const body = await res.json()
      assert.equal(res.status, 402)
      assert.equal(body.canManageBilling, true)
      assert.equal(body.upgradeUrl, '/shodan/pricing?org=org-slug')
      assert.equal(f.providerCalls, 0)
    })
    await check(`${file}: ambiguous owners fail closed`, async () => {
      const f = fixture('PRO', 'PRO', 'member', ['owner', 'other'])
      const route = load(file, f.mocks)
      const res = await route.POST(new Request('http://offline.invalid/api?org=org-slug', { method: 'POST', body: JSON.stringify({ index: 0 }) }), { params: Promise.resolve({ id: 'prep' }) })
      assert.equal(res.status, 503)
      assert.equal(f.providerCalls, 0)
    })
  }
  await check('billing uses owner contract and accepts FREE member in PRO org', async () => {
    const f = fixture('PRO', 'FREE', 'member')
    const billing = await getShodanBilling(f.mocks['@/lib/prisma'].prisma, 'org-id')
    assert.equal(billing.ownerUserId, 'owner')
    assert.equal(billing.plan, 'PRO')
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
