const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let plan = 'FREE';
let ledger = null;
const history = [];
let modelCalls = 0;
let failModel = false;
let lockTail = Promise.resolve();
const approachStore = {
  count: async ({ where }) => history.filter((row) => row.createdAt >= where.createdAt.gte).length,
  create: async ({ data }) => {
    const row = { ...data, id: `approach-${history.length + 1}`, createdAt: new Date() };
    history.push(row);
    return { id: row.id };
  },
};
const subscriptionStore = {
  findUnique: async () => ledger && structuredClone(ledger),
  upsert: async ({ create, update }) => {
    ledger = ledger ? { ...ledger, ...update } : { ...create };
    return ledger;
  },
  update: async ({ data }) => {
    ledger.monthlyUsage -= data.monthlyUsage.decrement;
    return ledger;
  },
};
const tx = { $queryRaw: async () => [{ id: 'user' }], doyalistApproach: approachStore, userServiceSubscription: subscriptionStore };
const prisma = {
  user: { findUnique: async () => ({ plan }) },
  doyalistProject: { findFirst: async () => ({ id: 'history-project' }) },
  doyalistApproach: approachStore,
  userServiceSubscription: subscriptionStore,
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
const route = load('src/app/api/doyalist/tools/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@seo/lib/gemini': {
    GEMINI_TEXT_MODEL_DEFAULT: 'test',
    geminiGenerateText: async () => {
      modelCalls++;
      if (failModel) throw new Error('Synthetic AI failure');
      return '営業文';
    },
  },
  '@/lib/doyalist/collect/web-scraper': { scrapeCompanyWebsite: async () => null },
  '@/lib/doyalist/limits': limits,
});
const post = (body = { type: 'form', serviceInput: 'サービス' }) => route.POST({ json: async () => body });

(async () => {
  assert.equal((await post({ type: 'form', serviceInput: {} })).status, 400);
  assert.equal(modelCalls, 0);
  const responses = await Promise.all(Array.from({ length: 31 }, () => post()));
  assert.equal(responses.filter((response) => response.status === 200).length, 30);
  assert.equal(responses.filter((response) => response.status === 403).length, 1);
  assert.equal(modelCalls, 30, 'over-limit request must not invoke paid AI');
  assert.equal(await limits.countMonthlyApproaches('user'), 30);
  history.length = 0;
  assert.equal(await limits.countMonthlyApproaches('user'), 30, 'history deletion cannot restore consumed quota');
  plan = 'PRO';
  failModel = true;
  assert.equal((await post()).status, 500);
  assert.equal(ledger.monthlyUsage, 30, 'failed AI response must refund the same-month reservation');
  await limits.releaseMonthlyApproach('user', limits.monthStart(new Date('2026-08-01T00:00:00Z')));
  assert.equal(ledger.monthlyUsage, 30, 'old-month refund must not affect the current quota');
  console.log('PASS Doyalist approaches: validated input, concurrent cap, no paid over-limit call, deletion safety, failed-call refund');
})().catch((error) => { console.error(error); process.exitCode = 1; });
