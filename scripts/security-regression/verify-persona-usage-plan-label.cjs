const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { getPersonaUsage } = load('src/lib/persona/usage.ts', {
  '@/lib/pricing': { getPersonaDailyLimitByUserPlan: () => 5 },
  '@/lib/plan-utils': load('src/lib/plan-utils.ts'),
  './usage-day': { personaUsageDay: () => new Date('2026-10-04T00:00:00Z') },
  './image-ledger': { personaExtraImageLimit: () => 5 },
})

async function usage(plan) {
  const tx = {
    user: { findUnique: async () => ({ plan }) },
    personaUsageDay: { findUnique: async () => null },
    personaImageUsageDay: { findUnique: async () => null },
    userServiceSubscription: { findUnique: async () => null },
    personaProject: { count: async () => 0 },
    personaImageJob: { count: async () => 0 },
  }
  return getPersonaUsage({ $transaction: (fn) => fn(tx) }, 'user-1')
}

;(async () => {
  for (const [plan, expected] of [['FREE', 'FREE'], ['LIGHT', 'LIGHT'], ['PRO', 'PRO'], ['ENTERPRISE', 'ENTERPRISE'], ['PREMIUM', 'PRO'], ['unknown', 'FREE']]) {
    assert.equal((await usage(plan)).planLabel, expected, plan)
  }
  console.log('PASS persona usage displays the actual contract tier, including LIGHT')
})().catch(error => { console.error(error); process.exitCode = 1 })
