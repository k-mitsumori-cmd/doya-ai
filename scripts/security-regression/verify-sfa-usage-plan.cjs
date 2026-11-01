const {withSfaAuthority}=require('./sfa-authority-fixture.cjs');
const {matches}=require('./sfa-query-fixture.cjs');
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

(async () => {
  let planQueries = 0;
  let selectedOrg = null;
  const model=(n,kind)=>({count:async({where})=>{const rows=Array.from({length:n},(_,i)=>({id:'row-'+i,organizationId:'org-a',isActive:true,ownerMemberId:'member-id',assigneeMemberId:'member-id',status:'open'}));rows.push({...rows[0],id:'foreign',organizationId:'other'},{...rows[0],id:'other-owner',ownerMemberId:'other',assigneeMemberId:'other'});const selected=rows.filter(r=>matches(r,where));assert.equal(selected.length,n,kind+' scope excludes foreign and other owner');return selected.length;}});
  const prisma = {
    user: { findUnique: async () => { planQueries++; return { plan: 'PRO' }; } },
    sfaAccount: model(4,'Account'),
    sfaDeal: model(2,'Deal'),
    sfaLead: model(1,'Lead'),
    sfaTask: model(3,'Task'),
  };
  const route = load('src/app/api/sfa/usage/route.ts', withSfaAuthority({
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': {
      orgSlugFrom: (req) => req.org,
      listMemberships: async () => [{ slug: 'team-a', role: 'member' }],
      getSfaContext: async (org) => org === 'foreign' ? null : { organizationId: 'org-a', organizationSlug: 'team-a', userId: 'member', memberId:'member-id', role: 'member' },
    },
    '@/lib/sfa/limits': { sfaOwnerPlanTier: async (db, org) => { assert.equal(db.user, prisma.user); selectedOrg = org; return 'FREE'; } },
  }));
  const response = await route.GET({ org: 'team-a' });
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('vary'),'Cookie');
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
