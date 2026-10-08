const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const operationalJson = load('src/lib/operational-json.ts', {}, { TextDecoder, Uint8Array });
const streamJson = load('src/lib/doyalist/stream-json.ts', {}, { TextEncoder, ReadableStream, Uint8Array });

const companies = [
  { source: 'gbizinfo', createdAt: new Date('2026-08-31T14:59:59Z') },
  { source: 'manual', createdAt: new Date() },
];
let nextId = 1;
let plan = 'FREE';
let lockTail = Promise.resolve();

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
  user: { findUnique: async () => ({ plan }) },
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
  '@/lib/plan-utils': { tierFrom: (value) => value },
});
(async () => {
  assert.equal(limits.monthStart(new Date('2026-09-30T14:59:59Z')).toISOString(), '2026-08-31T15:00:00.000Z');
  assert.equal(limits.monthStart(new Date('2026-09-30T15:00:00Z')).toISOString(), '2026-09-30T15:00:00.000Z');
  assert.ok(limits.monthlyCompanyWhere('user').OR.some(condition => condition.source?.contains === 'gbizinfo'));
  assert.equal(await limits.countMonthlyCompanies('user'), 0, 'old and manual rows do not consume current month quota');
  companies.push({source:'gbizinfo+synthetic',createdAt:new Date()},{source:'corporate_number',createdAt:new Date()});
  assert.equal(await limits.countMonthlyCompanies('user'),2,'recognized source variants count');
  // PostgreSQL admission/replay coverage is mandatory in CI and the release gate.
  // The hosting build contains offline regressions only: it has neither audit
  // fixtures nor PostgreSQL binaries. Do not silently skip a DB test here.
  console.log('PASS Doyalist monthly JST/source accounting; database reservations and replay run as separate mandatory CI steps');
})().catch(error=>{console.error(error);process.exitCode=1});
