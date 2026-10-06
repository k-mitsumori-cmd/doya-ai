process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { load } = require('./load-typescript.cjs');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/banner/pricing' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const runtime = require('react/jsx-runtime');
const tick = () => new Promise(resolve => setImmediate(resolve));
const results = [], warnings = [], originalError = console.error;
console.error = (...args) => warnings.push(args.map(String).join(' '));
function component(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; },
    AbortController, Date, Set, Map, console, ...globals }, { filename: file });
  return exports;
}
const unified = load('src/lib/unified-plan.ts');
const plans = load('src/lib/plan-utils.ts');
const services = load('src/lib/services.ts', { './unified-plan': unified });
async function fixture(kind) {
  let status = 'authenticated', data = { user: { id: 'owner', email: 'owner@example.invalid', plan: 'FREE' } };
  let props = { serviceId: 'banner' }, reply = async () => Response.json({ ok: true, plan: 'PRO' }), handler, closed = false, seq = 0, callbackFails = false;
  const timers = new Map(), requests = [], navigations = [], events = [];
  const clock = { setTimeout: (fn, ms) => { assert.equal(ms, 35000); timers.set(++seq, fn); return seq; }, clearTimeout: id => timers.delete(id) };
  const helper = load('src/lib/billing-response-client.ts', {}, { AbortController, TextDecoder, Uint8Array, ...clock,
    fetch: (url, init) => { requests.push({ url, init }); return reply(url, init); } });
  const auth = { useSession: () => ({ status, data }) };
  const hook = component('src/hooks/useBillingPlanResync.ts', { react: React, 'next-auth/react': auth,
    '@/lib/billing-response-client': helper, '@/lib/plan-utils': plans });
  const jsx = { ...runtime };
  for (const method of ['jsx', 'jsxs']) jsx[method] = (type, p, ...args) => {
    if (type === 'button' && p['aria-busy'] !== undefined) handler = p.onClick;
    return runtime[method](type, p, ...args);
  };
  const inert = () => null;
  const mocks = { react: React, 'react/jsx-runtime': jsx, 'next-auth/react': auth,
    'next/link': ({ children, ...p }) => React.createElement('a', p, children),
    'next/navigation': { usePathname: () => `/${props.serviceId}/pricing` },
    '@/hooks/useBillingPlanResync': hook, '@/components/CheckoutButton': { CheckoutButton: inert },
    '@/components/TrialCallout': { TrialBadge: inert, TrialNote: inert, useTrialEligible: () => null },
    '@/lib/services': services, '@/lib/plan-utils': plans, '@/lib/unified-plan': unified,
    '@/lib/pricing': { ENTERPRISE_CONTACT_MAILTO: 'mailto:synthetic@example.invalid', BANNER_PRICING: { guestLimit: 3 },
      HIGH_USAGE_CONTACT_URL: '/banner/pricing', getBannerMonthlyLimitByUserPlan: () => 15, getGuestUsage: () => ({ count: 0, date: '' }) },
    '@/components/DashboardSidebar': inert, '@/components/BannerCancelScheduleNotice': inert,
    'lucide-react': new Proxy({}, { get: () => inert }),
    'framer-motion': { AnimatePresence: ({ children }) => children, motion: { div: ({ children }) => React.createElement('div', null, children) } },
    'react-hot-toast': { __esModule: true, default: { error: inert, success: inert, loading: inert }, Toaster: inert },
    '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: inert },
  };
  const location = { reload: () => { if (callbackFails) throw Error('synthetic private callback error'); navigations.push('reload'); } };
  const windowMock = { location, dispatchEvent: event => { if (callbackFails) throw Error('synthetic private callback error'); events.push(event); return true; } };
  const file = kind === 'pricing' ? 'src/components/UnifiedPricingPlans.tsx' : 'src/app/banner/dashboard/plan/page.tsx';
  const exports = component(file, mocks, { window: windowMock, CustomEvent: dom.window.CustomEvent,
    localStorage: dom.window.localStorage, fetch: async url => {
      assert.ok(url.startsWith('/api/banner/stats') || url.startsWith('/api/stripe/subscription/status'), 'unexpected background request ' + url);
      return Response.json(url.includes('/stats') ? { totalBanners: 0, monthlyUsage: 0, monthlyLimit: 15 } : { ok: true, cancelAtPeriodEnd: false });
    } });
  const C = kind === 'pricing' ? exports.UnifiedPricingPlans : exports.default;
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await tick(); await tick(); };
  const render = () => React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(C, props))); await flush(); });
  const button = () => container.querySelector('button[aria-busy]') || undefined;
  const direct = () => React.act(async () => { assert.equal(typeof handler, 'function'); void handler(); void handler(); await flush(); });
  const click = () => React.act(async () => { assert.ok(button()); button().click(); await flush(); });
  const expire = () => React.act(async () => { for (const fn of [...timers.values()]) fn(); await flush(); });
  const settle = fn => React.act(async () => { fn(); await flush(); });
  const close = () => React.act(async () => { if (!closed) { closed = true; root.unmount(); } await flush(); container.remove(); assert.equal(timers.size, 0); });
  await render();
  return { container, requests, navigations, events, timers, render, button, direct, click, expire, settle, close,
    auth: (s, d) => { status = s; data = d; }, props: p => { props = { ...props, ...p }; }, reply: fn => { reply = fn; }, failCallback: () => { callbackFails = true; } };
}
async function run(kind, name, fn) { const f = await fixture(kind); try { await fn(f); results.push(kind + ': ' + name); } finally { await f.close(); } }
(async () => {
  for (const kind of ['pricing', 'banner']) {
    await run(kind, 'Only confirmed paid success updates the current screen; never emits purchase', async f => {
      await f.direct(); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, '/api/stripe/sync/latest');
      assert.equal(f.navigations.length, kind === 'pricing' ? 1 : 0);
      assert.equal(f.events.filter(e => e.type === 'doya:plan-updated').length, kind === 'banner' ? 1 : 0);
      assert.equal(f.events.filter(e => e.type === 'doya:checkout-verified').length, 0);
      assert.match(f.container.textContent, /ご契約とプランの反映を確認/);
      assert.equal(f.button().disabled, kind === 'pricing');
      assert.equal(f.button().type, 'button'); assert.ok(f.container.querySelector('[role="status"]'));
    });
    await run(kind, 'Same-frame duplicate and never-settling request have a bounded unknown outcome', async f => {
      let late; f.reply(() => new Promise(resolve => { late = resolve; })); await f.direct(); assert.equal(f.requests.length, 1);
      assert.equal(f.button().disabled, true); await f.expire(); assert.equal(f.button().disabled, false);
      assert.match(f.container.textContent, /新しいお申し込みをせず/); assert.equal(f.requests[0].init.signal.aborted, true);
      await f.settle(() => late(Response.json({ ok: true, plan: 'PRO' }))); assert.equal(f.navigations.length + f.events.length, 0);
    });
    for (const body of [{}, { ok: 'true', plan: 'PRO' }, { ok: true }, { ok: true, plan: 'FREE' }, { ok: true, plan: 'NOT_PRO' }, { ok: true, plan: ['PRO'] }, { ok: true, plan: 'PRO', error: 'synthetic private diagnostic' }, { ok: true, plan: 'PRO', code: 'ERROR' }]) {
      await run(kind, 'Invalid success cannot claim reflection: ' + JSON.stringify(body), async f => {
        f.reply(async () => Response.json(body)); await f.click(); assert.equal(f.navigations.length + f.events.length, 0);
        assert.match(f.container.textContent, /反映を確認できません/); assert.ok(!f.container.textContent.includes('private')); assert.equal(f.button().disabled, false);
      });
    }
    for (const status of [401, 404, 500]) await run(kind, 'HTTP failure ' + status + ' has local recovery wording', async f => {
      f.reply(async () => Response.json({ error: 'synthetic private diagnostic' }, { status })); await f.click();
      assert.equal(f.navigations.length + f.events.length, 0); assert.ok(!f.container.textContent.includes('private'));
      assert.match(f.container.textContent, status === 401 ? /ログインし直して/ : status === 404 ? /お問い合わせ/ : /新しいお申し込みをせず/);
    });
    await run(kind, 'Actor change aborts and ignores old success', async f => {
      let late; f.reply(() => new Promise(resolve => { late = resolve; })); await f.click();
      f.auth('authenticated', { user: { id: 'other', email: 'other@example.invalid', plan: 'FREE' } }); await f.render();
      assert.equal(f.requests[0].init.signal.aborted, true); await f.settle(() => late(Response.json({ ok: true, plan: 'PRO' })));
      assert.equal(f.events.length + f.navigations.length, 0); assert.equal(f.container.querySelector('[role="status"]'), null);
    });
    await run(kind, 'Transient same-user auth refresh keeps unknown recovery and never auto-retries', async f => {
      f.reply(() => new Promise(() => {})); await f.click(); f.auth('loading', null); await f.render(); assert.equal(f.requests[0].init.signal.aborted, true);
      f.auth('authenticated', { user: { id: 'owner', email: 'owner@example.invalid', plan: 'FREE' } }); await f.render();
      assert.equal(f.requests.length, 1); assert.match(f.container.textContent, /新しいお申し込みをせず/); assert.equal(f.button().disabled, false);
    });
    await run(kind, 'Loading and logged-out states cannot use a retained direct handler', async f => {
      for (const status of ['loading', 'unauthenticated']) { f.auth(status, null); await f.render(); await f.direct(); }
      assert.equal(f.requests.length, 0);
    });
    await run(kind, 'Already-paid plan transition cancels obsolete manual recovery', async f => {
      let late; f.reply(() => new Promise(resolve => { late = resolve; })); await f.click();
      f.auth('authenticated', { user: { id: 'owner', email: 'owner@example.invalid', plan: 'PRO' } }); await f.render();
      assert.equal(f.requests[0].init.signal.aborted, true); await f.settle(() => late(Response.json({ ok: true, plan: 'PRO' })));
      assert.equal(f.events.length + f.navigations.length, 0); assert.equal(Boolean(f.button()), false); await f.direct(); assert.equal(f.requests.length, 1);
    });
    await run(kind, 'Verified contract stays confirmed when updating the screen throws', async f => {
      f.failCallback(); await f.click(); assert.match(f.container.textContent, /契約は確認できましたが/);
      assert.ok(!f.container.textContent.includes('private')); assert.equal(f.button().disabled, false);
    });
    await run(kind, 'Missing authenticated identity and direct stale handler cannot sync', async f => {
      f.auth('authenticated', { user: { plan: 'FREE' } }); await f.render(); await f.direct(); assert.equal(f.requests.length, 0);
    });
    await run(kind, 'Unmount discards a noncooperating late response', async f => {
      let late; f.reply(() => new Promise(resolve => { late = resolve; })); await f.click(); await f.close();
      assert.equal(f.requests[0].init.signal.aborted, true); await f.settle(() => late(Response.json({ ok: true, plan: 'PRO' })));
      assert.equal(f.events.length + f.navigations.length, 0);
    });
  }
  await run('banner', 'Current unified PRO cannot be downgraded by a stale service FREE', async f => {
    f.auth('authenticated', { user: { id: 'owner', email: 'owner@example.invalid', plan: 'PRO', bannerPlan: 'FREE' } }); await f.render();
    assert.equal(Boolean(f.button()), false); await f.direct(); assert.equal(f.requests.length, 0);
  });
  await run('pricing', 'Switching service or disabling organization billing cancels the obsolete request', async f => {
    let late; f.reply(() => new Promise(resolve => { late = resolve; })); await f.click(); f.props({ serviceId: 'hr', planSource: 'organization', canPurchase: false, currentPlan: 'FREE' }); await f.render();
    assert.equal(f.requests[0].init.signal.aborted, true); await f.settle(() => late(Response.json({ ok: true, plan: 'PRO' })));
    assert.equal(f.navigations.length, 0); assert.equal(Boolean(f.button()), false); await f.direct(); assert.equal(f.requests.length, 1);
  });
  await run('pricing', 'Unknown service changes do not violate hook ordering', async f => { f.props({ serviceId: 'synthetic_unknown' }); await f.render(); assert.equal(f.container.textContent, ''); });
  assert.equal(warnings.length, 0, JSON.stringify(warnings));
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual full shared pricing and banner plan TSX plus shared resync hook/reader and actual plan/service modules mounted in React18 StrictMode/jsdom. Decorative children, stats/status and auth/API/navigation are synthetic. No real checkout, Stripe, customer data, email or DB.' }));
})().catch(error => { console.error = originalError; console.error(error); process.exitCode = 1; }).finally(() => { console.error = originalError; dom.window.close(); });
