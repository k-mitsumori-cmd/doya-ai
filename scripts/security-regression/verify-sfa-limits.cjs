const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(plan = 'FREE', counts = {}) {
  const state = { members: counts.members ?? 1, pending: counts.pending ?? 0, accounts: counts.accounts ?? 0, deals: counts.deals ?? 0 };
  let tail = Promise.resolve();
  let selectedUser = null;
  const tx = {
    sfaMember: {
      findFirst: async () => ({ userId: 'owner' }),
      count: async ({ where }) => state.members + (where.OR.length > 1 ? state.pending : 0),
      create: async () => { state.pending++; return { id: `member-${state.pending}` }; },
    },
    user: { findUnique: async ({ where }) => { selectedUser = where.id; return { plan }; } },
    sfaAccount: {
      count: async () => state.accounts,
      create: async () => { state.accounts++; return { id: `account-${state.accounts}` }; },
    },
    sfaDeal: {
      count: async () => state.deals,
      create: async () => { state.deals++; return { id: `deal-${state.deals}` }; },
    },
  };
  const prisma = {
    $transaction: (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      const run = tail.then(async () => {
        const snapshot = { ...state };
        try { return await fn(tx); }
        catch (error) { Object.assign(state, snapshot); throw error; }
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  const limits = load('src/lib/sfa/limits.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/plan-utils': { tierFrom: (value) => value || 'FREE' },
  });
  return { state, tx, limits, get selectedUser() { return selectedUser; } };
}

(async () => {
  const free = fixture('FREE', { accounts: 49, deals: 49 });
  const responses = await Promise.all(Array.from({ length: 2 }, () =>
    free.limits.withSfaAdmission('org', { accounts: 1, deals: 1 }, async (tx) => {
      await tx.sfaAccount.create();
      await tx.sfaDeal.create();
      return 'created';
    })
  ));
  assert.equal(responses.filter((r) => r.created).length, 1);
  assert.equal(responses.filter((r) => r.limit).length, 1);
  assert.equal(free.state.accounts, 50);
  assert.equal(free.state.deals, 50);
  assert.equal(free.selectedUser, 'owner', 'the organization owner pays for the shared quota');
  const blocked = responses.find((r) => r.limit);
  const response = free.limits.sfaQuotaResponse(blocked.limit);
  assert.equal(response.status, 402);
  assert.equal((await response.json()).upgradeUrl, '/sfa/pricing');

  const mixed = fixture('FREE', { accounts: 49, deals: 50 });
  let called = false;
  const denied = await mixed.limits.withSfaAdmission('org', { accounts: 1, deals: 1 }, async () => { called = true; });
  assert.equal(denied.limit.resource, 'deals');
  assert.equal(called, false, 'conversion must not create a partial account');
  assert.equal(mixed.state.accounts, 49);

  const members = fixture('FREE', { members: 1, pending: 1 });
  const invited = await members.limits.withSfaAdmission('org', { members: 1 }, (tx) => tx.sfaMember.create(), { countPendingInvites: true });
  assert.ok(invited.created);
  const noMore = await members.limits.withSfaAdmission('org', { members: 1 }, (tx) => tx.sfaMember.create(), { countPendingInvites: true });
  assert.equal(noMore.limit.resource, 'members');
  assert.equal(members.state.pending, 2);

  const light = fixture('LIGHT', { accounts: 1000 });
  const lightLimit = await light.limits.withSfaAdmission('org', { accounts: 1 }, (tx) => tx.sfaAccount.create());
  assert.equal(lightLimit.limit.resource, 'accounts');
  assert.equal((await light.limits.sfaQuotaResponse(lightLimit.limit).json()).upgradeUrl, '/sfa/pricing');

  const paid = fixture('PRO', { members: 49, accounts: 50, deals: 50 });
  assert.equal((await paid.limits.withSfaAdmission('org', { accounts: 1, deals: 1 }, async (tx) => {
    await tx.sfaAccount.create();
    await tx.sfaDeal.create();
  })).limit, undefined);
  assert.equal((await paid.limits.withSfaAdmission('org', { members: 1 }, (tx) => tx.sfaMember.create())).limit, undefined);
  paid.state.members = 50;
  assert.equal((await paid.limits.withSfaAdmission('org', { members: 1 }, (tx) => tx.sfaMember.create())).limit.resource, 'members');

  const rollback = fixture('FREE', { accounts: 49 });
  await assert.rejects(rollback.limits.withSfaAdmission('org', { accounts: 1 }, async (tx) => {
    await tx.sfaAccount.create();
    throw new Error('insert failed');
  }));
  assert.equal(rollback.state.accounts, 49);
  console.log('PASS SFA limits: owner plan, concurrent admission, conversion atomicity, pending invites, paid plan, rollback');
})().catch((error) => { console.error(error); process.exitCode = 1; });
