const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture(initialUsed = 4, ownerPlan = 'FREE', researchResult = require('./shodan-research-fixture.cjs')(), role = 'owner') {
  const rows = Array.from({ length: initialUsed }, (_, i) => ({ id: `old-${i}`, status: 'researched' }))
  let chain = Promise.resolve()
  let locks = 0
  let researchCalls = 0
  const tx = {
    $queryRaw: async (_strings, organizationId) => {
      assert.equal(organizationId, 'org-1')
      locks++
      return [{ id: organizationId }]
    },
    shodanPreparation: {
      count: async () => rows.filter((row) => row.status !== 'failed').length,
      create: async ({ data }) => {
        assert(locks > 0)
        const row = { id: `new-${rows.length}`, ...data }
        rows.push(row)
        return row
      },
    },
    shodanMember: { findMany: async () => [{ userId: 'owner-1' }] },
    user: { findUnique: async ({ where }) => ({ plan: where.id === 'owner-1' ? ownerPlan : 'PRO' }) },
  }
  const prisma = {
    $transaction: (fn) => {
      const result = chain.then(() => fn(tx))
      chain = result.catch(() => {})
      return result
    },
    shodanPreparation: { update: async ({ where, data }) => {
      const row = rows.find((item) => item.id === where.id)
      Object.assign(row, data)
      return row
    } },
  }
  const billing = load('src/lib/shodan/billing.ts')
  const route = load('src/app/api/shodan/preparations/route.ts', {
    'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200 }) } },
    '@/lib/prisma': { prisma },
    '@/lib/shodan/access': { getShodanContext: async () => ({ userId: role === 'owner' ? 'owner-1' : 'member-1', organizationId: 'org-1', organizationSlug: 'org', role, memberId: 'member-1' }), orgSlugFrom: () => 'org' },
    '@/lib/shodan/billing': billing,
    '@/lib/unified-plan': { isPaidPlan: (plan) => plan !== 'FREE' && plan !== 'GUEST' },
    '@/lib/shodan/research-response': load('src/lib/shodan/research-response.ts'),
    '@/lib/shodan/research': { researchCompany: async () => { researchCalls++; return researchResult } },
    '@/lib/shodan/types': { effectivePrepStatus: (status) => status, PREP_STALE_MS: 360000, SHODAN_MONTHLY_LIMIT: { FREE: 5, PRO: 50, ENTERPRISE: 300 } },
    '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date('2026-08-31T15:00:00Z') },
  })
  const post = (body = { url: 'https://example.com' }) => route.POST({ json: async () => body })
  return { post, rows, get researchCalls() { return researchCalls } }
}

(async () => {
  await check('malformed URL input is rejected before quota or provider calls', async () => {
    const f = fixture()
    for (const body of [null, {}, { url: 3 }, { url: [] }, { url: {} }, { url: '' }, { url: 'ftp://example.com' }, { url: 'https://name:pass@example.com' }, { url: 'https://example.com/' + 'a'.repeat(8192) }]) {
      assert.equal((await f.post(body)).status, 400)
    }
    assert.equal(f.rows.length, 4)
    assert.equal(f.researchCalls, 0)
  })
  await check('concurrent requests reserve only the one remaining slot', async () => {
    const f = fixture()
    const responses = await Promise.all([f.post(), f.post()])
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 402])
    assert.equal(responses.find((r) => r.status === 402).body.code, 'LIMIT')
    assert.equal(responses.find((r) => r.status === 402).body.upgradeUrl, '/shodan/pricing?org=org')
    assert.equal(f.researchCalls, 1)
    assert.equal(f.rows.length, 5)
  })
  await check('paid cap does not invite an existing subscriber to subscribe again', async () => {
    const f = fixture(50, 'PRO')
    const response = await f.post()
    assert.equal(response.status, 402)
    assert.match(response.body.error, /お問い合わせ/)
    assert.doesNotMatch(response.body.error, /プロプランにご登録/)
    assert.equal(response.body.upgradeUrl, undefined)
    assert.equal(response.body.contactUrl, 'https://doyamarke.surisuta.jp/contact')
    assert.equal(f.researchCalls, 0)
  })
  await check('member plan cannot change the shared organization cap or purchase action', async () => {
    const freeOwner = fixture(5, 'FREE', { companyName: 'Example' }, 'member')
    const blocked = await freeOwner.post()
    assert.equal(blocked.status, 402)
    assert.equal(blocked.body.upgradeUrl, undefined)
    assert.equal(blocked.body.contactUrl, undefined)
    assert.match(blocked.body.error, /組織オーナー/)
    assert.equal(freeOwner.researchCalls, 0)
    const paidOwner = fixture(5, 'PRO', require('./shodan-research-fixture.cjs')(), 'member')
    assert.equal((await paidOwner.post()).status, 200)
    assert.equal(paidOwner.researchCalls, 1)
  })
  await check('unusable Shodan research fails and releases the reserved monthly slot', async () => {
    const f = fixture(4, 'FREE', { sourceStatus: { homepage: 'failed', gbizinfo: 'skipped', prtimes: 'skipped' } })
    const response = await f.post()
    assert.equal(response.status, 500)
    assert.equal(f.rows.at(-1).status, 'failed')
    assert.equal(f.rows.filter((row) => row.status !== 'failed').length, 4)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
