const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const access = load('src/lib/seoAccess.ts', { 'next/server': {} });
const { createSeoArticleWithinLimit, getSeoArticleMonthlyUsage, seoArticleUsageKey, SeoArticleQuotaError } = load('src/lib/seo-article-admission.ts', {
  'node:crypto': require('node:crypto'), '@/lib/prisma': { prisma: {} }, '@/lib/seoAccess': access,
});

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
  userId: 'u1', guestId: null, plan: 'FREE', trialActive: false,
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
  await assert.rejects(create(), SeoArticleQuotaError);
  assert.notEqual(seoArticleUsageKey('u1', new Date('2026-09-30T14:59:59Z')),
    seoArticleUsageKey('u1', new Date('2026-09-30T15:00:00Z')), 'JST month boundary resets ledger');

  const trial = await create({ trialActive: true, createJob: false });
  assert.equal(trial.job, null);
  assert.equal(rows.length, 3);
  await assert.rejects(create(), SeoArticleQuotaError);
  console.log('PASS SEO article admission: guest blocked, monthly concurrent cap, rollback, deletion-resistant ledger, trial bypass');
})().catch(error => { console.error(error); process.exitCode = 1; });
