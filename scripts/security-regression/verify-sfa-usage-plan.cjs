const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

(async () => {
  let planQueries = 0;
  let selectedOrg = null;
  const prisma = {
    user: { findUnique: async () => { planQueries++; return { plan: 'PRO' }; } },
    sfaAccount: { count: async () => 4 },
    sfaDeal: { count: async () => 2 },
    sfaLead: { count: async () => 1 },
    sfaTask: { count: async () => 3 },
  };
  const route = load('src/app/api/sfa/usage/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': {
      orgSlugFrom: (req) => req.org,
      listMemberships: async () => [{ slug: 'team-a', role: 'member' }],
      getSfaContext: async (org) => org === 'foreign' ? null : { organizationId: 'org-a', organizationSlug: 'team-a', userId: 'member', role: 'member' },
    },
    '@/lib/sfa/limits': { sfaOwnerPlanTier: async (db, org) => { assert.equal(db, prisma); selectedOrg = org; return 'FREE'; } },
  });
  const response = await route.GET({ org: 'team-a' });
  const body = await response.json();
  assert.equal(body.plan, 'FREE', 'show the organization owner plan, not the member individual PRO plan');
  assert.equal(body.role, 'member');
  assert.equal(selectedOrg, 'org-a');
  assert.equal(planQueries, 0);
  assert.equal(body.counts.accounts, 4);
  const foreign = await route.GET({ org: 'foreign' });
  assert.equal((await foreign.json()).onboarded, false);
  console.log('PASS SFA usage: displayed plan follows owner and selected organization');
})().catch((error) => { console.error(error); process.exitCode = 1; });
