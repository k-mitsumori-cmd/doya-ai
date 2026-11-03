process.env.NODE_ENV = 'development';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..'), dep = name => require(path.join(repo, 'node_modules', name));
const ts = dep('typescript'), React = dep('react'), { JSDOM } = dep('jsdom'), cases = [];
function compile(file, imports = {}, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, require: name => { assert(name in imports, 'Unexpected import ' + name); return imports[name]; }, Date, URL, Headers, console, ...extra }, { filename: file });
  return exports;
}
const periods = compile('src/lib/admin-analytics-period.ts');
const contract = compile('src/lib/admin-analytics-period-contract.ts', { './admin-analytics-period': periods });
const csv = compile('src/lib/admin-analytics-export.ts');
function fixture(period = 'week', n = 3) {
  const range = periods.adminAnalyticsPeriodRange(period, new Date('2026-11-03T03:00:00.000Z'));
  const metric = (id, value, unit = '件') => ({ id, serviceName: 'Synthetic', label: id, unit, value, previousValue: 0 });
  return { ...range, updatedAt: range.until, metrics: [metric('records', n), metric('registrations', 1, '人'), metric('recorded-users', n ? 1 : 0, '人'), metric('records:banner', n), metric('records:other', 0)], chart: { metricId: 'records', buckets: range.buckets.map((bucket, i) => ({ ...bucket, value: i === 0 ? n : 0 })) } };
}
function pass(name) { cases.push(name); console.log('PASS Admin analytics period: ' + name); }
async function pure() {
  const prior = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Tokyo', 'America/New_York', 'Asia/Kathmandu']) {
      process.env.TZ = zone;
      for (const [period, at, since, length] of [
        ['week', '2026-11-03T03:00:00.000Z', '2026-10-27T03:00:00.000Z', 8],
        ['month', '2026-11-03T03:00:00.000Z', '2026-10-04T03:00:00.000Z', 31],
        ['week', '2026-11-02T15:00:00.000Z', '2026-10-26T15:00:00.000Z', 7],
        ['year', '2024-02-29T03:00:00.000Z', '2023-02-28T03:00:00.000Z', 13],
        ['year', '2025-03-01T03:00:00.000Z', '2024-03-01T03:00:00.000Z', 13],
        ['year', '2025-02-28T15:00:00.000Z', '2024-02-29T15:00:00.000Z', 12],
        ['week', '2026-03-08T07:30:00.000Z', '2026-03-01T07:30:00.000Z', 8],
      ]) {
        const input = new Date(at), range = periods.adminAnalyticsPeriodRange(period, input);
        assert.equal(input.toISOString(), at); assert.equal(range.since, since); assert.equal(range.until, at); assert.equal(range.buckets.length, length);
        assert.equal(Date.parse(range.previousUntil) - Date.parse(range.previousSince), Date.parse(at) - Date.parse(since));
        assert.equal(range.buckets[0].since, since); assert.equal(range.buckets.at(-1).until, at);
        range.buckets.forEach((b, i) => { assert(Date.parse(b.since) < Date.parse(b.until)); if (i) assert.equal(b.since, range.buckets[i - 1].until); });
        for (const [instant, n] of [[Date.parse(since) - 1, 0], [Date.parse(since), 1], [Date.parse(at) - 1, 1], [Date.parse(at), 0]]) assert.equal(range.buckets.filter(b => instant >= Date.parse(b.since) && instant < Date.parse(b.until)).length, n);
        pass('calendar ' + zone + ' ' + period + ' ' + at);
      }
    }
  } finally { if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior; }
  assert.equal(periods.parseAdminAnalyticsPeriod(null), 'week');
  for (const bad of ['', 'quarter', 'WEEK', 'week,month', 'week ', 'constructor', 'all']) assert.throws(() => periods.parseAdminAnalyticsPeriod(bad));
  pass('period input rejects unsupported values');
  for (const period of ['week', 'month', 'year']) assert(contract.isAdminAnalyticsPeriodData(fixture(period), period));
  const mutations = {
    'wrong selected period': d => d.period = 'month', 'wrong zone': d => d.timeZone = 'UTC', 'changed start': d => d.since = d.until,
    'bad clock': d => d.updatedAt = 'invalid', 'wrong previous range': d => d.previousSince = d.since,
    'negative count': d => d.metrics[0].value = -1, 'fraction': d => d.metrics[0].value = .5, 'string count': d => d.metrics[0].value = '3',
    'overflow': d => d.metrics[0].value = Number.MAX_SAFE_INTEGER + 1, 'missing metric': d => d.metrics.splice(1, 1),
    'duplicate metric': d => d.metrics.push(d.metrics[0]), 'wrong units': d => d.metrics[2].unit = '件',
    'too many actors': d => d.metrics[2].value = 4, 'service total mismatch': d => d.metrics[3].value = 2,
    'previous mismatch': d => d.metrics[3].previousValue = 2, 'unknown chart metric': d => d.chart.metricId = 'unknown',
    'chart total mismatch': d => d.chart.buckets[0].value = 2, 'chart missing bucket': d => d.chart.buckets.pop(),
    'chart wrong boundary': d => d.chart.buckets[0].until = d.until, 'chart wrong label': d => d.chart.buckets[0].label = 'bad',
    'chart wrong partial': d => d.chart.buckets[0].partial = !d.chart.buckets[0].partial,
  };
  for (const [name, mutate] of Object.entries(mutations)) { const data = fixture(); mutate(data); assert.equal(contract.isAdminAnalyticsPeriodData(data, 'week'), false, name); pass('contract ' + name); }
  const data = fixture(); data.metrics[3].serviceName = '=SYNTHETIC,"quoted"\nnext';
  const output = csv.adminAnalyticsPeriodCsv(data); assert(output.startsWith('\uFEFF')); assert(output.includes('"\'=SYNTHETIC,""quoted""\nnext / records:banner"')); assert(output.endsWith('\r\n'));
  pass('CSV BOM quoting newline formula protection');
}
async function routes() {
  const helper = compile('src/lib/private-api-response.ts', { 'next/server': dep('next/server') });
  for (const [name, valid, query, status, fail] of [
    ['unauthorized', false, '', 401], ['default', true, '', 200], ['week', true, '?period=week', 200], ['month', true, '?period=month', 200], ['year', true, '?period=year', 200],
    ['invalid', true, '?period=quarter', 400], ['duplicate', true, '?period=week&period=month', 400], ['empty', true, '?period=', 400], ['reader failure', true, '?period=week', 503, true],
  ]) {
    const reads = [];
    const api = compile('src/app/api/admin/analytics/route.ts', {
      'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-token' }) }) },
      '@/lib/admin-auth': { COOKIE_NAME: 'synthetic', verifyAdminSession: async () => ({ valid }) },
      '@/lib/private-api-response': helper, '@/lib/admin-analytics-period': periods,
      '@/lib/admin-analytics-period-reader': { readAdminAnalyticsPeriod: async p => { reads.push(p); if (fail) throw new Error('PRIVATE_DB_DETAIL'); return fixture(p); } },
    });
    const result = await api.GET(new Request('http://synthetic.invalid/api/admin/analytics' + query));
    assert.equal(result.status, status); assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.match(result.headers.get('vary'), /Cookie/);
    const body = await result.text(); assert(!body.includes('PRIVATE_DB_DETAIL')); assert.equal(reads.length, status === 200 || fail ? 1 : 0);
    if (status === 200) assert(contract.isAdminAnalyticsPeriodData(JSON.parse(body), reads[0]));
    pass('GET ' + name);
  }
}
async function client(strict, kind) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://synthetic.invalid/admin/analytics' }), prior = new Map(), requests = [], timers = new Map(), navigation = [], downloads = [], blobs = [], revoked = [];
  let root, timerId = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) { prior.set(key, Object.getOwnPropertyDescriptor(global, key)); Object.defineProperty(global, key, { value, configurable: true, writable: true }); }
  try {
    const router = { push: url => navigation.push(url) };
    class SafeURL extends URL {}
    SafeURL.createObjectURL = blob => { if (kind === 'download-failure') throw Error('PRIVATE_DOWNLOAD_DETAIL'); blobs.push(blob); return 'blob:synthetic-' + blobs.length; };
    SafeURL.revokeObjectURL = url => revoked.push(url);
    dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
    const extra = { AbortController, Blob, URL: SafeURL, document, setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id), fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })) };
    const hook = compile('src/lib/use-admin-analytics-period.ts', { react: React, 'next/navigation': { useRouter: () => router }, './admin-analytics-period-contract': contract }, extra);
    const Component = compile('src/components/AdminAnalyticsPeriod.tsx', { react: React, 'react/jsx-runtime': dep('react/jsx-runtime'), 'lucide-react': dep('lucide-react'), '@/lib/use-admin-analytics-period': hook, '@/lib/admin-analytics-export': csv }, extra).default;
    root = dep('react-dom/client').createRoot(document.getElementById('root'));
    const flush = async fn => React.act(async () => { fn?.(); for (let i = 0; i < 12; i++) await Promise.resolve(); });
    await flush(() => root.render(React.createElement(strict ? React.StrictMode : React.Fragment, {}, React.createElement(Component))));
    const latest = () => requests.at(-1), body = () => document.body.textContent;
    const button = name => { const result = [...document.querySelectorAll('button')].find(el => el.textContent === name); assert(result, name); return result; };
    const reply = (row, data, status = 200) => flush(() => row.resolve(new Response(JSON.stringify(data), { status })));
    const success = (row = latest(), n = 3) => reply(row, fixture(new URL(row.url, 'http://synthetic.invalid').searchParams.get('period'), n));
    const choose = p => flush(() => { const select = document.querySelector('select'); select.value = p; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(requests.length, strict ? 2 : 1); assert(button('期間データをCSV保存').disabled); assert(document.querySelector('[role="status"]'));
    assert.equal(latest().options.cache, 'no-store'); assert.equal(latest().options.credentials, 'include');
    if (kind === 'failure' || kind === 'retry') {
      await reply(latest(), {}, 503); assert(document.querySelector('[role="alert"]')); assert(button('期間データをCSV保存').disabled);
      if (kind === 'retry') { await flush(() => button('期間データを再取得').click()); await success(); assert(!document.querySelector('[role="alert"]')); }
    } else if (kind === 'unauthorized') {
      await reply(latest(), {}, 401); assert.deepEqual(navigation, ['/admin/login']); assert(!body().includes('PRIVATE')); assert(button('期間データをCSV保存').disabled);
    } else if (kind === 'timeout' || kind === 'body-timeout' || kind === 'timeout-late401') {
      const row = latest();
      if (kind === 'body-timeout') await flush(() => row.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) }));
      await flush(() => [...timers.values()].find(t => t.ms === 30000).fn()); assert(row.options.signal.aborted); assert(document.querySelector('[role="alert"]'));
      if (kind === 'timeout-late401') { await reply(row, {}, 401); assert.equal(navigation.length, 0); }
    } else if (kind === 'invalid-period' || kind === 'invalid-chart') {
      const data = fixture(); if (kind === 'invalid-period') data.period = 'month'; else data.chart.buckets[0].value = 99;
      await reply(latest(), data); assert(document.querySelector('[role="alert"]')); assert(button('期間データをCSV保存').disabled);
    } else if (kind === 'unmount') {
      const row = latest(); await flush(() => root.unmount()); root = null; await reply(row, {}, 401); assert.equal(navigation.length, 0); assert.equal(timers.size, 0); assert(row.options.signal.aborted);
    } else if (kind === 'switch-order' || kind === 'stale401') {
      await success(); const old = latest(); await choose('month'); const middle = latest(); assert(!body().includes('3件')); assert(button('期間データをCSV保存').disabled);
      await choose('year'); await success(latest(), 9); await reply(middle, kind === 'stale401' ? {} : fixture('month', 99), kind === 'stale401' ? 401 : 200);
      await success(old, 77); assert(body().includes('9件')); assert(!body().includes('99件')); assert(!body().includes('77件')); assert.equal(navigation.length, 0);
    } else {
      await success(latest(), kind === 'zero' ? 0 : 3); assert(!button('期間データをCSV保存').disabled);
      if (kind === 'refresh-failure' || kind === 'refresh401') {
        await flush(() => button('期間データを更新').click()); assert(button('期間データをCSV保存').disabled);
        await reply(latest(), {}, kind === 'refresh401' ? 401 : 503);
        assert(document.querySelector('[role="alert"]'));
        if (kind === 'refresh401') { assert(!body().includes('3件')); assert(button('期間データをCSV保存').disabled); }
        else { assert(body().includes('前回取得した同じ期間')); assert(!button('期間データをCSV保存').disabled); }
      } else {
        await flush(() => button('期間データをCSV保存').click());
        if (kind === 'download-failure') { assert(document.querySelector('[role="alert"]')); assert.equal(downloads.length, 0); }
        else { assert.equal(downloads.length, 1); assert.match(downloads[0], /^doya-analytics-week-/); assert.equal(revoked.length, 1); assert.deepEqual(Buffer.from(await blobs[0].arrayBuffer()), Buffer.from(csv.adminAnalyticsPeriodCsv(fixture('week', kind === 'zero' ? 0 : 3)))); }
      }
    }
    pass('client ' + kind + ' ' + (strict ? 'StrictMode' : 'normal'));
  } finally {
    if (root) await React.act(async () => root.unmount());
    assert.equal(timers.size, 0); dom.window.close();
    for (const [key, value] of prior) { if (value) Object.defineProperty(global, key, value); else delete global[key]; }
  }
}
(async () => {
  await pure(); await routes();
  for (const strict of [false, true]) for (const kind of ['success', 'zero', 'failure', 'retry', 'unauthorized', 'timeout', 'body-timeout', 'timeout-late401', 'invalid-period', 'invalid-chart', 'unmount', 'switch-order', 'stale401', 'refresh-failure', 'refresh401', 'download-failure']) await client(strict, kind);
  const result = { checkedAt: new Date().toISOString(), passed: cases.length, cases, productionRequests: 0, productionWrites: 0, providerCalls: 0, scope: 'Actual period/contract/CSV modules, GET with synthetic authentication/reader, actual period component and request hook mounted in normal/StrictMode. Actual SQL/Prisma/native browser acceptance is separate.' };
  if (process.env.DOYA_ADMIN_ANALYTICS_PERIOD_RESULT) fs.writeFileSync(process.env.DOYA_ADMIN_ANALYTICS_PERIOD_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: cases.length, failed: 0 }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
