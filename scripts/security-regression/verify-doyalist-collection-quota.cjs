const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const companies = [
  { source: 'gbizinfo', createdAt: new Date('2026-08-31T14:59:59Z') },
  { source: 'manual', createdAt: new Date() },
];
let nextId = 1;
let lockTail = Promise.resolve();
let collectorCalls = 0;
let releaseCollectors;
const collectorsReady = new Promise((resolve) => { releaseCollectors = resolve; });
const companyStore = {
  count: async ({ where }) => companies.filter((row) =>
    row.createdAt >= where.createdAt.gte && where.OR.some((condition) =>
      typeof condition.source === 'string'
        ? row.source === condition.source
        : row.source.includes(condition.source.contains))).length,
  createManyAndReturn: async ({ data }) => {
    const created = data.map((row) => ({ ...row, id: `company-${nextId++}`, createdAt: new Date() }));
    companies.push(...created);
    return created;
  },
};
const tx = { $queryRaw: async () => [{ id: 'user' }], doyalistCompany: companyStore };
const prisma = {
  user: { findUnique: async () => ({ plan: 'FREE' }) },
  doyalistCompany: companyStore,
  doyalistProject: { findUnique: async () => ({ id: 'project-1', userId: 'user', industry: null, region: null, keywords: '' }) },
  $transaction: async (operation) => {
    const prior = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => { unlock = resolve; });
    await prior;
    try { return await operation(tx); }
    finally { unlock(); }
  },
};
const limits = load('src/lib/doyalist/limits.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/plan-utils': { tierFrom: () => 'FREE' },
});
const route = load('src/app/api/doyalist/collect/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/doyalist/limits': limits,
  '@/lib/doyalist/collect': {
    collectCompaniesDetailed: async ({ maxResults }) => {
      collectorCalls++;
      if (collectorCalls === 2) releaseCollectors();
      await collectorsReady;
      return {
        apiOk: true,
        companies: Array.from({ length: maxResults }, (_, index) => ({ companyName: `企業${collectorCalls}-${index}`, source: 'gbizinfo' })),
      };
    },
  },
});
const post = () => route.POST({ json: async () => ({ projectId: 'project-1', count: 70 }) });

(async () => {
  assert.equal(limits.monthStart(new Date('2026-09-30T14:59:59Z')).toISOString(), '2026-08-31T15:00:00.000Z');
  assert.equal(limits.monthStart(new Date('2026-09-30T15:00:00Z')).toISOString(), '2026-09-30T15:00:00.000Z');
  assert.ok(limits.monthlyCompanyWhere('user').OR.some((condition) => condition.source?.contains === 'gbizinfo'), 'merged source variants must count');
  assert.equal(await limits.countMonthlyCompanies('user'), 0, 'old and manual rows must not consume this month’s collection quota');
  const responses = await Promise.all([post(), post()]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const payloads = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(payloads.map((payload) => payload.generated), [70, 30]);
  assert.equal(await limits.countMonthlyCompanies('user'), 100, 'actual gbizinfo rows must count toward the quota');
  assert.match(payloads[1].warning, /残り枠/);
  assert.equal(collectorCalls, 2);
  console.log('PASS Doyalist collection: JST month, actual source count, concurrent cap, exact created rows');
})().catch((error) => { console.error(error); process.exitCode = 1; });
