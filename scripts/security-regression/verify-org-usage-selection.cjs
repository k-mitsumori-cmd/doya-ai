const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const memberships = [
  { organizationId: 'org-a', slug: 'team-a', role: 'owner', createdAt: 1 },
  { organizationId: 'org-b', slug: 'team-b', role: 'member', createdAt: 2 },
]
const counts = { 'org-a': 2, 'org-b': 4 }
const member = {
  findFirst: async ({ where, orderBy }) => {
    if (where.organizationId) {
      return { userId: where.organizationId === 'org-a' ? 'free-owner' : 'pro-owner' }
    }
    let rows = memberships.filter((m) => !where.organization || m.slug === where.organization.slug)
    if (where.role) rows = rows.filter((m) => m.role === where.role)
    if (orderBy?.createdAt === 'desc') rows.reverse()
    return rows[0] ? { organizationId: rows[0].organizationId } : null
  },
}
const count = async ({ where }) => counts[where.organizationId.in[0]]
const prisma = {
  mensetsuMember: member,
  aishodanMember: member,
  quoteMember: member,
  shodanMember: member,
  mensetsuSession: { count },
  aishodanSession: { count },
  quoteDocument: { count },
  shodanPreparation: { count },
  user: {
    findUnique: async ({ where }) => ({ plan: where.id === 'free-owner' ? 'FREE' : 'PRO' }),
  },
}
const summary = load('src/lib/usage-summary.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/persona/usage': { getPersonaUsage: async () => null },
  '@/lib/pricing': {},
  '@/lib/plan-limit': {
    FREE_LIMITS: { mensetsuSessions: 3, aishodanSessions: 5, quoteDocuments: 3 },
    PRO_MONTHLY_LIMITS: { mensetsuSessions: 30, aishodanSessions: 30, quoteDocuments: 100 },
    ENTERPRISE_MONTHLY_LIMITS: { mensetsuSessions: 200, aishodanSessions: 200, quoteDocuments: 500 },
  },
  '@/lib/unified-plan': { isPaidPlan: (plan) => plan === 'PRO' || plan === 'ENTERPRISE' },
  '@/lib/shodan/types': { PREP_STALE_MS: 300000, SHODAN_MONTHLY_LIMIT: { FREE: 1, PRO: 30, ENTERPRISE: 200 } },
})

;(async () => {
  const interview = await summary.getUsageSummary('mensetsu', 'viewer', 'PRO')
  assert.equal(interview.meters[0].used, 4, 'interview uses newest organization by default')
  const quote = await summary.getUsageSummary('quote', 'viewer', 'PRO')
  assert.equal(quote.meters[0].used, 2, 'quote uses owned organization before newer membership')
  const shodan = await summary.getUsageSummary('shodan', 'viewer', 'PRO', 'team-a')
  assert.equal(shodan.meters[0].used, 2, 'selected organization controls shodan usage')
  assert.equal(await summary.getUsageSummary('shodan', 'viewer', 'PRO', 'foreign'), null)

  const aishodan = await summary.getUsageSummary('aishodan', 'viewer', 'PRO')
  assert.equal(aishodan.meters[0].used, 2)
  assert.equal(aishodan.meters[0].limit, 5, 'guest-facing admission uses the FREE owner, not the PRO viewer')
  assert.equal(aishodan.planLabel, '無料')
  const selected = await summary.getUsageSummary('aishodan', 'viewer', 'FREE', 'team-b')
  assert.equal(selected.meters[0].used, 4)
  assert.equal(selected.meters[0].limit, 30, 'selected organization uses its PRO owner plan')

  const seen = []
  const route = load('src/app/api/usage/[service]/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'viewer' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findFirst: async () => ({ id: 'viewer', plan: 'FREE' }) } } },
    '@/lib/aio/access': { getAioContext: async () => null, orgSlugFrom: () => undefined },
    '@/lib/aio/usage': { getAioUsage: async () => null },
    '@/lib/usage-summary': { getUsageSummary: async (...args) => {
      seen.push(args)
      return args[3] === 'foreign' ? null : { meters: [] }
    } },
  })
  const authorized = await route.GET(new Request('https://example.test/api/usage/shodan?org=team-a'), { params: Promise.resolve({ service: 'shodan' }) })
  assert.equal(authorized.status, 200)
  assert.equal(seen[0][3], 'team-a', 'usage API forwards the selected organization')
  const forbidden = await route.GET(new Request('https://example.test/api/usage/shodan?org=foreign'), { params: Promise.resolve({ service: 'shodan' }) })
  assert.equal(forbidden.status, 403, 'foreign organization cannot fall back to another organization')
  console.log('PASS organization usage: selected org, default org, owner plan, foreign org rejection')
})().catch((error) => { console.error(error); process.exitCode = 1 })
