process.env.NODE_ENV = 'development';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..'), dep = name => require(path.join(repo, 'node_modules', name));
const sourcePath = name => path.join(repo, name);
const React = dep('react'), ts = dep('typescript'), { JSDOM } = dep('jsdom');
const sources = ['src/app/admin/billing/page.tsx', 'src/app/admin/page.tsx', 'src/lib/use-admin-billing.ts', 'src/lib/admin-billing-contract.ts', 'src/lib/admin-billing-period.ts', 'src/lib/admin-billing-csv.ts', 'src/lib/jst.ts', 'src/lib/plan-utils.ts', 'src/lib/admin-registered-plan-stats.ts', 'src/app/admin/analytics/page.tsx','src/lib/use-admin-analytics.ts','src/lib/admin-analytics-contract.ts', 'src/lib/admin-stat-comparison.ts', 'src/lib/admin-hourly-chart.ts', 'src/lib/admin-dashboard-contract.ts','src/lib/use-admin-dashboard.ts', 'src/components/AdminHourlyChart.tsx','src/components/AdminLegacyMeasurementCoverage.tsx','src/lib/admin-stats-measurement.ts','src/lib/services.ts','src/lib/unified-plan.ts'];
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
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(sourcePath(filename), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
        exports, process: {env:{}}, require: name => {
          if (['react', 'react/jsx-runtime'].includes(name)) return dep(name);
          if (name === 'lucide-react') return dep(name);
          if (name === 'next/link') return { __esModule: true, default: ({ children, ...rest }) => React.createElement('a', rest, children) };
          if (name === 'react-hot-toast') return { __esModule: true, default: { success() {}, error() {} }, Toaster: () => null };
          if (name === 'framer-motion') return { motion };
          if (name === 'next/navigation') return { useRouter: () => router };
          // Period report has its own HTTP/CSV/StrictMode suite. These scenarios isolate the retained legacy stats reader.
          if (name === '@/components/AdminAnalyticsPeriod') return { __esModule: true, default: () => null };
          if (name.startsWith('@/')) {const stem='src/'+name.slice(2),file=[stem+'.ts',stem+'.tsx'].find(x=>sources.includes(x));assert(file,name);return load(file);}
          if (name.startsWith('./')) return load(path.join(path.dirname(filename), name + '.ts'));
          throw Error('Unexpected module ' + name);
        }, console, Date, Promise, AbortController, AbortSignal, Blob, URL: SafeURL, document: dom.window.document,
        fetch: fakeFetch, setTimeout: timer, clearTimeout: id => timers.delete(id),
      }, { filename }); return exports;
    }
    const { adminBillingPeriodRange } = load('src/lib/admin-billing-period.ts');
    const fixture = (period = 'month', extra = {}) => {
      const range = adminBillingPeriodRange(period, new Date('2026-11-15T00:00:00.000Z')), amount = { month: 100, quarter: 200, year: 300 }[period];
      return { version: 1, currency: 'jpy', timeZone: 'Asia/Tokyo', period, label: range.label, since: range.since.toISOString(), until: range.until.toISOString(), updatedAt: '2026-11-15T00:00:00.000Z', paidInvoiceCount: 1, paidTotal: amount, refundTotal: 20, pendingRefundCount: 0, pendingRefundTotal: 0, netRevenue: amount - 20, mrr: 1000, activeSubscriptions: 2, mrrSubscriptions: 2, activeCustomers: 1, arpu: 1000, trialingSubscriptions: 1, discountPolicy: { subtractRecurringDiscounts: true, subtractOneTimeDiscounts: false }, ...extra };
    };
    const measurementServices = () => [
      ...['banner','writing','interview','copy','lp','voice','movie'].map((id,i)=>({id,name:'UNIT-'+id,icon:'',gradient:'',users:i<2?5:null,userCountLabel:'ユーザー',proUsers:i<2?1:null,generations:(i+1)*10,todayGenerations:(i+1)*2,growth:0,growthStatus:'comparable',revenue:null})),
      {id:'hr',name:'UNIT-hr',icon:'',gradient:'',users:12,proUsers:null,generations:7,todayGenerations:11,growth:null,growthStatus:'not-measured',revenue:null},
      {id:'kintai',name:'UNIT-kintai',icon:'',gradient:'',users:15,proUsers:null,generations:13,todayGenerations:17,growth:0,growthStatus:'comparable',revenue:null},
      {id:'unknown-external',name:'UNIT-unknown',icon:'',gradient:'',users:null,proUsers:null,generations:9999,todayGenerations:9999,growth:null,growthStatus:'not-measured',revenue:null},
    ];
    const verifyMeasurementPage = analyticsPage => {
      const coverage=document.querySelector('[aria-label="サービス別統計の対象"]');assert(coverage);assert(coverage.textContent.includes('23サービスのうち、5サービス'));assert(coverage.textContent.includes('提供終了済みの4サービス'));assert.equal(coverage.querySelectorAll('ul li').length,18);assert([...coverage.querySelectorAll('ul li')].every(x=>x.textContent.endsWith('：未集計')));
      const graph=document.querySelector('[aria-label="時間別グラフ（日本時間）"]');assert(graph);assert.deepEqual([...graph.querySelectorAll('li time')].map(x=>x.textContent),Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')+':00'));assert.equal(graph.parentElement.querySelector('p time').getAttribute('datetime'),'2026-11-03T03:00:00.000Z');
      const card = id => analyticsPage ? document.querySelector('[aria-label="UNIT-'+id+'の件数"]') : [...document.querySelectorAll('h3')].find(x=>x.textContent==='UNIT-'+id)?.closest('.overflow-hidden');
      const value = (id,label) => {const c=card(id);assert(c,id);const l=[...c.querySelectorAll(analyticsPage?'dt':'p')].find(x=>x.textContent===label);assert(l,label);return (analyticsPage?l.nextElementSibling:l.previousElementSibling).textContent.trim()};
      if(analyticsPage){assert.equal(value('hr','組織登録（累計）'),'7件');assert.equal(value('hr','従業員登録（本日）'),'11件');assert.equal(value('interview','保存プロジェクト（累計）'),'30件');assert.equal(value('kintai','打刻記録（累計）'),'13件');assert.equal(value('writing','利用・生成記録（累計）'),'20件')}
      else{assert.equal(value('hr','組織登録'),'7件');assert(card('hr').textContent.includes('従業員登録（本日）：11件'));assert.equal(value('hr','従業員登録'),'12件');assert.equal(value('interview','保存プロジェクト'),'30件');assert.equal(value('kintai','打刻記録'),'13件');assert.equal(value('writing','利用・生成記録'),'20件')}
      for(const id of ['copy','lp','voice','movie'])assert(card(id).textContent.includes('提供終了'));
      const unknown=card('unknown');assert(unknown);assert(unknown.textContent.includes('集計定義'));assert(!unknown.textContent.includes('9999'));
      assert(!body().includes('総生成数'));assert(!body().includes('本日生成'));
    };
    const dashboard = kind.startsWith('dashboard-'), analytics = kind.startsWith('analytics-');
    const Page = load(dashboard ? 'src/app/admin/page.tsx' : analytics ? 'src/app/admin/analytics/page.tsx' : 'src/app/admin/billing/page.tsx').default;
    root = dep('react-dom/client').createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(strict ? React.StrictMode : React.Fragment, {}, React.createElement(Page))));
    assert.equal(requests.length, (strict ? 2 : 1) * (dashboard ? 2 : 1)); if (!dashboard && !analytics) assert(document.querySelector('[role="status"][aria-label="売上・課金データを読み込み中"]'));
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
    if(kind.startsWith('dashboard-request-')) {
      const db=initial.filter(x=>x.url==='/api/admin/stats');await reply(initial.filter(x=>x.url.startsWith('/api/admin/billing/stats?')));
      const stats={lastUpdated:'2026-11-03T03:00:00.000Z',totalUsers:34,premiumUsers:16,enterpriseUsers:3,freeUsers:18,recentUsers:1,recentGenerations:[],adminLoginAttempts:0,conversionRate:47.1,totalGenerations:10,todayGenerations:2,monthGenerations:4,lastMonthGenerations:5,generationGrowthStatus:'comparable',generationGrowth:-20,services:[],chartData:Array(12).fill(0)};
      const failed=()=>{assert(alert());assert(body().includes('ダッシュボード統計'));assert(button('統計を再取得する'));assert(!body().includes('PRIVATE_'));assert(!body().includes('SYNTHETIC_BAD_COUNT'));assert(body().includes('返金控除後入金：¥80'));};
      const recover=async()=>{await click('統計を再取得する');await reply([requests.at(-1)],200,stats);assert(!alert());assert(body().includes('登録比率 47.1%'));};
      const invalid={count:{...stats,totalUsers:'SYNTHETIC_BAD_COUNT'},services:{...stats,services:{length:1}},activities:{...stats,recentGenerations:{length:1}},date:{...stats,recentGenerations:[{id:'s',userName:'s',service:'banner',action:'s',createdAt:'bad-date'}]},tiers:{...stats,registeredPlanTiers:{GUEST:34}},negative:{...stats,adminLoginAttempts:-1}};
      const defect=kind.slice('dashboard-request-'.length);
      if(defect in invalid){await reply(db,200,invalid[defect]);failed();await recover();}
      else if(['http503','network','json-malformed'].includes(defect)){
        if(defect==='network')await flush(()=>db.forEach(x=>x.reject(Error('PRIVATE_NETWORK_ERROR'))));
        else if(defect==='json-malformed')await flush(()=>db.forEach(x=>x.resolve(new Response('PRIVATE_BAD_JSON',{status:200}))));
        else await reply(db,503,{error:'PRIVATE_HTTP_ERROR'});
        failed();await recover();
      } else if(['timeout','body-timeout','timeout-late401'].includes(defect)){
        if(defect==='body-timeout')await flush(()=>db.forEach(x=>x.resolve({ok:true,status:200,json:()=>new Promise(()=>{})})));
        await fireDeadline();failed();assert(db.every(x=>x.options.signal.aborted));
        if(defect==='timeout-late401'){await reply(db,401,{error:'PRIVATE_STALE_ERROR'});assert.deepEqual(navigation,[]);failed();}
        await recover();
      }else if(defect==='unmount-late401'){
        await React.act(async()=>root.unmount());root=null;await reply(db,401,{error:'PRIVATE_STALE_ERROR'});assert.deepEqual(navigation,[]);assert(db.every(x=>x.options.signal.aborted));assert.equal(timers.size,0);
      }else if(['replace-late401','replace-latesuccess'].includes(defect)){
        await flush(()=>root.render(React.createElement(strict?React.StrictMode:React.Fragment,{},React.createElement(Page,{key:'replacement'}))));
        const next=requests.slice(initial.length);await reply(next.filter(x=>x.url.startsWith('/api/admin/billing/stats?')));await reply(next.filter(x=>x.url==='/api/admin/stats'),200,{...stats,totalGenerations:444});const latest=body();assert(latest.includes('444'));
        await reply(db,defect==='replace-late401'?401:200,stats);assert.equal(body(),latest);assert.deepEqual(navigation,[]);assert(db.every(x=>x.options.signal.aborted));
      }else{
        await reply(db,200,stats);
        // Successful state has no error retry; the header refresh owns both independent readers.
        const before=requests.length;await click('更新');const fresh=requests.slice(before);await reply(fresh.filter(x=>x.url.startsWith('/api/admin/billing/stats?')));
        const current=fresh.filter(x=>x.url==='/api/admin/stats');assert.equal(current.length,1);assert(button('更新').disabled);
        if(defect==='refresh-failure'){await reply(current,503,{error:'PRIVATE_HTTP_ERROR'});failed();assert(body().includes('前回取得したデータ'));assert(body().includes('登録比率 47.1%'));await recover();}
        else if(defect==='refresh401-clears'){await reply(current,401,{error:'PRIVATE_UNAUTHORIZED'});assert.deepEqual(navigation,['/admin/login']);failed();assert(!body().includes('登録比率 47.1%'));}
        else{assert.equal(defect,'refresh-pending');await reply(current,200,stats);assert(!button('更新').disabled);}
      }
      assert(requests.filter(x=>x.url==='/api/admin/stats').every(x=>x.options.credentials==='include'&&x.options.cache==='no-store'&&x.options.signal instanceof AbortSignal));
    } else if(kind.includes('-comparison-')) {
      const which=kind.split('-comparison-')[1];
      const [percent,status,expected]=({zero:[null,'no-baseline','比較不可（前月0件）'],unmeasured:[null,'not-measured','未集計'],negative:[-100,'comparable','-100.0%'],equal:[0,'comparable','0.0%'],positive:[50,'comparable','+50.0%']})[which];
      const stats={totalUsers:9,premiumUsers:2,enterpriseUsers:0,freeUsers:7,totalGenerations:45,todayGenerations:4,monthGenerations:which==='zero'?3:which==='negative'?0:which==='positive'?3:4,lastMonthGenerations:which==='zero'?0:which==='positive'?2:4,generationGrowth:which==='unmeasured'?0:percent,generationGrowthStatus:which==='unmeasured'?'comparable':status,avgGenerationsPerUser:5,conversionRate:22.2,services:[{id:'banner',name:'合成サービス',icon:'',gradient:'',users:5,proUsers:1,generations:8,todayGenerations:2,revenue:null,growth:percent,growthStatus:status}],chartData:Array(12).fill(2),recentUsers:1,recentGenerations:[],adminLoginAttempts:0,lastUpdated:'2026-11-15T00:00:00.000Z'};
      await reply(initial.filter(x=>x.url==='/api/admin/stats'),200,stats);
      if(dashboard) await reply(initial.filter(x=>x.url.startsWith('/api/admin/billing/stats?')));
      assert(body().includes(expected),kind+' expected '+expected);
      assert(!body().includes('NaN'));assert(!body().includes('Infinity'));
      assert(!document.querySelector('svg.lucide-arrow-up-right,svg.lucide-arrow-down-right'));
      if(analytics){assert(body().includes('今月の保存記録（途中累計）'));assert(body().includes('先月の保存記録（月全体）'));assert(body().includes('今月累計 / 前月全体（日本時間）'))}
      else assert(body().includes('今月累計 / 前月全体'));
      if(percent===null) assert(!body().includes('100%'));
    } else if (analytics) {
      if(kind==='analytics-measurement-units') {
        const stats={lastUpdated:'2026-11-03T03:00:00.000Z',totalUsers:34,premiumUsers:16,conversionRate:47.1,totalGenerations:10,todayGenerations:2,monthGenerations:4,lastMonthGenerations:5,generationGrowthStatus:'comparable',generationGrowth:-20,services:measurementServices(),chartData:Array(12).fill(0)};
        await reply(initial,200,stats);verifyMeasurementPage(true);
      } else if(kind==='analytics-registration-labels') {

      const stats = { lastUpdated: '2026-11-03T03:00:00.000Z', totalUsers: 34, premiumUsers: 16, conversionRate: 47.1, totalGenerations: 10, todayGenerations: 2, monthGenerations: 4, lastMonthGenerations: 5, generationGrowthStatus: 'comparable', generationGrowth: -20, services: [], chartData: Array(12).fill(0) };
      await reply(initial, 200, stats);
      assert(body().includes('有料プラン登録')); assert(body().includes('登録比率 47.1%')); assert(!body().includes('有料会員')); assert(!body().includes('CVR'));
      for (const label of ['有料プラン登録', '総ユーザー', '本日の保存記録']) {
        const node = [...document.querySelectorAll('p')].find(e => e.textContent === label); assert(node, label);
        assert.equal(node.parentElement.querySelectorAll('svg.lucide-arrow-up-right,svg.lucide-arrow-down-right').length, 0);
      }
      assert(requests.every(x => x.url === '/api/admin/stats'));

      } else {

      const stats={lastUpdated:'2026-11-03T03:00:00.000Z',totalUsers:34,premiumUsers:16,conversionRate:47.1,totalGenerations:10,todayGenerations:2,monthGenerations:4,lastMonthGenerations:5,generationGrowthStatus:'comparable',generationGrowth:-20,services:[],chartData:Array(12).fill(0)};
      const failure=()=>{assert(alert());assert(body().includes('利用統計'));assert(!document.querySelector('.animate-spin'));assert(button('再取得する'));assert(!body().includes('PRIVATE_'));};
      const recover=async()=>{await click('再取得する');await reply([requests.at(-1)],200,stats);assert(!alert());assert(body().includes('有料プラン登録'));};
      if(['analytics-http503','analytics-network','analytics-json-malformed','analytics-invalid-shape'].includes(kind)) {
        if(kind==='analytics-network') await flush(()=>initial.forEach(x=>x.reject(Error('PRIVATE_NETWORK_ERROR'))));
        else if(kind==='analytics-json-malformed') await flush(()=>initial.forEach(x=>x.resolve(new Response('PRIVATE_BAD_JSON',{status:200}))));
        else await reply(initial,kind==='analytics-http503'?503:200,kind==='analytics-invalid-shape'?{...stats,totalGenerations:'PRIVATE_BAD_COUNT'}:{error:'PRIVATE_HTTP_ERROR'});
        failure();await recover();
      } else if(['analytics-timeout','analytics-body-timeout','analytics-timeout-late401'].includes(kind)) {
        if(kind==='analytics-body-timeout')await flush(()=>initial.forEach(x=>x.resolve({ok:true,status:200,json:()=>new Promise(()=>{})})));
        await fireDeadline();failure();assert(initial.every(x=>x.options.signal.aborted));
        if(kind==='analytics-timeout-late401'){await reply(initial,401,{error:"SYNTHETIC_UNAUTHORIZED"});assert.deepEqual(navigation,[]);failure();}
        await recover();
      } else if(kind==='analytics-unauthorized') {
        await reply(initial,401,{error:"SYNTHETIC_UNAUTHORIZED"});assert.deepEqual(navigation,['/admin/login']);failure();assert(!body().includes('有料プラン登録'));
      } else if(kind==='analytics-unmount-late401') {
        await React.act(async()=>root.unmount());root=null;await reply(initial,401,{error:"SYNTHETIC_UNAUTHORIZED"});assert.deepEqual(navigation,[]);assert(initial.every(x=>x.options.signal.aborted));assert.equal(timers.size,0);
      } else if(kind==='analytics-replace-late401'||kind==='analytics-replace-latesuccess') {
        await flush(()=>root.render(React.createElement(strict?React.StrictMode:React.Fragment,{},React.createElement(Page,{key:'new-mount'}))));
        const replacement=requests.slice(initial.length);assert.equal(replacement.length,strict?2:1);await reply(replacement,200,{...stats,totalGenerations:444});const latest=body();assert(latest.includes('444'));
        await reply(initial,kind==='analytics-replace-late401'?401:200,stats);assert.equal(body(),latest);assert.deepEqual(navigation,[]);assert(initial.every(x=>x.options.signal.aborted));
      } else if(kind==='analytics-zero-success') {
        await reply(initial,200,{...stats,totalUsers:0,premiumUsers:0,conversionRate:0,totalGenerations:0,todayGenerations:0,monthGenerations:0,lastMonthGenerations:0,generationGrowthStatus:'no-baseline',generationGrowth:null});assert(!alert());assert(body().includes('登録比率 0%'));assert(!document.querySelector('.animate-spin'));
      } else if(kind==='analytics-null-service') {
        await reply(initial,200,{...stats,services:[{id:'interview',name:'SYNTHETIC',icon:'',generations:0,todayGenerations:0,users:null,proUsers:null,growthStatus:'no-baseline',growth:null}]});assert(!alert());assert(body().includes('SYNTHETIC'));
      } else {
        await reply(initial,200,stats);assert(!alert());const before=requests.length;await click('更新');assert.equal(requests.length,before+1);assert(button('更新').disabled);
        if(kind==='analytics-refresh-failure'){await reply([requests.at(-1)],503,{error:"SYNTHETIC_HTTP_ERROR"});failure();assert(body().includes('前回取得したデータ'));assert(body().includes('登録比率 47.1%'));await recover();}
        else if(kind==='analytics-refresh401-clears'){await reply([requests.at(-1)],401,{error:"SYNTHETIC_UNAUTHORIZED"});assert.deepEqual(navigation,['/admin/login']);failure();assert(!body().includes('登録比率 47.1%'));assert(!body().includes('有料プラン登録'));}
        else {assert.equal(kind,'analytics-refresh-pending-disabled');await reply([requests.at(-1)],200,stats);assert(!button('更新').disabled);}
      }
      assert(requests.every(x=>x.url==='/api/admin/stats'&&x.options.credentials==='include'&&x.options.cache==='no-store'&&x.options.signal instanceof AbortSignal));

      }
    } else if (dashboard) {
      const db = initial.filter(x => x.url === '/api/admin/stats'), financial = initial.filter(x => x.url.startsWith('/api/admin/billing/stats?'));
      assert.equal(db.length, strict ? 2 : 1); assert.equal(financial.length, db.length);
      const stats = { totalUsers: 9, premiumUsers: 2, enterpriseUsers: 3, freeUsers: 7, totalGenerations: 45, todayGenerations: 4, monthGenerations: 10, lastMonthGenerations: 10, generationGrowthStatus: 'comparable', generationGrowth: 0, avgGenerationsPerUser: 5, monthlyRevenue: 99999999, mrr: 99999999, conversionRate: 22.2, services: [{ id: 'banner', name: '合成サービス', icon: '', gradient: '', users: 5, proUsers: 1, generations: 8, todayGenerations: 2, revenue: null, growthStatus: 'comparable', growth: 0 }], chartData: Array(12).fill(2), recentUsers: 1, recentGenerations: [], adminLoginAttempts: 0, lastUpdated: '2026-11-15T00:00:00.000Z' };
      if(kind==='dashboard-measurement-units')Object.assign(stats,{lastUpdated:'2026-11-03T03:00:00.000Z',services:measurementServices(),chartData:Array(12).fill(0)});
      if (kind.startsWith('dashboard-registration-')) {
        const grouped = load('src/lib/admin-registered-plan-stats.ts').summarizeRegisteredPlans([
          { plan: 'GUEST', _count: { _all: 5 } }, { plan: 'FREE', _count: { _all: 3 } }, { plan: 'NOT_PRO', _count: { _all: 10 } },
          { plan: 'LIGHT', _count: { _all: 5 } }, { plan: 'BUNDLE', _count: { _all: 8 } }, { plan: 'ENTERPRISE', _count: { _all: 3 } },
        ]);
        Object.assign(stats, { totalUsers: grouped.totalUsers, premiumUsers: grouped.paidPlanUsers, freeUsers: grouped.otherPlanUsers, registeredPlanTiers: grouped.registeredPlanTiers, conversionRate: 47.1 });
        if (kind === 'dashboard-registration-unknown') stats.services = [
          { ...stats.services[0], users: 0, proUsers: 0, userCountLabel: '個別プラン登録者' },
          { ...stats.services[0], id: 'interview', name: '合成面談', users: null, proUsers: null, userCountLabel: 'ユーザー' },
          { ...stats.services[0], id: 'hr', name: '合成HR', users: 7, proUsers: null, userCountLabel: '従業員' },
        ];
      }
      if (kind === 'dashboard-counts-error') {
        await flush(() => db.forEach(x => x.reject(Error('Synthetic counts failure')))); await reply(financial);
        assert(body().includes('MRR（税抜の月額換算）：¥1,000')); assert(body().includes('返金控除後入金：¥80'));
      } else {
        await reply(db, 200, stats); assert(body().includes('ダッシュボード')); assert(body().includes(kind==='dashboard-measurement-units'?'UNIT-banner':'合成サービス'));  assert(body().includes('未按分'));
        if (kind === 'dashboard-finance-error') { await reply(financial, 503); assert(alert().textContent.includes('売上・課金データ')); assert(body().includes('取得失敗')); assert(!body().includes('¥0')) }
        else {
          await reply(financial); assert(body().includes('返金控除後入金：¥80')); assert(body().includes('MRR（税抜の月額換算）：¥1,000'));
          if (kind === 'dashboard-refresh-error') {
            const count = requests.length; await click('入金・契約指標を再取得'); assert.equal(requests.length, count + 1); assert(requests.at(-1).url.endsWith('refresh=1')); await reply([requests.at(-1)], 503); assert(alert().textContent.includes('前回取得したデータ')); assert(body().includes('¥80')); assert(body().includes(kind==='dashboard-measurement-units'?'UNIT-banner':'合成サービス'));  await click('入金・契約指標を再取得'); await reply([requests.at(-1)]); assert(!alert());
          }
        }
      }
      if (kind.startsWith('dashboard-registration-')) {
        const tiers = Object.fromEntries([...document.querySelectorAll('dt')].map(e => [e.textContent, e.nextElementSibling.textContent]));
        assert.deepEqual(tiers, { 'ゲスト相当': '5人', '無料相当': '13人', 'ライト': '5人', 'プロ': '8人', 'エンタープライズ': '3人' });
        assert(body().includes('登録比率 47.1%')); assert(body().includes('合計しないでください')); assert(body().includes('未認識の値は無料相当に含まれます'));
        const labels = [...document.querySelectorAll('p')].filter(e => e.textContent === '有料プラン登録'); assert(labels.length >= 1);
        assert.equal(labels[0].parentElement.querySelectorAll('svg.lucide-arrow-up-right,svg.lucide-arrow-down-right').length, 0);
        if (kind === 'dashboard-registration-unknown') {
          const value = (name, label) => { const heading = [...document.querySelectorAll('h3')].find(e => e.textContent === name); assert(heading, name); const card = heading.closest('.overflow-hidden'); const p = [...card.querySelectorAll('p')].find(e => e.textContent === label); assert(p, label); return p.previousElementSibling.textContent };
          assert.equal(value('合成サービス', '個別の有料プラン登録'), '0'); assert.equal(value('合成面談', '個別の有料プラン登録'), '未集計');
          assert.equal(value('合成面談', 'ユーザー'), '未集計'); assert.equal(value('合成HR', '従業員登録'), '7件'); assert.equal(value('合成HR', '個別の有料プラン登録'), '未集計');
        }
      }
      if(kind==='dashboard-measurement-units')verifyMeasurementPage(false);
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
    assert(requests.every(x => (x.url.startsWith('/api/admin/billing/stats?period=') || (dashboard || analytics) && x.url === '/api/admin/stats') && x.options.credentials === 'include' && (x.url === '/api/admin/stats' || x.options.cache === 'no-store') && !x.options.method));
    return { kind, strict, observed: true, requests: requests.length };
  } finally {
    if (root) await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key] }
  }
}
async function run(kinds, prefix, resultEnv) {
  const cases = [];
  for (const strict of [false, true]) for (const kind of kinds) { cases.push(await scenario(strict, kind)); console.log(prefix + kind + ' ' + (strict ? 'StrictMode' : 'normal')) }
  const result = { checkedAt: new Date().toISOString(), cases, passed: cases.length, failed: 0, sourceHashes: Object.fromEntries(sources.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(sourcePath(name))).digest('hex')])), productionRequests: 0, stripeCalls: 0, productionWrites: 0, scope: prefix === 'PASS Dashboard request: ' ? 'Actual product Dashboard, actual stats request hook and DTO validator mounted normal/StrictMode; synthetic HTTP/JSON/timers,30s deadline, retry/stale snapshot,401 clearing, late response/unmount isolation and independent billing response. No native or production acceptance.' : prefix === 'PASS Admin measurement UI: ' ? 'Actual product Dashboard and Analytics legacy section mounted normal/StrictMode with synthetic API snapshots; period report isolated as null. Explicit service count units, coverage/retired/unknown handling and shared hourly snapshot parent wiring. No native SQL or production acceptance.' : prefix === 'PASS Admin analytics recovery: ' ? 'Actual Analytics legacy section with current stats request hook and response validator mounted in normal/StrictMode; period report isolated as null and verified by its separate suite; synthetic HTTP/body/timers,30s deadline, retry/stale warning,401 clearing and stale/unmount isolation. Not native or production acceptance.' : prefix === 'PASS Admin registered plan UI: ' ? 'Actual Dashboard and Analytics legacy section (period report isolated as null), actual common plan labels and grouped-count helper under React normal/StrictMode with synthetic deferred GET. Five registered tiers, paid ratio without growth arrows, known zero versus unknown service counts. No native paint, actual SQL or production acceptance.' : 'Actual billing page, request hook, DTO validation, JST period and CSV modules mounted under React normal/StrictMode. Synthetic deferred HTTP/JSON and controlled request deadlines with real AbortController; no native paint/production/admin or provider acceptance.' };
  if (process.env[resultEnv]) fs.writeFileSync(process.env[resultEnv], JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ passed: cases.length, failed: 0 }));
}
module.exports = { run, scenario };
