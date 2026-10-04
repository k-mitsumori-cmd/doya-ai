const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture({ guest = false, exhausted = false, unavailable = false, plan = 'FREE' } = {}) {
  let calls = 0;
  const QuotaError = class extends Error { constructor(limit, isGuest) { super('limit'); this.limit = limit; this.guest = isGuest; this.upgradeAvailable = !isGuest && (plan === 'FREE' || plan === 'LIGHT'); } };
  const api = load('src/app/api/seo/articles/route.ts', {
    '@/lib/admin-guard': { requireAdmin: async () => null },
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } } },
    '@/lib/seo-article-list': {},
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => guest ? null : { user: { id: 'u1', plan } } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {} },
    '@seo/lib/types': { SeoCreateArticleInputSchema: { parse: body => ({ ...body, title: 'test', keywords: [], targetChars: 5000, tone: '丁寧', forbidden: [] }) } },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@/lib/seoAccess': {
      normalizeSeoPlan: () => guest ? 'GUEST' : plan, isTrialActive: () => ({ active: false }),
      getGuestIdFromRequest: () => null, ensureGuestId: () => 'g1', setGuestCookie: () => {},
    },
    '@/lib/seo-article-admission': {
      SeoArticleQuotaError: QuotaError,
      createSeoArticleWithinLimit: async args => {
        calls++;
        assert.equal(args.userId, guest ? null : 'u1');
        if (guest || exhausted) throw new QuotaError(guest ? 0 : 3, guest);
        if (unavailable) throw Error('PRIVATE_DATABASE_SECRET');
        return { article: { id: 'a1' }, job: args.createJob ? { id: 'j1' } : null };
      },
    },
    '@/lib/pricing': { getSeoCharLimitByUserPlan: () => 10000, SUPPORT_CONTACT_URL: 'https://example.com/contact' },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
  });
  return { api, get calls() { return calls; } };
}

(async () => {
  const req = { json: async () => ({ title: 'test' }) };
  for (const [options, expected] of [[{ guest: true }, 429], [{ exhausted: true }, 429], [{ unavailable: true }, 503], [{}, 200]]) {
    const f = fixture(options);
    const res = await f.api.POST(req);
    const body = await res.json();
    assert.equal(res.status, expected);
    assert.equal(f.calls, 1);
    if (expected === 200) assert.equal(body.jobId, 'j1');
    if (expected === 503) assert.equal(JSON.stringify(body).includes('PRIVATE_DATABASE_SECRET'), false);
  }
  for (const plan of ['FREE', 'LIGHT', 'PRO', 'ENTERPRISE']) {
    const res = await fixture({ exhausted: true, plan }).api.POST(req);
    const body = await res.json();
    if (plan === 'FREE' || plan === 'LIGHT') {
      assert.equal(body.upgradeUrl, '/seo/pricing');
      assert.equal(body.contactUrl, undefined);
    } else {
      assert.equal(body.contactUrl, 'https://example.com/contact');
      assert.equal(body.upgradeUrl, undefined);
      assert.equal(body.error.includes('アップグレード'), false);
    }
  }
  const action = load('src/lib/seo-limit-action.ts');
  assert.deepEqual(JSON.parse(JSON.stringify(action.seoLimitActionFromResponse({ upgradeUrl: '/seo/pricing' }))), { href: '/seo/pricing', label: 'プランを見る' });
  assert.deepEqual(JSON.parse(JSON.stringify(action.seoLimitActionFromResponse({ contactUrl: 'https://example.com/contact' }))), { href: 'https://example.com/contact', label: 'お問い合わせ' });
  assert.equal(action.seoLimitActionFromResponse({ contactUrl: 'javascript:alert(1)' }), null);
  console.log('PASS SEO article route: shared admission, guest/monthly limit, private-safe outage response');
})().catch(error => { console.error(error); process.exitCode = 1; });
