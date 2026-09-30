const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const response = { NextResponse: Response }
const session = (signedIn) => ({ getServerSession: async () => signedIn ? { user: { id: 'user', plan: 'FREE' } } : null })

function route(service, signedIn) {
  const common = { 'next/server': response, 'next-auth': session(signedIn), '@/lib/auth': { authOptions: {} } }
  if (service === 'doyalist') {
    return load('src/app/api/doyalist/usage/route.ts', {
      ...common,
      '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ plan: 'FREE' }) }, doyalistProject: { count: async () => 1 } } },
      '@/lib/doyalist/limits': {
        getUserDoyalistLimits: async () => ({ tier: 'FREE', maxProjects: 2, maxCompaniesPerMonth: 10, maxApproachesPerMonth: 5 }),
        countMonthlyCompanies: async () => 3,
        countMonthlyApproaches: async () => 1,
        remaining: (used, limit) => limit - used,
        monthStart: () => new Date('2026-09-01T00:00:00Z'),
      },
    })
  }
  if (service === 'promane') {
    return load('src/app/api/promane/usage/route.ts', {
      ...common,
      '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ plan: 'FREE' }) } } },
      '@/lib/promane/limits': {
        getUserPromaneLimits: async () => ({ tier: 'FREE', maxProjects: 2, maxMembersPerWorkspace: 3, maxWorkspaces: 1 }),
        countUserProjects: async () => 1,
        countUserWorkspaces: async () => 1,
        remaining: (used, limit) => limit - used,
      },
    })
  }
  if (service === 'interview') {
    return load('src/app/api/interview/usage/route.ts', {
      ...common,
      '@/lib/prisma': { __esModule: true, default: { interviewMaterial: { aggregate: async () => ({ _sum: { duration: 60 } }) } } },
      '@/lib/pricing': { getInterviewLimitsByPlan: () => ({ transcriptionMinutes: 15 }) },
      '@/lib/interview/month': { interviewJstMonthStartUtc: () => new Date('2026-08-31T15:00:00Z') },
      '@/lib/interview/transcription-budget': {},
      '@/lib/interview/access': {},
    })
  }
  return load('src/app/api/hr/usage/route.ts', {
    'next/server': response,
    '@/lib/prisma': { prisma: {
      hrEmployee: { count: async () => 1 },
      hrOrganizationMember: { count: async () => 1 },
      hrOrganization: { findUnique: async () => ({ aiUsageCount: 0, aiUsageResetAt: null }) },
    } },
    '@/lib/hr/access': { getHrContext: async () => signedIn ? { organizationId: 'org', role: 'OWNER', employeeId: 'employee' } : null, hasMinRole: () => true },
    '@/lib/hr/billing': { getOrgPlan: async () => 'FREE', getOrgPlanLimits: () => ({ maxEmployees: 5, maxMembers: 5, maxAiUsage: 5 }), hrJstMonthStart: () => new Date('2026-08-31T15:00:00Z') },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN' } },
  })
}

;(async () => {
  for (const service of ['doyalist', 'hr', 'interview', 'promane']) {
    for (const signedIn of [false, true]) {
      const result = await route(service, signedIn).GET()
      assert.equal(result.status, signedIn ? 200 : 401, `${service} status`)
      assert.equal(result.headers.get('cache-control'), 'private, no-store', `${service} cache`)
      assert.equal(result.headers.get('vary'), 'Cookie', `${service} vary`)
    }
  }
  console.log('PASS active service usage responses remain private for signed-in and anonymous users')
})().catch((error) => { console.error(error); process.exitCode = 1 })
