const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture(initialUsed = 4, plan = 'FREE') {
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
  }
  const prisma = {
    user: { findUnique: async () => ({ plan }) },
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
  const route = load('src/app/api/shodan/preparations/route.ts', {
    'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200 }) } },
    '@/lib/prisma': { prisma },
    '@/lib/shodan/access': { getShodanContext: async () => ({ userId: 'user-1', organizationId: 'org-1', memberId: 'member-1' }), orgSlugFrom: () => 'org' },
    '@/lib/shodan/research': { researchCompany: async () => { researchCalls++; return { companyName: 'Example' } } },
    '@/lib/shodan/types': { effectivePrepStatus: (status) => status, PREP_STALE_MS: 360000, SHODAN_MONTHLY_LIMIT: { FREE: 5, PRO: 50, ENTERPRISE: 300 } },
    '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date('2026-08-31T15:00:00Z') },
  })
  const post = () => route.POST({ json: async () => ({ url: 'https://example.com' }) })
  return { post, rows, get researchCalls() { return researchCalls } }
}

(async () => {
  await check('concurrent requests reserve only the one remaining slot', async () => {
    const f = fixture()
    const responses = await Promise.all([f.post(), f.post()])
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 402])
    assert.equal(responses.find((r) => r.status === 402).body.code, 'LIMIT')
    assert.equal(responses.find((r) => r.status === 402).body.upgradeUrl, '/shodan/pricing')
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
    assert.equal(f.researchCalls, 0)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
