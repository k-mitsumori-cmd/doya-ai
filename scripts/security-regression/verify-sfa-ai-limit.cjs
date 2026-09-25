const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(plan, initial = 0) {
  const rows = Array.from({ length: initial }, (_, i) => ({ id: `old-${i}`, userId: 'member', serviceId: 'sfa', outputType: 'SFA_AI_COMPLETE', metadata: { organizationId: 'org' }, createdAt: new Date() }));
  let tail = Promise.resolve();
  let ownerLookups = 0;
  const generation = {
    deleteMany: async ({ where }) => {
      const ids = rows.filter((r) => r.serviceId === where.serviceId && r.outputType === where.outputType && (!where.id || r.id === where.id) && (!where.metadata || r.metadata.organizationId === where.metadata.equals) && (!where.createdAt || r.createdAt < where.createdAt.lt)).map((r) => r.id);
      for (const id of ids) rows.splice(rows.findIndex((r) => r.id === id), 1);
      return { count: ids.length };
    },
    count: async ({ where }) => rows.filter((r) => r.serviceId === where.serviceId && where.outputType.in.includes(r.outputType) && r.metadata.organizationId === where.metadata.equals && r.createdAt >= where.createdAt.gte).length,
    create: async ({ data }) => { const row = { ...data, id: `new-${rows.length}`, createdAt: new Date() }; rows.push(row); return { id: row.id }; },
    updateMany: async ({ where, data }) => { const row = rows.find((r) => r.id === where.id && r.outputType === where.outputType); if (row) row.outputType = data.outputType; return { count: row ? 1 : 0 }; },
  };
  const tx = {
    generation,
    sfaMember: { findFirst: async () => ({ userId: 'owner' }) },
    user: { findUnique: async ({ where }) => { assert.equal(where.id, 'owner'); ownerLookups++; return { plan }; } },
  };
  const prisma = { generation, $transaction: (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    const run = tail.then(() => fn(tx)); tail = run.catch(() => {}); return run;
  } };
  const api = load('src/lib/sfa/ai-limit.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date(Date.now() - 86400000) },
    './limits': { sfaOwnerPlanTier: async (db, org) => { assert.equal(org, 'org'); return (await db.user.findUnique({ where: { id: (await db.sfaMember.findFirst()).userId } })).plan; } },
  });
  return { api, rows, get ownerLookups() { return ownerLookups; } };
}

(async () => {
  const free = fixture('FREE', 19);
  const outcomes = await Promise.all([
    free.api.reserveSfaAiUsage('org', 'member-a', 'score'),
    free.api.reserveSfaAiUsage('org', 'member-b', 'next-action'),
  ]);
  assert.equal(outcomes.filter((r) => r.id).length, 1, 'one concurrent reservation must pass');
  assert.equal(outcomes.find((r) => r.limit).used, 20);
  assert.equal(free.ownerLookups, 2, 'both requests use the owner plan');
  const id = outcomes.find((r) => r.id).id;
  await free.api.completeSfaAiUsage(id);
  assert.equal(free.rows.find((r) => r.id === id).outputType, 'SFA_AI_COMPLETE');
  assert.equal((await free.api.reserveSfaAiUsage('org', 'member-c', 'score')).limit, 20);
  const quota = free.api.sfaAiLimitResponse({ limit: 20, used: 20 }, false);
  assert.equal(quota.status, 402);
  assert.equal((await quota.json()).code, 'SFA_AI_LIMIT_REACHED');

  const light = fixture('LIGHT', 299);
  const first = await light.api.reserveSfaAiUsage('org', 'member', 'score');
  assert.ok(first.id);
  assert.equal((await light.api.reserveSfaAiUsage('org', 'member', 'next-action')).limit, 300);
  await light.api.releaseSfaAiUsage(first.id);
  assert.ok((await light.api.reserveSfaAiUsage('org', 'member', 'next-action')).id, 'failed work returns its slot');

  const pro = fixture('PRO', 300);
  assert.ok((await pro.api.reserveSfaAiUsage('org', 'member', 'score')).id);
  console.log('PASS SFA AI quota: owner plan, shared actions, concurrent boundary, settlement, release, paid tiers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
