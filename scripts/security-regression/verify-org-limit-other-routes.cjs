const assert = require('node:assert/strict')
const path = require('node:path')
const root = process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
process.env.DOYA_TEST_BASELINE ||= process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
const { load } = require(path.join(root, 'scripts/security-regression/load-typescript.cjs'))
const workspace = load('src/lib/organization-workspace-selection.ts')
const results = []
async function check(name, run) { await run(); results.push(name) }
const actualWorkspace = { '@/lib/organization-workspace-selection': workspace }
async function main() {
  for (const role of ['owner', 'member']) {
    let writes = 0
    const quote = load('src/app/api/quote/products/route.ts', {
      ...actualWorkspace,
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { $transaction: async callback => callback({
        quoteMember: { findFirst: async ({ where }) => where.role === 'owner' ? { userId: 'actor', role: 'owner' } : { id: 'member-1', role } },
        user: { findUnique: async () => ({ plan: 'FREE' }) },
        quoteProduct: { create: async () => { writes++; throw Error('quota rejection must not create') } },
      }) } },
      '@/lib/quote/access': { getQuoteContext: async slug => { assert.equal(slug, 'A'); return { organizationId: 'org-A', organizationSlug: 'A', userId: role === 'owner' ? 'actor' : 'member', role } }, orgSlugFrom: req => new URL(req.url).searchParams.get('org') || undefined },
      '@/lib/plan-limit': { FREE_LIMITS: { quoteProducts: 1 }, jstStartOfMonthUtc: () => new Date() },
      '@/lib/organization-quota-ledger': { getOrganizationQuotaUsage: async () => 1, recordOrganizationQuotaUsage: async () => { throw Error('quota rejection must not record') } },
      '@/lib/unified-plan': { isPaidPlan: () => false },
      '@/lib/quote/response-shape': { isQuoteProductProfile: () => true },
    })
    await check(`quote product ${role}`, async () => {
      const response = await quote.POST(new Request('https://example.invalid/api/quote/products?org=A', { method: 'POST', body: JSON.stringify({ name: 'product' }) }))
      const body = await response.json()
      assert.equal(response.status, 402); assert.equal(body.code, 'LIMIT_REACHED')
      assert.equal(body.canManageBilling, role === 'owner')
      assert.equal(body.upgradeUrl, role === 'owner' ? '/quote/pricing?org=A' : undefined)
      assert.equal(writes, 0)
    })

    let generated = 0
    const mensetsu = load('src/app/api/mensetsu/templates/route.ts', {
      ...actualWorkspace,
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { mensetsuTemplate: { deleteMany: async () => {}, findFirst: async () => null } } },
      '@/lib/organization-billing': { getOrganizationOwnerUserId: async () => 'actor' },
      '@/lib/mensetsu/access': { getMensetsuContext: async slug => { assert.equal(slug, 'A'); return { organizationId: 'org-A', organizationSlug: 'A', userId: role === 'owner' ? 'actor' : 'member', role } }, orgSlugFrom: req => new URL(req.url).searchParams.get('org') || undefined },
      '@/lib/plan-limit': { FREE_LIMITS: { mensetsuTemplates: 1 }, assertFreeLimit: async () => ({ ok: false, used: 1, limit: 1, reason: '無料プランの上限に達しました。' }) },
      '@/lib/mensetsu/template': { generateTemplate: async () => { generated++; throw Error('quota rejection must not generate') } },
    })
    await check(`mensetsu template ${role}`, async () => {
      const response = await mensetsu.POST(new Request('https://example.invalid/api/mensetsu/templates?org=A', { method: 'POST', body: '{}' }))
      const body = await response.json()
      assert.equal(response.status, 402); assert.equal(body.code, 'LIMIT_REACHED')
      assert.equal(body.canManageBilling, role === 'owner')
      assert.equal(body.upgradeUrl, role === 'owner' ? '/mensetsu/pricing?org=A' : undefined)
      assert.equal(generated, 0)
    })
  }
  console.log(JSON.stringify({ passed: results.length, results, scope: 'actual candidate routes with synthetic authority/quota/Prisma; blocked writes/provider counters zero' }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
