const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const row = { id: 'org', aiUsageCount: 2, aiUsageResetAt: new Date('2026-08-31T15:00:00Z') }
let chain = Promise.resolve()
const tx = {
  $queryRaw: async (_strings, id) => id === row.id ? [{ id }] : [],
  hrOrganization: {
    findUnique: async () => ({ ...row }),
    update: async ({ data }) => {
      row.aiUsageCount = typeof data.aiUsageCount === 'number'
        ? data.aiUsageCount : row.aiUsageCount + data.aiUsageCount.increment
      if (data.aiUsageResetAt) row.aiUsageResetAt = data.aiUsageResetAt
    },
  },
  hrOrganizationMember: { findFirst: async () => ({ userId: 'owner' }) },
  user: { findUnique: async () => ({ plan: 'FREE' }) },
}
const prisma = {
  $transaction: async (fn) => {
    const result = chain.then(() => fn(tx))
    chain = result.catch(() => {})
    return result
  },
  hrOrganization: {
    updateMany: async ({ where }) => {
      if (where.id === row.id && where.aiUsageResetAt.getTime() === row.aiUsageResetAt.getTime() && row.aiUsageCount > 0) {
        row.aiUsageCount--
      }
    },
  },
}
const { hrJstMonthStart, reserveAiUsage, releaseAiUsage } = load('src/lib/hr/billing.ts', {
  '@/lib/prisma': { prisma },
})

;(async () => {
  assert.equal(hrJstMonthStart(new Date('2026-09-30T14:59:59Z')).toISOString(), '2026-08-31T15:00:00.000Z')
  assert.equal(hrJstMonthStart(new Date('2026-09-30T15:00:00Z')).toISOString(), '2026-09-30T15:00:00.000Z')

  const beforeMidnight = new Date('2026-09-30T14:59:59Z')
  const [first, second] = await Promise.all([
    reserveAiUsage('org', beforeMidnight), reserveAiUsage('org', beforeMidnight),
  ])
  assert.equal(first.granted, true)
  assert.equal(second.granted, false, 'parallel calls cannot spend the same last slot')
  assert.equal(row.aiUsageCount, 3)

  await releaseAiUsage(first.reservation)
  assert.equal(row.aiUsageCount, 2, 'failed generation restores its slot')
  const retry = await reserveAiUsage('org', beforeMidnight)
  assert.equal(retry.granted, true)
  assert.equal(row.aiUsageCount, 3)

  const newMonth = await reserveAiUsage('org', new Date('2026-09-30T15:00:00Z'))
  assert.equal(newMonth.granted, true)
  assert.equal(row.aiUsageCount, 1, 'JST month rollover resets the previous month')
  await releaseAiUsage(retry.reservation)
  assert.equal(row.aiUsageCount, 1, 'an old reservation cannot reduce the new month')
  await releaseAiUsage(newMonth.reservation)
  assert.equal(row.aiUsageCount, 0)

  const displayedAt = new Date('2026-09-30T15:00:00Z')
  const usage = load('src/app/api/hr/usage/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {
      hrEmployee: { count: async () => 0 },
      hrOrganizationMember: { count: async () => 1 },
      hrOrganization: { findUnique: async () => row },
    } },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', role: 'OWNER' }), hasMinRole: () => true },
    '@/lib/hr/billing': {
      getOrgPlan: async () => 'FREE',
      getOrgPlanLimits: () => ({ maxEmployees: 5, maxMembers: 2, maxAiUsage: 3 }),
      hrJstMonthStart: (value) => hrJstMonthStart(value ?? displayedAt),
    },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN' } },
  })
  row.aiUsageCount = 2
  row.aiUsageResetAt = new Date('2026-08-31T15:00:00Z')
  assert.equal((await (await usage.GET()).json()).aiUsageCount, 0, 'usage display clears at JST month rollover')
  row.aiUsageResetAt = displayedAt
  assert.equal((await (await usage.GET()).json()).aiUsageCount, 2, 'usage display shows the active JST month')
  console.log('PASS HR AI quota reserves atomically, resets in JST, and refunds only the reserved month')
})().catch(error => { console.error(error); process.exitCode = 1 })
