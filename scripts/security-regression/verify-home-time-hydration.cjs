// Separate process: synthetic data, actual React SSR/hydration, no providers.
process.env.NODE_ENV = 'development';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const requireRoot = require('node:module').createRequire(path.join(root, 'package.json'));
const React = requireRoot('react'), { renderToString } = requireRoot('react-dom/server'), ts = requireRoot('typescript');
const { load } = requireRoot('./scripts/security-regression/load-typescript.cjs');
const RealDate = Date;
const data = {
  generatedAt: '2026-10-31T08:36:47.000Z', sources: { revenue: 'sfa_quote', cost: 'promane' }, user: { name: 'Synthetic user', email: null },
  contract: { tier: 'PRO', label: 'プロ', paid: true, status: 'active', currentPeriodEnd: '2026-11-30T15:00:00.000Z', cancelAtPeriodEnd: false },
  sales: { state: 'ready', href: '/sfa/synthetic', wonThisMonth: 0, wonCountThisMonth: 0, openPipeline: 0, weightedPipeline: 0, openDeals: 0, stages: [], openTasks: 0, overdueTasks: 0, newLeads: 0 },
  quotes: { state: 'ready', href: '/quote', confirmedThisMonth: 0, draftCount: 0, sentCount: 0 },
  projects: { state: 'ready', href: '/promane/synthetic/reports', activeProjects: 0, revenue: 0, cost: 0, profit: 0, openTasks: 0, top: [] },
  attendance: { state: 'ready', href: '/kintai/dashboard', scope: 'org', workHoursThisMonth: 0, overtimeHoursThisMonth: 0, pendingRequests: 0, employees: 0 },
  people: { state: 'ready', href: '/hr/dashboard', activeEmployees: 0, departments: 0 }, trend: [], events: [],
};
function component(clock) {
  class FixedDate extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return new RealDate(clock).getTime(); } }
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  const leaf = ({ children }) => React.createElement('span', null, children);
  const imports = {
    react: React, 'react/jsx-runtime': requireRoot('react/jsx-runtime'),
    'next/link': ({ children, href, className }) => React.createElement('a', { href, className }, children),
    'next/navigation': { useRouter: () => ({ push() { throw new Error('No navigation in SSR test'); } }) },
    'lucide-react': new Proxy({}, { get: () => () => React.createElement('svg') }),
    '@/components/shell/tools': { SHELL_GROUPS: [] }, '@/components/shell/icons': { ShellIcon: leaf },
    './agent': { AGENT_SUGGESTIONS: [], planAgent() { throw new Error('No agent run in SSR test'); } },
    './intents': { HOME_INTENT_GROUPS: [], matchHomeIntent: () => null },
    '@/lib/departments': { DEPARTMENTS: [], orderDepartments: () => [], departmentOfPath: () => null },
    './today': load('src/app/(shell)/home/today.ts', {}, { Date: FixedDate }), './cookies': { SETUP_HIDE_COOKIE: 'synthetic-hide' },
    '@/components/ds/motion': { CountUp: ({ value, format }) => React.createElement('span', null, format ? format(value) : value) },
    '@/components/ds/charts': { AreaChart: leaf, Bars: leaf },
    '@/components/shell/ShellCompanyCard': { CompanyRegisterButton: leaf, ShellCompanyTag: () => React.createElement('span', null, 'Synthetic company') },
    '@/components/shell/company-context': { useAccountCompany: () => ({ source: 'company', name: 'Synthetic company' }) },
    '@/components/shell/ui-next-context': { useToolHref: () => x => x }, './home.module.css': css,
  };
  const file = path.join(root, 'src/app/(shell)/home/HomeDashboard.tsx');
  const source = fs.readFileSync(process.env.DOYA_HOME_TIME_BASELINE || file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { if (!(name in imports)) throw new Error('Unmocked import ' + name); return imports[name]; }, Date: FixedDate, console, setTimeout, clearTimeout }, { filename: file });
  return exports.default;
}
function SyntheticStage({ greeting, company }) { return React.createElement('section', null, React.createElement('p', null, greeting), company); }
function render(tz, clock = data.generatedAt, initial = data, withAgent = true) {
  process.env.TZ = tz;
  const C = component(clock);
  return renderToString(React.createElement(C, { initial, setupHidden: true, agentStage: withAgent ? React.createElement(SyntheticStage) : null }));
}
const assert = require('node:assert/strict');
const { JSDOM } = requireRoot('jsdom');
const originalTz = process.env.TZ;
const originalFetch = global.fetch;
global.fetch = async () => { throw new Error('Home time regression forbids network'); };
global.IS_REACT_ACT_ENVIRONMENT = true;
const cases = [
  { name: 'UTC server and Japan client', serverTz: 'UTC', clientTz: 'Asia/Tokyo', snapshot: data.generatedAt, greeting: 'こんにちは', updated: '17:36', today: '2026-10-31' },
  { name: 'Japan server and UTC client', serverTz: 'Asia/Tokyo', clientTz: 'UTC', snapshot: data.generatedAt, greeting: 'こんにちは', updated: '17:36', today: '2026-10-31' },
  { name: 'US client and legacy agent', serverTz: 'UTC', clientTz: 'America/Los_Angeles', snapshot: data.generatedAt, greeting: 'こんにちは', updated: '17:36', today: '2026-10-31', withAgent: false, noPeriodEnd: true },
  { name: 'Japan midnight during hydration', serverTz: 'Asia/Tokyo', clientTz: 'Asia/Tokyo', snapshot: '2026-10-31T14:59:59.800Z', clientClock: '2026-10-31T15:00:00.200Z', greeting: 'おつかれさまです', updated: '23:59', today: '2026-10-31' },
  { name: 'UTC server across Japan month boundary', serverTz: 'UTC', clientTz: 'Asia/Tokyo', snapshot: '2026-10-31T14:59:59.800Z', clientClock: '2026-10-31T15:00:00.200Z', greeting: 'おつかれさまです', updated: '23:59', today: '2026-10-31' },
  { name: 'Japan year boundary and US client clock', serverTz: 'Asia/Tokyo', clientTz: 'America/New_York', snapshot: '2026-12-31T14:59:59.800Z', clientClock: '2027-01-01T00:00:00.200Z', greeting: 'おつかれさまです', updated: '23:59', today: '2026-12-31' },
  { name: 'Morning greeting boundary', serverTz: 'Asia/Tokyo', clientTz: 'Asia/Tokyo', snapshot: '2026-10-31T01:59:59.800Z', clientClock: '2026-10-31T02:00:00.200Z', greeting: 'おはようございます', updated: '10:59', today: '2026-10-31' },
  { name: 'Evening greeting boundary', serverTz: 'Asia/Tokyo', clientTz: 'Asia/Tokyo', snapshot: '2026-10-31T08:59:59.800Z', clientClock: '2026-10-31T09:00:00.200Z', greeting: 'こんにちは', updated: '17:59', today: '2026-10-31' },
];
const result = { passed: 0, cases: [], scope: 'Actual HomeDashboard TSX, actual todayItems, actual React server rendering and hydrateRoot/jsdom. Synthetic summary, clocks, contexts, visual children and navigation. UTC/Japan/US and greeting/day/month/year boundaries. No DB, live browser, network, provider, real billing or full application proof.' };
const output = process.env.DOYA_HOME_TIME_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/home-time-hydration-results.json');
(async () => {
  for (const spec of cases) {
    const initial = JSON.parse(JSON.stringify(data)); initial.generatedAt = spec.snapshot;
    initial.events = [
      { id: 'boundary', date: '2026-11-01T03:00:00.000Z', title: 'Synthetic boundary task', kind: 'task', href: '/sfa/synthetic/tasks' },
      { id: 'later', date: '2026-11-02T03:00:00.000Z', title: 'Synthetic later task', kind: 'task', href: '/sfa/synthetic/tasks' },
    ];
    if (spec.noPeriodEnd) initial.contract.currentPeriodEnd = null;
    const before = JSON.stringify(initial), withAgent = spec.withAgent !== false;
    const server = render(spec.serverTz, spec.snapshot, initial, withAgent);
    const client = render(spec.clientTz, spec.clientClock || spec.snapshot, initial, withAgent);
    assert.equal(client, server, spec.name + ': same summary must have the same first markup');
    const dom = new JSDOM('<!doctype html><html><body><div id="root">' + server + '</div></body></html>', { url: 'http://127.0.0.1/', pretendToBeVisual: true });
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event'];
    const descriptors = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
    for (const name of names) Object.defineProperty(global, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : dom.window[name] });
    let mounted;
    try {
      const container = dom.window.document.getElementById('root');
      const parsedServerMarkup = container.innerHTML;
      const serverElement = container.firstElementChild;
      assert(container.textContent.includes(spec.greeting + '、Synthetic userさん'));
      assert.equal(container.querySelector('.refresh').textContent.trim(), spec.updated + ' 時点');
      assert.equal(container.querySelector('[data-today="true"]').textContent, String(Number(spec.today.slice(8))));
      assert.equal(container.querySelector('.calHead span').textContent, Number(spec.today.slice(0, 4)) + '年' + Number(spec.today.slice(5, 7)) + '月');
      if (!spec.noPeriodEnd) assert(container.textContent.includes('2026/12/1'), 'Contract ISO date must display in Japan time');
      assert(!container.textContent.includes('Invalid Date'));
      if (spec.today === '2026-10-31') {
        assert(container.querySelector('.today').textContent.includes('明日: Synthetic boundary task'));
        assert(!container.querySelector('.today').textContent.includes('Synthetic later task'));
      }
      const recoverable = [];
      process.env.TZ = spec.clientTz;
      const C = component(spec.clientClock || spec.snapshot);
      const { hydrateRoot } = requireRoot('react-dom/client');
      await React.act(async () => {
        mounted = hydrateRoot(container, React.createElement(C, { initial, setupHidden: true, agentStage: withAgent ? React.createElement(SyntheticStage) : null }), { onRecoverableError: error => recoverable.push(error.message) });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      assert.equal(recoverable.length, 0, spec.name + ': actual React hydration must not regenerate the tree');
      assert.equal(container.innerHTML, parsedServerMarkup, spec.name + ': hydration must retain the parsed server markup');
      assert.equal(container.firstElementChild, serverElement, spec.name + ': hydration must retain the original server element');
      assert.equal(JSON.stringify(initial), before, 'Display rendering must not mutate the summary');
      result.cases.push({ name: spec.name, firstMarkupMatched: true, actualHydrationRecoverableErrors: 0, japanTimeLabelsVerified: true, summaryUnchanged: true });
      console.log('PASS Home time hydration: ' + spec.name);
    } finally {
      if (mounted) await React.act(async () => mounted.unmount());
      dom.window.close();
      for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name]; }
    }
  }
  result.passed = result.cases.length; assert.equal(result.passed, 8);
})().catch(error => { result.failure = { type: error.constructor.name, message: error.message.slice(0, 300) }; console.error(result.failure.type + ': ' + result.failure.message); process.exitCode = 1; }).finally(() => {
  if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
  global.fetch = originalFetch;
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, scope: result.scope }));
});
