const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const pricing = load('src/lib/pricing.ts', { './unified-plan': {
  UNIFIED_PRO_PRICE: 9980, UNIFIED_PRO_PRICE_LABEL: '¥9,980', isPaidPlan: () => false,
} });
const access = load('src/lib/seoAccess.ts', { 'next/server': {}, '@/lib/pricing': pricing });
assert.deepEqual(JSON.parse(JSON.stringify(access.isTrialActive(new Date().toISOString()))), { active: false, remainingMs: 0 });
const { createSeoArticleWithinLimit, getSeoArticleMonthlyUsage, getSeoArticleMonthlyUsageForUsers, seoArticleUsageKey, SeoArticleQuotaError } = load('src/lib/seo-article-admission.ts', {
  'node:crypto': require('node:crypto'), '@/lib/prisma': { prisma: {} }, '@/lib/seoAccess': access,
});
for (const [plan, upgradeAvailable] of [['GUEST', false], ['FREE', true], ['LIGHT', true], ['PRO', false], ['ENTERPRISE', false]]) {
  assert.equal(new SeoArticleQuotaError(1, plan === 'GUEST', plan).upgradeAvailable, upgradeAvailable, `${plan} quota action`);
}

let rows = [];
let jobs = [];
const usage = new Map();
let nextId = 1;
let lock = Promise.resolve();
const db = {
  $transaction: async (fn) => {
    let release;
    const prior = lock;
    lock = new Promise(resolve => { release = resolve; });
    await prior;
    const stagedRows = [];
    const stagedJobs = [];
    const stagedUsage = [];
    const tx = {
      $executeRaw: async () => 1,
      seoArticle: {
        count: async ({ where }) => rows.filter(row => row.userId === where.userId && row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt).length,
        create: async ({ data }) => { const article = { ...data, id: `a${nextId++}` }; stagedRows.push(article); return article; },
      },
      seoJob: { create: async ({ data }) => { const job = { ...data, id: `j${nextId++}` }; stagedJobs.push(job); return job; } },
      systemSetting: {
        findUnique: async ({ where }) => usage.has(where.key) ? { value: usage.get(where.key) } : null,
        upsert: async ({ where, create, update }) => { stagedUsage.push([where.key, usage.has(where.key) ? update.value : create.value]); },
      },
    };
    try {
      const result = await fn(tx);
      rows.push(...stagedRows);
      jobs.push(...stagedJobs);
      for (const [key, value] of stagedUsage) usage.set(key, value);
      return result;
    } finally { release(); }
  },
};
const create = (overrides = {}) => createSeoArticleWithinLimit({
  userId: 'u1', guestId: null, plan: 'FREE',
  articleData: { title: 'test', keywords: [] }, createJob: true, ...overrides,
}, db);

(async () => {
  await assert.rejects(create({ userId: null, guestId: 'g1', plan: 'GUEST' }), e => e instanceof SeoArticleQuotaError && e.guest);
  assert.equal(rows.length, 0);

  const first = await create();
  assert.equal(first.job.articleId, first.article.id);
  assert.equal(rows.length, 1);
  await assert.rejects(create({ afterCreate: async () => { throw Error('swipe update failed'); } }), /swipe update failed/);
  assert.equal(rows.length, 1, 'failed related write rolls back article and job');
  assert.equal(jobs.length, 1);

  const outcomes = await Promise.allSettled([create(), create(), create()]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 2);
  assert.equal(outcomes.filter(x => x.status === 'rejected' && x.reason instanceof SeoArticleQuotaError && x.reason.limit === 3).length, 1);
  assert.equal(rows.length, 3, 'concurrent requests cannot exceed monthly allowance');
  assert.equal(jobs.length, 3);
  rows.pop();
  assert.equal(await getSeoArticleMonthlyUsage({ seoArticle: {
    count: async () => rows.length,
  }, systemSetting: { findUnique: async ({ where }) => ({ value: usage.get(where.key) }) } }, 'u1'), 3);
  const batchNow = new Date('2026-09-20T00:00:00Z');
  const batch = await getSeoArticleMonthlyUsageForUsers({
    seoArticle: { groupBy: async ({ where }) => {
      assert.deepEqual(Array.from(where.userId.in), ['u1', 'u2']);
      return [{ userId: 'u1', _count: { _all: 2 } }, { userId: 'u2', _count: { _all: 1 } }];
    } },
    systemSetting: { findMany: async () => [{ key: seoArticleUsageKey('u1', batchNow), value: '3' }] },
  }, ['u1', 'u2', 'u1'], batchNow);
  assert.equal(batch.get('u1'), 3, 'batch usage keeps regenerations in the ledger');
  assert.equal(batch.get('u2'), 1, 'batch usage keeps saved articles without a ledger');
  await assert.rejects(create(), SeoArticleQuotaError);
  assert.notEqual(seoArticleUsageKey('u1', new Date('2026-09-30T14:59:59Z')),
    seoArticleUsageKey('u1', new Date('2026-09-30T15:00:00Z')), 'JST month boundary resets ledger');

  await assert.rejects(create({ trialActive: true, createJob: false }), SeoArticleQuotaError);
  assert.equal(rows.length, 2);
  await assert.rejects(create(), SeoArticleQuotaError);
  console.log('PASS SEO article admission: guest blocked, monthly concurrent cap, rollback, deletion-resistant ledger, legacy trial flag cannot bypass quota');
})().catch(error => { console.error(error); process.exitCode = 1; });
