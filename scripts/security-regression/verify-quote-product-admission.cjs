const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture({ plan = 'FREE', actor = 'owner', lifetime = 0, monthly = 0, serializeOnce = false } = {}) {
  const state = { rows: [], lifetime, monthly, transactions: 0, creates: 0, writes: 0, active: true }
  const tx = {
    quoteMember: { findFirst: async ({ where }) => {
      assert.equal(where.organizationId, 'org')
      return typeof where.userId === 'string' ? (state.active ? { id: 'member', role: actor } : null) : { userId: 'owner-user' }
    } },
    user: { findUnique: async () => ({ plan }) },
    quoteProduct: {
      count: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        if (where.createdAt) assert.equal(where.createdAt.gte.getUTCHours(), 15, 'JST month start')
        return state.rows.length
      },
      create: async ({ data }) => {
        state.creates++
        const product = { id: `product-${state.creates}`, ...data }
        state.rows.push(product)
        return product
      },
    },
  }
  const prisma = { $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    state.transactions++
    if (serializeOnce && state.transactions === 1) {
      state.lifetime = 1
      throw Object.assign(new Error('conflict'), { code: 'P2034' })
    }
    return work(tx)
  } }
  const ledger = {
    getOrganizationQuotaUsage: async (_tx, key, org, period, count) => {
      assert.equal(key, 'quoteProducts')
      assert.equal(org, 'org')
      return Math.max(await count(), state[period])
    },
    recordOrganizationQuotaUsage: async (_tx, key, org, usedLifetime, usedMonthly) => {
      assert.equal(key, 'quoteProducts')
      assert.equal(org, 'org')
      state.lifetime = usedLifetime + 1
      state.monthly = usedMonthly + 1
      state.writes++
    },
  }
  const route = load('src/app/api/quote/products/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/quote/access': { getQuoteContext: async () => ({ organizationId: 'org', userId: actor === 'owner' ? 'owner-user' : 'staff-user' }), orgSlugFrom: () => 'org' },
    '@/lib/plan-limit': { FREE_LIMITS: { quoteProducts: 1 }, jstStartOfMonthUtc: () => new Date('2026-09-30T15:00:00Z') },
    '@/lib/organization-quota-ledger': ledger,
    '@/lib/unified-plan': { isPaidPlan: value => value === 'PRO' },
  })
  return { state, post: body => route.POST({ json: async () => body }) }
}

;(async () => {
  await check('quote free product admission is lifetime and deletion resistant', async () => {
    const f = fixture()
    assert.equal((await f.post({ name: '  商材  ', sourceUrl: '  https://example.com  ', profile: { description: '説明' } })).status, 200)
    assert.equal(f.state.rows[0].name, '商材')
    assert.equal(f.state.rows[0].sourceUrl, 'https://example.com')
    f.state.rows = []
    const blocked = await f.post({ name: '追加商材' })
    assert.equal(blocked.status, 402)
    assert.equal((await blocked.json()).upgradeUrl, '/quote/pricing')
    assert.equal(f.state.creates, 1)
    assert.equal(f.state.writes, 1)
  })
  await check('quote nonowner receives owner guidance without upgrade link', async () => {
    const f = fixture({ actor: 'admin', lifetime: 1 })
    const response = await f.post({ name: '追加商材' })
    const body = await response.json()
    assert.equal(response.status, 402)
    assert.equal(body.code, 'LIMIT_REACHED')
    assert.equal(body.upgradeUrl, undefined)
    assert.match(body.error, /契約者/)
    assert.equal(f.state.creates, 0)
  })
  await check('quote paid products remain unlimited and recorded', async () => {
    const f = fixture({ plan: 'PRO', lifetime: 20, monthly: 10 })
    assert.equal((await f.post({ name: '有料の追加商材' })).status, 200)
    assert.equal(f.state.lifetime, 21)
    assert.equal(f.state.monthly, 11)
  })
  await check('quote product admission validates input and current membership', async () => {
    const f = fixture()
    for (const body of [{ name: {} }, { name: 'ok', sourceUrl: {} }, { name: 'ok', profile: [] }]) {
      assert.equal((await f.post(body)).status, 400)
    }
    assert.equal(f.state.transactions, 0)
    f.state.active = false
    assert.equal((await f.post({ name: 'ok' })).status, 403)
    assert.equal(f.state.creates, 0)
  })
  await check('quote serialization retry rereads exhausted quota', async () => {
    const f = fixture({ serializeOnce: true })
    assert.equal((await f.post({ name: '競合商材' })).status, 402)
    assert.equal(f.state.transactions, 2)
    assert.equal(f.state.creates, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
