// Baseline: actual route handlers, synthetic state transitions only. No database/provider.
const assert = require('node:assert/strict');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
(async () => {
  const results = [];
  for (const kind of ['task-create', 'activity-create', 'task-update', 'task-delete']) {
    let active = true, writes = 0;
    const changed = async row => { active = false; return row; };
    const prisma = {
      sfaDeal: {
        findFirst: async () => changed({ id: 'deal' }),
        findUnique: async () => changed({ id: 'deal', organizationId: 'org', isActive: true }),
      },
      sfaTask: {
        findUnique: async () => changed({ id: 'task', organizationId: 'org', status: 'open' }),
        create: async ({ data }) => { assert.equal(active, false); writes++; return { id: 'task', ...data }; },
        update: async ({ data }) => { assert.equal(active, false); writes++; return { id: 'task', ...data }; },
        delete: async () => { assert.equal(active, false); writes++; return { id: 'task' }; },
      },
      $transaction: async fn => fn({
        sfaActivity: { create: async ({ data }) => { assert.equal(active, false); writes++; return { id: 'activity', ...data }; } },
        sfaDeal: { updateMany: async () => ({ count: 1 }) },
      }),
    };
    const mocks = {
      'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
      '@/lib/sfa/access': { getSfaContext: async () => { assert.equal(active, true); return { userId: 'user', memberId: 'member', organizationId: 'org', role: 'member' }; }, orgSlugFrom: () => 'alpha' },
    };
    const file = kind === 'activity-create' ? 'src/app/api/sfa/activities/route.ts' : kind === 'task-create' ? 'src/app/api/sfa/tasks/route.ts' : 'src/app/api/sfa/tasks/[id]/route.ts';
    const route = load(file, mocks);
    const method = kind.endsWith('create') ? 'POST' : kind.endsWith('update') ? 'PATCH' : 'DELETE';
    const response = await route[method]({ json: async () => kind === 'activity-create' ? { subject: 'synthetic', dealId: 'deal' } : { title: 'synthetic', ...(kind === 'task-create' ? { dealId: 'deal' } : {}) } }, { params: Promise.resolve({ id: 'task' }) });
    assert.equal(response.status, 200); assert.equal(writes, 1);
    results.push({ kind, status: response.status, writesAfterSyntheticMembershipRevocation: writes });
  }
  console.log(JSON.stringify({ status: 'confirmed-open', results, scope: 'Actual SFA task/activity handlers; synthetic membership changes after context validation at relation/task lookup. Proves handlers commit using the old authorization snapshot. Does not prove real DB scheduling, actual customer access or incident; no real writes.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
