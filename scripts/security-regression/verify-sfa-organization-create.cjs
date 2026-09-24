const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const stages = [{ name: '見込み', order: 0, probability: 10 }, { name: '提案', order: 1, probability: 40 }];

function fixture({ failTask = false, conflictOnce = false } = {}) {
  const rows = { organizations: [], members: [], pipelines: [], stages: [], accounts: [], deals: [], tasks: [] };
  let transactions = 0;
  const tx = {
    sfaMember: {
      findFirst: async () => {
        const member = rows.members.find((item) => item.userId === 'user' && item.status === 'ACTIVE');
        return member ? { ...member, organization: rows.organizations.find((org) => org.id === member.organizationId) } : null;
      },
      create: async ({ data }) => { rows.members.push(data); return data; },
    },
    sfaOrganization: {
      findUnique: async ({ where }) => rows.organizations.find((org) => org.slug === where.slug) || null,
      create: async ({ data }) => { const org = { id: `org-${rows.organizations.length + 1}`, ...data }; rows.organizations.push(org); return org; },
    },
    sfaPipeline: { create: async ({ data }) => { const row = { id: 'pipeline', ...data }; rows.pipelines.push(row); return row; } },
    sfaStage: {
      createMany: async ({ data }) => { rows.stages.push(...data); return { count: data.length }; },
      findMany: async () => rows.stages.map((row) => ({ id: `stage-${row.order}`, ...row })),
    },
    sfaAccount: { create: async ({ data }) => { const row = { id: 'account', ...data }; rows.accounts.push(row); return row; } },
    sfaDeal: { create: async ({ data }) => { rows.deals.push(data); return data; } },
    sfaTask: { create: async ({ data }) => { if (failTask) throw Error('sample task failed'); rows.tasks.push(data); return data; } },
  };
  const prisma = { $transaction: async (callback, options) => {
    transactions++;
    assert.equal(options.isolationLevel, 'Serializable');
    if (conflictOnce && transactions === 1) throw Object.assign(Error('serialization conflict'), { code: 'P2034' });
    const before = structuredClone(rows);
    try { return await callback(tx); }
    catch (error) { Object.assign(rows, before); throw error; }
  } };
  const deps = {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    './types': { ROLE_HIERARCHY: {} },
    './constants': { DEFAULT_STAGES: stages },
  };
  const { getOrCreateOrganization } = load('src/lib/sfa/access.ts', deps);
  return { rows, get transactions() { return transactions; }, create: () => getOrCreateOrganization('user', 'Acme', 'Owner') };
}

(async () => {
  const failed = fixture({ failTask: true });
  await assert.rejects(failed.create(), /sample task failed/);
  assert.deepEqual(Object.values(failed.rows).map((items) => items.length), [0, 0, 0, 0, 0, 0, 0]);

  const normal = fixture();
  const first = await normal.create();
  assert.equal(first.name, 'Acme');
  assert.deepEqual(Object.values(normal.rows).map((items) => items.length), [1, 1, 1, 2, 1, 1, 1]);
  assert.equal((await normal.create()).id, first.id);
  assert.equal(normal.rows.organizations.length, 1);

  const retry = fixture({ conflictOnce: true });
  await retry.create();
  assert.equal(retry.transactions, 2);
  assert.equal(retry.rows.organizations.length, 1);

  let calls = 0;
  const route = load('src/app/api/sfa/organization/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {} },
    '@/lib/sfa/access': { getOrCreateOrganization: async () => { calls++; return { id: 'org', name: 'Acme', slug: 'acme' }; } },
  });
  for (const body of [null, [], {}, { name: 12, memberName: 'Owner' }, { name: 'Acme', memberName: {} }, { name: ' ', memberName: 'Owner' }]) {
    const response = await route.POST({ json: async () => body });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  }
  assert.equal((await route.POST({ json: async () => ({ name: ' Acme ', memberName: ' Owner ' }) })).status, 200);
  assert.equal(calls, 1);
  console.log('PASS SFA organization: malformed input, atomic bootstrap, idempotency and retry');
})().catch((error) => { console.error(error); process.exitCode = 1; });
