const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let storedPlan = 'FREE'
const access = load('src/lib/adimage/access.ts', {
  crypto: require('node:crypto'),
  'next-auth': { getServerSession: async () => ({ user: { id: 'user-1' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ plan: storedPlan }) } } },
})

;(async () => {
  for (const plan of ['LIGHT', 'PRO', 'ENTERPRISE', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS', 'PREMIUM']) {
    storedPlan = plan
    assert.equal((await access.getIdentity({ cookies: { get: () => null } })).plan, 'PRO', plan)
  }
  for (const plan of ['FREE', 'GUEST', 'UNKNOWN', 'NOT_PRO', 'APPROVED']) {
    storedPlan = plan
    assert.equal((await access.getIdentity({ cookies: { get: () => null } })).plan, 'FREE', plan)
  }
  console.log('PASS AdImage grants paid image quota only to recognized contract plans')
})().catch(error => { console.error(error); process.exitCode = 1 })
