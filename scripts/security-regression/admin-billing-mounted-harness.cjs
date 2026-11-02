process.env.NODE_ENV = 'development';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..'), dep = name => require(path.join(repo, 'node_modules', name));
const React = dep('react'), ts = dep('typescript'), { JSDOM } = dep('jsdom');
const sources = ['src/app/admin/billing/page.tsx', 'src/app/admin/page.tsx', 'src/lib/use-admin-billing.ts', 'src/lib/admin-billing-contract.ts', 'src/lib/admin-billing-period.ts', 'src/lib/admin-billing-csv.ts', 'src/lib/jst.ts'];
async function scenario(strict, kind) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://synthetic.invalid/admin/billing' }), prior = new Map(), requests = [], navigation = [], timers = new Map(), downloads = [], blobs = new Map(), revoked = [];
  let root, timerId = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior.set(key, Object.getOwnPropertyDescriptor(global, key)); Object.defineProperty(global, key, { value, writable: true, configurable: true });
  }
  try {
    const router = { push: url => navigation.push(url) }, modules = new Map(), motions = new Map();
    const motion = new Proxy({}, { get: (_, tag) => { if (!motions.has(tag)) motions.set(tag, ({ children, variants, initial, animate, transition, exit, whileHover, whileTap, ...rest }) => React.createElement(tag, rest, children)); return motions.get(tag) } });
    const timer = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id };
    class SafeURL extends URL {}
    SafeURL.createObjectURL = blob => { if (kind === 'csv-failure') throw Error('PRIVATE_DOWNLOAD_ERROR'); const url = 'blob:synthetic-' + blobs.size; blobs.set(url, blob); return url };
    SafeURL.revokeObjectURL = url => revoked.push(url);
    dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, download: this.download }) };
    const fakeFetch = (url, options) => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); requests.push({ url, options, resolve, reject }); return promise };
    function load(filename) {
      filename = path.normalize(filename); if (modules.has(filename)) return modules.get(filename);
      assert(sources.includes(filename), 'unexpected real source: ' + filename);
      const exports = {}; modules.set(filename, exports);
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo, filename), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
        exports, require: name => {
          if (['react', 'react/jsx-runtime'].includes(name)) return dep(name);
          if (name === 'lucide-react') return dep(name);
          if (name === 'next/link') return { __esModule: true, default: ({ children, ...rest }) => React.createElement('a', rest, children) };
          if (name === 'react-hot-toast') return { __esModule: true, default: { success() {}, error() {} }, Toaster: () => null };
          if (name === 'framer-motion') return { motion };
          if (name === 'next/navigation') return { useRouter: () => router };
          if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
          if (name.startsWith('./')) return load(path.join(path.dirname(filename), name + '.ts'));
          throw Error('Unexpected module ' + name);
        }, console, Date, Promise, AbortController, Blob, URL: SafeURL, document: dom.window.document,
        fetch: fakeFetch, setTimeout: timer, clearTimeout: id => timers.delete(id),
      }, { filename }); return exports;
    }
    const { adminBillingPeriodRange } = load('src/lib/admin-billing-period.ts');
    const fixture = (period = 'month', extra = {}) => {
      const range = adminBillingPeriodRange(period, new Date('2026-11-15T00:00:00.000Z')), amount = { month: 100, quarter: 200, year: 300 }[period];
      return { version: 1, currency: 'jpy', timeZone: 'Asia/Tokyo', period, label: range.label, since: range.since.toISOString(), until: range.until.toISOString(), updatedAt: '2026-11-15T00:00:00.000Z', paidInvoiceCount: 1, paidTotal: amount, refundTotal: 20, pendingRefundCount: 0, pendingRefundTotal: 0, netRevenue: amount - 20, mrr: 1000, activeSubscriptions: 2, mrrSubscriptions: 2, activeCustomers: 1, arpu: 1000, trialingSubscriptions: 1, discountPolicy: { subtractRecurringDiscounts: true, subtractOneTimeDiscounts: false }, ...extra };
    };
    const dashboard = kind.startsWith('dashboard-');
    const Page = load(dashboard ? 'src/app/admin/page.tsx' : 'src/app/admin/billing/page.tsx').default;
    root = dep('react-dom/client').createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(strict ? React.StrictMode : React.Fragment, {}, React.createElement(Page))));
    assert.equal(requests.length, (strict ? 2 : 1) * (dashboard ? 2 : 1)); if (!dashboard) assert(document.querySelector('[role="status"][aria-label="売上・課金データを読み込み中"]'));
    const flush = async fn => React.act(async () => { fn?.(); for (let i = 0; i < 12; i++) await Promise.resolve() });
    const reply = async (rows = [...requests], status = 200, data) => flush(() => rows.forEach(row => row.resolve(new Response(JSON.stringify(data ?? fixture(new URL(row.url, 'https://synthetic.invalid').searchParams.get('period'))), { status }))));
    const button = name => { const value = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === name); assert(value, name); return value };
    const click = name => flush(() => button(name).click());
    const choose = period => flush(() => { const s = document.querySelector('select'); s.value = period; s.dispatchEvent(new dom.window.Event('change', { bubbles: true })) });
    const alert = () => document.querySelector('[role="alert"]');
    const body = () => document.body.textContent;
    const error = () => { assert(alert()); assert(!body().includes('PRIVATE_')); assert(!document.querySelector('[role="status"]')); assert(button('再取得する')); assert(!body().includes('返金控除後の入金')) };
    const fireDeadline = () => flush(() => { const active = [...timers].filter(([, x]) => x.ms === 30000); assert.equal(active.length, 1); const [id, t] = active[0]; timers.delete(id); t.fn() });
    const initial = [...requests];
    if (dashboard) {
      const db = initial.filter(x => x.url === '/api/admin/stats'), financial = initial.filter(x => x.url.startsWith('/api/admin/billing/stats?'));
      assert.equal(db.length, strict ? 2 : 1); assert.equal(financial.length, db.length);
      const stats = { totalUsers: 9, premiumUsers: 2, enterpriseUsers: 3, freeUsers: 7, totalGenerations: 45, todayGenerations: 4, monthGenerations: 10, lastMonthGenerations: 10, generationGrowth: 0, avgGenerationsPerUser: 5, monthlyRevenue: 99999999, mrr: 99999999, conversionRate: 22.2, services: [{ id: 'banner', name: '合成サービス', icon: '', gradient: '', users: 5, proUsers: 1, generations: 8, todayGenerations: 2, revenue: null, growth: 0 }], chartData: Array(12).fill(2), recentUsers: 1, recentGenerations: [], adminLoginAttempts: 0, lastUpdated: '2026-11-15T00:00:00.000Z' };
      if (kind === 'dashboard-counts-error') {
        await flush(() => db.forEach(x => x.reject(Error('Synthetic counts failure')))); await reply(financial);
        assert(body().includes('MRR（税抜の月額換算）：¥1,000')); assert(body().includes('返金控除後入金：¥80'));
      } else {
        await reply(db, 200, stats); assert(body().includes('ダッシュボード')); assert(body().includes('合成サービス')); assert(body().includes('未按分'));
        if (kind === 'dashboard-finance-error') { await reply(financial, 503); assert(alert().textContent.includes('売上・課金データ')); assert(body().includes('取得失敗')); assert(!body().includes('¥0')) }
        else {
          await reply(financial); assert(body().includes('返金控除後入金：¥80')); assert(body().includes('MRR（税抜の月額換算）：¥1,000'));
          if (kind === 'dashboard-refresh-error') {
            const count = requests.length; await click('入金・契約指標を再取得'); assert.equal(requests.length, count + 1); assert(requests.at(-1).url.endsWith('refresh=1')); await reply([requests.at(-1)], 503); assert(alert().textContent.includes('前回取得したデータ')); assert(body().includes('¥80')); assert(body().includes('合成サービス')); await click('入金・契約指標を再取得'); await reply([requests.at(-1)]); assert(!alert());
          }
        }
      }
      assert(!body().includes('99,999,999')); assert(!body().includes('9999.9万')); assert(!body().includes('月間売上'));
    } else if (['http502', 'http503', 'network'].includes(kind)) {
      if (kind === 'network') await flush(() => initial.forEach(x => x.reject(Error('PRIVATE_NETWORK_ERROR')))); else await reply(initial, kind === 'http502' ? 502 : 503);
      error(); await click('再取得する'); assert(document.querySelector('[role="status"]')); assert(requests.at(-1).url.endsWith('period=month&refresh=1')); await reply([requests.at(-1)]); assert(body().includes('返金控除後の入金')); assert(!alert());
    } else if (kind === 'unauthorized') {
      await reply(initial, 401); assert.deepEqual(navigation, ['/admin/login']); error();
    } else if (kind === 'zero-success') {
      await reply(initial, 200, fixture('month', { paidInvoiceCount: 0, paidTotal: 0, refundTotal: 0, netRevenue: 0, mrr: 0, activeSubscriptions: 0, mrrSubscriptions: 0, activeCustomers: 0, arpu: 0, trialingSubscriptions: 0 })); assert(body().includes('¥0')); assert(!alert()); assert(!document.querySelector('[role="status"]'));
    } else if (kind === 'refresh-failure') {
      await reply(initial); await click('更新'); assert(button('更新').disabled); await reply([requests.at(-1)], 503); assert(alert().textContent.includes('前回取得したデータ')); assert(body().includes('¥80')); assert(button('CSV出力').disabled); await click('更新'); assert(!alert()); await reply([requests.at(-1)]); assert(!alert()); assert(!button('CSV出力').disabled);
    } else if (['quarter', 'year'].includes(kind)) {
      await reply(initial); await choose(kind); assert(!body().includes('¥80')); assert(document.querySelector('[role="status"]')); assert(requests.at(-1).url.endsWith('period=' + kind)); await reply([requests.at(-1)]); assert(body().includes(kind === 'quarter' ? '2026年第4四半期' : '2026年の入金')); assert(body().includes(kind === 'quarter' ? '¥180' : '¥280')); assert(body().includes('¥1,000'));
    } else if (kind.startsWith('switch-late-')) {
      await choose('quarter'); const quarter = requests.at(-1); await choose('year'); await reply([requests.at(-1)]);
      if (kind === 'switch-late-error') await flush(() => quarter.reject(Error('PRIVATE_STALE_ERROR'))); else await reply([quarter], kind === 'switch-late-401' ? 401 : 200);
      await reply(initial); assert(body().includes('2026年の入金')); assert(body().includes('¥280')); assert(!body().includes('¥180')); assert(!alert()); assert.deepEqual(navigation, []); assert(initial.every(x => x.options.signal.aborted)); assert(quarter.options.signal.aborted);
    } else if (kind === 'period-error-clears-old') {
      await reply(initial); await choose('quarter'); await reply([requests.at(-1)], 503); error(); assert(!body().includes('¥80')); assert(!alert().textContent.includes('前回取得'));
    } else if (['wrong-period', 'invalid-math', 'null-arpu', 'negative-net'].includes(kind)) {
      const data = kind === 'wrong-period' ? fixture('year') : fixture('month', kind === 'invalid-math' ? { netRevenue: 999 } : kind === 'null-arpu' ? { activeCustomers: null, arpu: null } : { refundTotal: 200, netRevenue: -100 });
      await reply(initial, 200, data);
      if (kind === 'wrong-period' || kind === 'invalid-math') error(); else if (kind === 'null-arpu') assert.equal([...document.querySelectorAll('dd')].filter(x => x.textContent === '確認できません').length, 2); else assert(body().includes('¥-100'));
    } else if (['timeout', 'late-401-after-timeout', 'body-timeout'].includes(kind)) {
      if (kind === 'body-timeout') await flush(() => initial.forEach(x => x.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) })));
      await fireDeadline(); error(); assert(initial.every(x => x.options.signal.aborted));
      if (kind === 'late-401-after-timeout') { await reply(initial, 401); assert.deepEqual(navigation, []); error() }
      await click('再取得する'); await reply([requests.at(-1)]); assert(!alert());
    } else if (kind === 'unmount-late-401') {
      await React.act(async () => root.unmount()); root = null; await reply(initial, 401); assert.deepEqual(navigation, []); assert(initial.every(x => x.options.signal.aborted)); assert.equal(timers.size, 0);
    } else if (kind === 'refresh-401-clears-private') {
      await reply(initial); await click('更新'); await reply([requests.at(-1)], 401); assert.deepEqual(navigation, ['/admin/login']); error(); assert(!body().includes('¥80'));
    } else if (kind === 'csv-success' || kind === 'csv-failure') {
      assert(button('CSV出力').disabled); await reply(initial); await click('CSV出力');
      if (kind === 'csv-failure') { assert(alert().textContent.includes('CSVを出力できません')); assert(!body().includes('PRIVATE_')); assert.equal(downloads.length, 0) }
      else {
        assert.equal(downloads.length, 1); assert.equal(downloads[0].download, 'doya-billing-month-2026年11月.csv');
        const text = await blobs.get(downloads[0].href).text(); assert(text.includes('"返金控除後入金","80","円"')); assert(text.includes('"MRR","1000"')); assert(text.includes('"期間","2026年11月"')); assert(!text.includes('premiumUsers')); assert.equal(document.querySelectorAll('a[download]').length, 0);
        await flush(() => { for (const [id, t] of timers) if (t.ms === 1000) { timers.delete(id); t.fn() } }); assert.deepEqual(revoked, [downloads[0].href]);
      }
    } else throw Error('Unknown scenario ' + kind);
    assert(requests.every(x => (x.url.startsWith('/api/admin/billing/stats?period=') || dashboard && x.url === '/api/admin/stats') && x.options.credentials === 'include' && (x.url === '/api/admin/stats' || x.options.cache === 'no-store') && !x.options.method));
    return { kind, strict, observed: true, requests: requests.length };
  } finally {
    if (root) await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key] }
  }
}
async function run(kinds, prefix, resultEnv) {
  const cases = [];
  for (const strict of [false, true]) for (const kind of kinds) { cases.push(await scenario(strict, kind)); console.log(prefix + kind + ' ' + (strict ? 'StrictMode' : 'normal')) }
  const result = { checkedAt: new Date().toISOString(), cases, passed: cases.length, failed: 0, sourceHashes: Object.fromEntries(sources.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, name))).digest('hex')])), productionRequests: 0, stripeCalls: 0, productionWrites: 0, scope: 'Actual billing page, request hook, DTO validation, JST period and CSV modules mounted under React normal/StrictMode. Synthetic deferred HTTP/JSON and controlled request deadlines with real AbortController; no native paint/production/admin or provider acceptance.' };
  if (process.env[resultEnv]) fs.writeFileSync(process.env[resultEnv], JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ passed: cases.length, failed: 0 }));
}
module.exports = { run, scenario };
