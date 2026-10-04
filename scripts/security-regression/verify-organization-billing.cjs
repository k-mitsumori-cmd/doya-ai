const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

async function main() {
  const ownerLookups = []
  const member = {
    findFirst: async ({ where, orderBy }) => {
      ownerLookups.push({ where, orderBy })
      return where.organizationId === 'missing' ? null : { userId: 'owner' }
    },
  }
  const prisma = {
    quoteMember: member, mensetsuMember: member, aishodanMember: member,
    user: { findUnique: async ({ where }) => ({ plan: where.id === 'owner' ? 'PRO' : 'FREE' }) },
  }
  const billing = load('src/lib/organization-billing.ts', { '@/lib/prisma': { prisma } })
  for (const service of ['quote', 'mensetsu', 'aishodan']) {
    const result = await billing.getOrganizationBilling(service, 'org')
    assert.equal(result.ownerUserId, 'owner')
    assert.equal(result.plan, 'PRO')
  }
  assert.equal(await billing.getOrganizationOwnerUserId('quote', 'missing'), null)
  assert.ok(ownerLookups.every(({ where, orderBy }) => where.role === 'owner' && where.status === 'ACTIVE' && where.userId.not === null && orderBy.createdAt === 'asc'))

  let role = 'member'
  let selectedSlug
  const api = load('src/app/api/organization-billing/[service]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/quote/access': { getQuoteContext: async slug => { selectedSlug = slug; return slug === 'foreign' ? null : { organizationId: 'org', userId: role === 'owner' ? 'owner' : 'member', role } } },
    '@/lib/mensetsu/access': { getMensetsuContext: async slug => { selectedSlug = slug; return slug === 'foreign' ? null : { organizationId: 'org', userId: role === 'owner' ? 'owner' : 'member', role } } },
    '@/lib/aishodan/access': { getAishodanContext: async slug => { selectedSlug = slug; return slug === 'foreign' ? null : { organizationId: 'org', userId: role === 'owner' ? 'owner' : 'member', role } } },
    '@/lib/organization-billing': { getOrganizationBilling: async () => ({ ownerUserId: 'owner', plan: 'PRO' }) },
  })
  for (const service of ['quote', 'mensetsu', 'aishodan']) {
    const params = { params: Promise.resolve({ service }) }
    const result = await api.GET(new Request(`https://example.invalid/api/organization-billing/${service}?org=team`), params)
    assert.equal(result.status, 200)
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
    assert.equal(result.headers.get('vary'), 'Cookie')
    assert.equal(selectedSlug, 'team')
    assert.deepEqual(await result.json(), { organizationId: 'org', plan: 'PRO', canManageBilling: false })
    role = 'owner'
    const ownerResult = await api.GET(new Request(`https://example.invalid/api/organization-billing/${service}?org=team`), params)
    assert.equal((await ownerResult.json()).canManageBilling, true)
    role = 'member'
    const foreign = await api.GET(new Request(`https://example.invalid/api/organization-billing/${service}?org=foreign`), params)
    assert.equal(foreign.status, 403)
  }

  const limit = load('src/lib/plan-limit.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'member', plan: 'PRO' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async ({ where }) => ({ plan: where.id === 'owner' ? 'PRO' : 'FREE' }) } } },
    '@/lib/unified-plan': { isPaidPlan: plan => plan === 'PRO' },
  })
  const freeOwner = await limit.assertFreeLimit('quoteDocuments', async () => 3, 'member')
  assert.equal(freeOwner.ok, false, 'the supplied owner id, not the signed-in session, decides the organization limit')
  const paidOwner = await limit.assertFreeLimit('quoteDocuments', async () => 3, 'owner', async () => 5)
  assert.equal(paidOwner.ok, true)
  assert.equal(paidOwner.limit, 100)

  for (const [file, service, key] of [
    ['src/app/api/quote/documents/route.ts', 'quote', 'quoteDocuments'],
    ['src/app/api/mensetsu/sessions/route.ts', 'mensetsu', 'mensetsuSessions'],
    ['src/app/api/mensetsu/templates/route.ts', 'mensetsu', 'mensetsuTemplates'],
    ['src/app/api/aishodan/products/route.ts', 'aishodan', 'aishodanProducts'],
  ]) {
    let actorRole = 'member'
    let quotaOwner
    let ownerLookupFails = false
    let quotaChecks = 0
    const access = { getQuoteContext: async () => ({ organizationId: 'org', userId: actorRole === 'owner' ? 'owner' : 'member', role: actorRole }),
      getMensetsuContext: async () => ({ organizationId: 'org', userId: actorRole === 'owner' ? 'owner' : 'member', role: actorRole }),
      getAishodanContext: async () => ({ organizationId: 'org', userId: actorRole === 'owner' ? 'owner' : 'member', role: actorRole }), orgSlugFrom: () => undefined }
    const quota = { quoteDocuments: 3, mensetsuSessions: 3, mensetsuTemplates: 1, aishodanProducts: 1 }
    const route = load(file, {
      crypto: { randomBytes: () => Buffer.alloc(24) },
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {
        mensetsuTemplate: { deleteMany: async () => {}, findFirst: async () => null },
        aishodanProduct: { deleteMany: async () => {}, findFirst: async () => null },
      } },
      '@/lib/organization-billing': { getOrganizationOwnerUserId: async () => {
        if (ownerLookupFails) throw new Error('database unavailable')
        return 'owner'
      } },
      '@/lib/quote/access': access, '@/lib/mensetsu/access': access, '@/lib/aishodan/access': access,
      '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
      '@/lib/quote/document': {}, '@/lib/mensetsu/interview-url': {}, '@/lib/mensetsu/template': {},
      '@/lib/aishodan/knowledge': {}, '@/lib/aishodan/defaults': {}, '@/lib/service-usage': {},
      '@/lib/plan-limit': { FREE_LIMITS: quota, assertFreeLimit: async (receivedKey, _count, ownerId) => {
        quotaChecks++
        assert.equal(receivedKey, key)
        quotaOwner = ownerId
        return { ok: false, used: quota[key], limit: quota[key], reason: '上限に達しました' }
      } },
    })
    const req = () => new Request('https://example.invalid/api/test', { method: 'POST', body: '{}' })
    const memberResponse = await route.POST(req())
    assert.equal(memberResponse.status, 402)
    assert.equal(quotaOwner, 'owner')
    const memberBody = await memberResponse.json()
    assert.equal(memberBody.upgradeUrl, undefined)
    assert.equal(memberBody.canManageBilling, false)
    assert.match(memberBody.error, /組織の契約者/)
    actorRole = 'owner'
    const ownerResponse = await route.POST(req())
    assert.equal(ownerResponse.status, 402)
    const ownerBody = await ownerResponse.json()
    assert.equal(ownerBody.upgradeUrl, `/${service}/pricing`)
    assert.equal(ownerBody.canManageBilling, true)
    ownerLookupFails = true
    const failed = await route.POST(req())
    assert.equal(failed.status, 503)
    assert.equal(quotaChecks, 2, 'contract lookup failure must stop before quota or paid work')
  }
  console.log('PASS organization billing: owner plan, scoped pricing, member quota guidance, and owner-only upgrade links')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
