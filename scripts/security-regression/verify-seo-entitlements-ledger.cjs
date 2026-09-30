const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const pricing = load('src/lib/pricing.ts', { './unified-plan': {
  UNIFIED_PRO_PRICE: 9980, UNIFIED_PRO_PRICE_LABEL: '¥9,980', isPaidPlan: () => false,
} });
const seoAccess = load('src/lib/seoAccess.ts', { 'next/server': {}, '@/lib/pricing': pricing });

function fixture({ unavailable = false } = {}) {
  const api = load('src/app/api/seo/entitlements/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u1', plan: 'FREE', firstLoginAt: new Date().toISOString() } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {} },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@/lib/seoAccess': {
      SEO_GUEST_COOKIE: 'guest', normalizeSeoPlan: () => 'FREE', isTrialActive: seoAccess.isTrialActive,
      getGuestIdFromRequest: () => null, seoMonthlyArticleLimit: () => 3, seoGuestTotalArticleLimit: () => 0,
      canUseSeoImages: () => false,
    },
    '@/lib/seo-article-admission': {
      getSeoArticleMonthlyUsage: async () => { if (unavailable) throw Error('PRIVATE_DATABASE_SECRET'); return 3; },
    },
  });
  return api;
}

(async () => {
  let response = await fixture().GET({});
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.usage.articlesThisMonth, 3);
  assert.equal(body.remaining.articles, 0);

  response = await fixture({ unavailable: true }).GET({});
  assert.equal(response.status, 503);
  body = await response.json();
  assert.equal(body.success, false);
  assert.equal(JSON.stringify(body).includes('PRIVATE_DATABASE_SECRET'), false);

  response = await fixture().GET({});
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.trial.active, false);
  assert.equal(body.remaining.articles, 0);
  console.log('PASS SEO entitlements: deletion-resistant usage, explicit outage, recent login has no unlimited trial');
})().catch(error => { console.error(error); process.exitCode = 1; });
