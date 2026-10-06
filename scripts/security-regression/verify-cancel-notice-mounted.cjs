process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { JSDOM } = require('jsdom'), { load } = require('./load-typescript.cjs');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/banner' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const tick = () => new Promise(resolve => setImmediate(resolve));
const results = [], warnings = [], originalError = console.error;
console.error = (...args) => warnings.push(args.map(String).join(' '));
const valid = { ok: true, hasSubscription: true, subscriptionId: 'sub_synthetic', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: 2000000000 };
function component(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; },
    AbortController, Date, Set, Map, console, ...globals }, { filename: file });
  return exports;
}
async function fixture(name, options = {}) {
  let status = options.status || 'authenticated', data = options.data === undefined ? { user: { id: 'owner', email: 'owner@example.invalid' } } : options.data;
  let reply = options.reply || (async () => Response.json(valid)), seq = 0, closed = false, handler;
  const timers = new Map(), requests = [];
  const clock = { setTimeout: (fn, ms) => { assert.equal(ms, 35000); timers.set(++seq, fn); return seq; }, clearTimeout: id => timers.delete(id) };
  const helper = load('src/lib/billing-response-client.ts', {}, { AbortController, TextDecoder, Uint8Array, ...clock,
    fetch: (url, init) => { requests.push({ url, init }); return reply(url, init); } });
  const parser = load('src/lib/subscription-status-client.ts', { './billing-response-client': helper });
  const auth = { useSession: () => ({ status, data }) };
  const hook = component('src/hooks/useSubscriptionStatus.ts', { react: React, 'next-auth/react': auth,
    '@/lib/billing-response-client': helper, '@/lib/subscription-status-client': parser }, { window: dom.window });
  const runtime = require('react/jsx-runtime'), jsx = { ...runtime };
  for (const method of ['jsx', 'jsxs']) jsx[method] = (type, p, ...args) => {
    if (type === 'button') handler = p.onClick;
    return runtime[method](type, p, ...args);
  };
  const C = component(`src/components/${name}CancelScheduleNotice.tsx`, {
    'react/jsx-runtime': jsx, '@/hooks/useSubscriptionStatus': hook,
    'lucide-react': { AlertTriangle: () => null, CalendarClock: () => null },
  }).default;
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await tick(); await tick(); };
  let props = { className: 'synthetic-placement' };
  const render = () => React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(C, props))); await flush(); });
  const settle = fn => React.act(async () => { fn(); await flush(); });
  const expire = () => React.act(async () => { for (const fn of [...timers.values()]) fn(); await flush(); });
  const retryTwice = () => React.act(async () => { assert.equal(typeof handler, 'function'); handler(); handler(); await flush(); });
  const close = () => React.act(async () => { if (!closed) { closed = true; root.unmount(); } await flush(); assert.equal(timers.size, 0); container.remove(); });
  await render();
  return { container, requests, timers, render, settle, expire, retryTwice, close,
    auth: (s, d) => { status = s; data = d; }, reply: fn => { reply = fn; }, props: p => { props = p; } };
}
async function run(name, description, test, options) { const f = await fixture(name, options); try { await test(f); results.push(name + ': ' + description); } finally { await f.close(); } }
(async () => {
  for (const name of ['Banner', 'Seo']) {
    await run(name, 'StrictMode sends one no-store bounded GET and renders the confirmed date in JST', async f => {
      assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, `/api/stripe/subscription/status?serviceId=${name.toLowerCase()}`);
      assert.equal(f.requests[0].init.method, 'GET'); assert.equal(f.requests[0].init.cache, 'no-store');
      assert.match(f.container.textContent, /2033\/05\/18 12:33/); assert.match(f.container.textContent, /現在のプラン/);
      assert.ok(!f.container.textContent.includes('PRO/Enterprise')); assert.ok(f.container.querySelector('.synthetic-placement'));
    });
    for (const status of ['loading', 'unauthenticated']) await run(name, 'No lookup or inherited notice during ' + status, async f => {
      assert.equal(f.requests.length, 0); assert.equal(f.container.textContent, '');
    }, { status, data: { user: { id: 'owner', email: 'owner@example.invalid' } } });
    await run(name, 'Missing identity cannot read a contract', async f => { assert.equal(f.requests.length, 0); assert.equal(f.container.textContent, ''); }, { data: { user: {} } });
    for (const body of [{ ok: true, hasSubscription: false }, { ...valid, cancelAtPeriodEnd: false }]) await run(name, 'Confirmed non-cancellation remains silent', async f => {
      assert.equal(f.container.textContent, ''); assert.equal(f.requests.length, 1);
    }, { reply: async () => Response.json(body) });
    for (const change of [{ ok: 'true' }, { ok: false }, { hasSubscription: 'true' }, { subscriptionId: undefined },
      { cancelAtPeriodEnd: 'false' }, { currentPeriodEnd: '2000000000' }, { currentPeriodEnd: Number.MAX_SAFE_INTEGER }, { status: 'canceled' }, { error: 'private diagnostic' }]) {
      await run(name, 'Malformed success never confirms a date: ' + JSON.stringify(change), async f => {
        assert.ok(!f.container.textContent.includes('2033')); assert.ok(!f.container.textContent.includes('private'));
        assert.match(f.container.textContent, /確認できませんでした/); assert.ok(f.container.querySelector('[role="status"]'));
        assert.equal(f.container.querySelector('button').type, 'button');
      }, { reply: async () => Response.json({ ...valid, ...change }) });
    }
    let deadlineLate;
    await run(name, 'Deadline exposes unknown status and bounded retry; late reply ignored', async f => {
      assert.match(f.container.textContent, /確認しています/); await f.expire(); assert.match(f.container.textContent, /確認できません/);
      assert.equal(f.requests[0].init.signal.aborted, true);
      await f.settle(() => deadlineLate(Response.json(valid))); assert.match(f.container.textContent, /確認できません/); assert.ok(!f.container.textContent.includes('2033'));
      f.reply(async () => Response.json({ ok: true, hasSubscription: false }));
      await f.retryTwice(); assert.equal(f.requests.length, 2); assert.equal(f.container.textContent, '');
    }, { reply: () => new Promise(resolve => { deadlineLate = resolve; }) });
    await run(name, 'Multiple subscriptions has a local recovery message without a fabricated stop date', async f => {
      assert.match(f.container.textContent, /複数の契約/); assert.ok(!f.container.textContent.includes('private')); assert.ok(!f.container.textContent.includes('2033'));
    }, { reply: async () => Response.json({ code: 'MULTIPLE_SUBSCRIPTIONS', error: 'private diagnostic' }, { status: 409 }) });
    await run(name, 'Wrong status cannot activate the multiple-contract branch', async f => {
      assert.ok(!f.container.textContent.includes('複数の契約')); assert.ok(!f.container.textContent.includes('private'));
    }, { reply: async () => Response.json({ code: 'MULTIPLE_SUBSCRIPTIONS', error: 'private diagnostic' }, { status: 500 }) });
    await run(name, 'Current actor never sees the previous actor date and triggers its own read', async f => {
      let next; f.reply(() => new Promise(resolve => { next = resolve; }));
      f.auth('authenticated', { user: { id: 'other', email: 'other@example.invalid' } }); await f.render();
      assert.equal(f.requests.length, 2); assert.ok(!f.container.textContent.includes('2033'));
      await f.settle(() => next(Response.json({ ok: true, hasSubscription: false }))); assert.equal(f.container.textContent, '');
    });
    let actorLate;
    await run(name, 'Noncooperating old response cannot overwrite the new actor status', async f => {
      f.reply(async () => Response.json({ ok: true, hasSubscription: false }));
      f.auth('authenticated', { user: { id: 'other', email: 'other@example.invalid' } }); await f.render();
      assert.equal(f.requests[0].init.signal.aborted, true); assert.equal(f.container.textContent, '');
      await f.settle(() => actorLate(Response.json(valid))); assert.equal(f.container.textContent, '');
    }, { reply: () => new Promise(resolve => { actorLate = resolve; }) });
    await run(name, 'Logout and auth recheck hide the old date before a fresh lookup', async f => {
      f.auth('loading', { user: { id: 'owner', email: 'owner@example.invalid' } }); await f.render(); assert.equal(f.container.textContent, '');
      f.auth('unauthenticated', null); await f.render(); assert.equal(f.container.textContent, '');
      f.reply(() => new Promise(() => {})); f.auth('authenticated', { user: { id: 'owner', email: 'owner@example.invalid' } }); await f.render();
      assert.ok(!f.container.textContent.includes('2033')); assert.equal(f.requests.length, 2);
    });
    await run(name, 'Same email with a changed user id is a new actor', async f => {
      f.reply(async () => Response.json({ ok: true, hasSubscription: false })); f.auth('authenticated', { user: { id: 'other', email: 'owner@example.invalid' } }); await f.render();
      assert.equal(f.requests.length, 2); assert.equal(f.container.textContent, '');
    });
    await run(name, 'Unrelated placement rerender does not refetch', async f => { f.props({ className: 'other-placement' }); await f.render(); assert.equal(f.requests.length, 1); });
    await run(name, 'Unmount aborts pending work', async f => { await f.close(); assert.equal(f.requests[0].init.signal.aborted, true); }, { reply: () => new Promise(() => {}) });
  }
  assert.equal(warnings.length, 0, JSON.stringify(warnings));
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual full Banner/SeoCancelScheduleNotice TSX, status hook, bounded reader and parser mounted in React18 StrictMode/jsdom with synthetic session/API/clock and decorative icon mocks only. No actual Stripe, network, customer data, DB or billing mutation.' }));
})().catch(error => { console.error = originalError; console.error(error); process.exitCode = 1; }).finally(() => { console.error = originalError; dom.window.close(); });
