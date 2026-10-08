const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const actualOperation = load('src/lib/seo-article-admission.ts', { 'node:crypto': require('node:crypto'), '@/lib/prisma': { prisma: {} }, '@/lib/seoAccess': {} });
const cases = [];
function fixture({ guest = false, exhausted = false, unavailable = false, plan = 'FREE', replayed = false, conflict = false } = {}) {
  let calls = 0, usageCalls = 0; const inputs = [];
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
      SeoArticleOperationError: actualOperation.SeoArticleOperationError,
      seoArticleOperationId: actualOperation.seoArticleOperationId,
      createSeoArticleWithinLimit: async args => {
        calls++; inputs.push(args);
        if (conflict) throw new actualOperation.SeoArticleOperationError(409, '同じ作成操作の入力が変わっています。');
        assert.equal(args.userId, guest ? null : 'u1');
        if (guest || exhausted) throw new QuotaError(guest ? 0 : 3, guest);
        if (unavailable) throw Error('PRIVATE_DATABASE_SECRET');
        return { article: { id: 'a1' }, job: args.createJob ? { id: 'j1' } : null, replayed };
      },
    },
    '@/lib/pricing': { getSeoCharLimitByUserPlan: () => 10000, SUPPORT_CONTACT_URL: 'https://example.com/contact' },
    '@/lib/service-usage': { recordServiceUsage: async () => { usageCalls++; } },
  });
  return { api, inputs, get calls() { return calls; }, get usageCalls() { return usageCalls; } };
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
  cases.push({ name: 'All original legacy guest/monthly/plan-action/outage assertions retained', passed: true });
  const operationId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  for (const bad of [null, {}, '', operationId + 'x']) {
    const f = fixture(), r = await f.api.POST({ json: async () => ({ operationId: bad }) });
    assert.equal(r.status, 400); assert.equal(f.calls, 0); assert.equal(f.usageCalls, 0);
    cases.push({ name: 'Invalid explicit operation rejected before admission: ' + JSON.stringify(bad), passed: true });
  }
  for (const replayed of [false, true]) {
    const f = fixture({ replayed }), r = await f.api.POST({ json: async () => ({ operationId }) });
    assert.equal(r.status, 200); assert.equal(f.inputs[0].operationId, operationId.toLowerCase());
    assert.equal(f.usageCalls, replayed ? 0 : 1);
    cases.push({ name: replayed ? 'Replay skips duplicate usage tracking' : 'New operation propagates normalized ID and tracks once', passed: true });
  }
  { const f = fixture({ conflict: true }), r = await f.api.POST({ json: async () => ({ operationId }) });
    assert.equal(r.status, 409); assert.equal(f.usageCalls, 0); assert.equal(r.headers.get('cache-control'), 'private, no-store');
    cases.push({ name: 'Receipt conflict is explicit409 with private response', passed: true }); }
  { const f = fixture(), r = await f.api.POST({ json: async () => ({ operationId, createJob: false }) });
    assert.equal(r.status, 200); assert.equal((await r.json()).jobId, null); assert.equal(f.inputs[0].createJob, false);
    cases.push({ name: 'Draft operation retains null job contract', passed: true }); }
  { const f = fixture(), r = await f.api.POST({ json: async () => ({}) });
    assert.equal(r.status, 200); assert.equal(f.inputs[0].operationId, undefined); assert.equal(f.usageCalls, 1);
    cases.push({ name: 'Legacy omitted operation remains supported', passed: true }); }
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const files = ['src/app/api/seo/articles/route.ts', 'src/lib/seo-article-admission.ts'];
  const report = { checkedAt: new Date().toISOString(), expected: 10, passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,f)) ? path.join(process.env.DOYA_TEST_BASELINE,f) : f)).digest('hex')])), scope: 'Actual selected POST route and actual operation ID parser; original legacy assertions retained; synthetic admission/session/usage only. Atomic actual PostgreSQL tested separately. No browser/provider/production writes.' };
  assert.equal(report.passed, report.expected);
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/seo-creation-post-route-integrated.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
