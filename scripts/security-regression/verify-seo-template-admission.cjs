const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(file, { guest = false, trial = false, exhausted = false } = {}) {
  let admitted = 0;
  let checkedPlan = null;
  const QuotaError = class extends Error { constructor(limit, isGuest) { super('limit'); this.limit = limit; this.guest = isGuest; } };
  const api = load(file, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => guest ? null : { user: { id: 'u1', plan: 'FREE' } } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { swipeSession: { findUnique: async () => ({ userId: 'u1', swipes: [], mainKeyword: 'topic' }) } },
    '@seo/lib/types': { SeoCreateArticleInputSchema: { parse: value => value } },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@/lib/seoAccess': { normalizeSeoPlan: () => 'FREE', isTrialActive: () => ({ active: trial }) },
    '@/lib/seo-article-admission': {
      SeoArticleQuotaError: QuotaError,
      createSeoArticleWithinLimit: async args => {
        admitted++;
        assert.equal(args.userId, 'u1');
        assert.equal(args.createJob, true);
        assert.equal(args.trialActive, trial);
        if (exhausted) throw new QuotaError(3, false);
        return { article: { id: 'a1' }, job: { id: 'j1' } };
      },
    },
    '@/lib/pricing': { getSeoCharLimitByUserPlan: plan => { checkedPlan = plan; return 20000; } },
  });
  return { api, get admitted() { return admitted; }, get checkedPlan() { return checkedPlan; } };
}

(async () => {
  for (const file of ['src/app/api/seo/template/generate/route.ts', 'src/app/api/swipe/generate/route.ts']) {
    const req = { json: async () => ({ sessionId: 's1', finalConditions: { targetChars: 10000 } }) };
    let f = fixture(file, { guest: true });
    let res = await f.api.POST(req);
    assert.equal(res.status, 429);
    assert.equal(f.admitted, 0);

    f = fixture(file, { exhausted: true });
    res = await f.api.POST(req);
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /今月/);
    assert.equal(f.admitted, 1);

    f = fixture(file, { trial: true });
    res = await f.api.POST(req);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).jobId, 'j1');
    assert.equal(f.checkedPlan, 'PRO', 'trial uses PRO character allowance');
  }
  console.log('PASS SEO template and swipe routes: guest block, monthly cap, trial character allowance');
})().catch(error => { console.error(error); process.exitCode = 1; });
