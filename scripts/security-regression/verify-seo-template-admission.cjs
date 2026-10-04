const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(file, { guest = false, trial = false, exhausted = false, plan = 'FREE' } = {}) {
  let admitted = 0;
  let checkedPlan = null;
  const QuotaError = class extends Error { constructor(limit, isGuest) { super('limit'); this.limit = limit; this.guest = isGuest; this.upgradeAvailable = !isGuest && (plan === 'FREE' || plan === 'LIGHT'); } };
  const api = load(file, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => guest ? null : { user: { id: 'u1', plan } } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { swipeSession: { findUnique: async () => ({ userId: 'u1', swipes: [], mainKeyword: 'topic' }) } },
    '@seo/lib/types': { SeoCreateArticleInputSchema: { parse: value => value } },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@/lib/seoAccess': { normalizeSeoPlan: () => plan, isTrialActive: () => ({ active: trial }) },
    '@/lib/seo-article-admission': {
      SeoArticleQuotaError: QuotaError,
      createSeoArticleWithinLimit: async args => {
        admitted++;
        assert.equal(args.userId, 'u1');
        assert.equal(args.plan, plan);
        assert.equal(args.createJob, true);
        assert.equal(Object.hasOwn(args, 'trialActive'), false, 'trial state cannot bypass article admission');
        if (exhausted) throw new QuotaError(3, false);
        return { article: { id: 'a1' }, job: { id: 'j1' } };
      },
    },
    '@/lib/pricing': { getSeoCharLimitByUserPlan: plan => { checkedPlan = plan; return 20000; }, SUPPORT_CONTACT_URL: 'https://example.com/contact' },
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
    const freeBody = await res.json();
    assert.match(freeBody.error, /今月/);
    assert.equal(freeBody.upgradeUrl, '/seo/pricing');
    assert.equal(f.admitted, 1);

    f = fixture(file, { exhausted: true, plan: 'PRO' });
    res = await f.api.POST(req);
    assert.equal(res.status, 429);
    const proBody = await res.json();
    assert.equal(proBody.contactUrl, 'https://example.com/contact');
    assert.equal(proBody.upgradeUrl, undefined);
    assert.equal(proBody.error.includes('アップグレード'), false);

    f = fixture(file, { trial: true });
    res = await f.api.POST(req);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).jobId, 'j1');
    assert.equal(f.checkedPlan, 'PRO', 'trial uses PRO character allowance');
  }
  console.log('PASS SEO template and swipe routes: guest block, monthly cap, legacy trial flag excluded from admission');
})().catch(error => { console.error(error); process.exitCode = 1; });
