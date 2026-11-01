process.env.DOYA_TEST_BASELINE ||= 'docs/audits/2026-10-06-all-services-recheck/hr-org-chart-pagination-repair-overlay';
process.env.NODE_ENV = 'test';
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/org-chart' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = require('react-dom/client');
const motionCache = new Map();
const motion = new Proxy({}, { get: (_, tag) => {
  if (!motionCache.has(tag)) motionCache.set(tag, React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)));
  return motionCache.get(tag);
} });
let reply;
const asPageResponse = async (url, init) => {
  assert.ok(url.startsWith('/api/hr/org-chart?format=pages'));assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');
  const response=await reply(url,init);if(response.status!==200)return response;
  const value=await response.json();if(value?.format==='hr-org-chart-page-v1'||value?.success!==true)return Response.json(value);
  const departments=[],employees=[],pending=(value.orgChart||[]).map(node=>({node,parentId:null}));
  while(pending.length){const {node,parentId}=pending.pop();departments.push({...node.department,parentId,sortOrder:0});for(const employee of node.employees||[])employees.push({...employee,departmentId:node.department.id});for(const child of node.children||[])pending.push({node:child,parentId:node.department.id})}
  for(const employee of value.unassignedEmployees||[])employees.push({...employee,departmentId:null});
  return Response.json({success:true,format:'hr-org-chart-page-v1',orgName:value.orgName,revision:'a'.repeat(64),departments,employees,totals:{departments:departments.length,employees:employees.length},nextCursor:null});
};
const sourcePath = file => process.env.DOYA_TEST_BASELINE && fs.existsSync(require('node:path').join(process.env.DOYA_TEST_BASELINE, file)) ? require('node:path').join(process.env.DOYA_TEST_BASELINE, file) : file;
let actor = 'synthetic-actor', authStatus = 'authenticated';
const files = ['src/app/hr/org-chart/page.tsx', 'src/components/hr/OrgChartView.tsx'];
function load(file, extra) {
  const out = {};
  const mocks = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'framer-motion': { motion, AnimatePresence: ({ children }) => children }, 'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }, 'next-auth/react': { useSession: () => ({ data: { user: { id: actor } }, status: authStatus }) }, 'react-hot-toast': { __esModule: true, default: { error() {} } }, ...extra };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(sourcePath(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports: out, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, fetch: asPageResponse, console, window, document, setTimeout, clearTimeout, AbortController, TextDecoder, Uint8Array }, { filename: file });
  return out;
}
const component = load(files[1]);
const helperFile = 'src/lib/hr/org-chart-paged-client.ts';
const helper = fs.existsSync(sourcePath(helperFile)) ? load(helperFile) : {};
const page = load(files[0], { '@/components/hr/OrgChartView': component, '@/lib/hr/org-chart-paged-client': helper });
const tick = () => new Promise(resolve => setImmediate(resolve));
const employee = { id: 'synthetic-user', firstName: 'VISIBLE_EMPLOYEE_MARKER', lastName: 'Synthetic', position: null, photoUrl: null, employeeNumber: null };
const cases = [];
(async () => {
  for (const scenario of ['assigned-employee', 'unassigned-employee', 'failed-load']) {
    reply = () => scenario === 'failed-load' ? Response.json({ error: 'Synthetic failure' }, { status: 503 }) : Response.json({ success: true, orgName: 'Synthetic organization', orgChart: scenario === 'assigned-employee' ? [{ department: { id: 'synthetic-department', name: 'Synthetic department', code: null, managerId: null }, employees: [employee], children: [] }] : [], unassignedEmployees: scenario === 'unassigned-employee' ? [employee] : [] });
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      await React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(page.default))); await tick(); await tick(); });
      const text = host.textContent;
      const passed = scenario === 'failed-load' ? !text.includes('まず部署を作成してください') && text.includes('取得に失敗') : text.includes(employee.firstName);
      cases.push({ scenario, passed, employeeVisible: text.includes(employee.firstName), fabricatedEmptyState: text.includes('まず部署を作成してください') });
    } finally { await React.act(async () => root.unmount()); host.remove(); }
  }
  if (process.env.DOYA_TEST_BASELINE) {
    const payload = (marker = employee.firstName) => ({ success: true, orgName: 'Synthetic organization', orgChart: [], unassignedEmployees: [{ ...employee, firstName: marker }] });
    const act = async fn => React.act(async () => { await fn(); await tick(); await tick(); });
    const check = async (scenario, task) => {
      actor = 'synthetic-actor'; authStatus = 'authenticated';
      const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
      const render = () => act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(page.default))));
      try { await task({ host, root, render, act }); cases.push({ scenario, passed: true }); }
      catch (error) { cases.push({ scenario, passed: false, error: error.message }); }
      finally { await act(() => root.unmount()); host.remove(); }
    };
    await check('malformed body shows recovery without fabricated empty state', async ({ host, render }) => {
      reply = () => Response.json({ ...payload(), unassignedEmployees: [{ ...employee, firstName: { secret: 'SYNTHETIC_PRIVATE_ERROR' } }] });
      await render(); assert.match(host.textContent, /取得に失敗/); assert.ok(!host.textContent.includes('まず部署を作成')); assert.ok(!host.textContent.includes('SYNTHETIC_PRIVATE_ERROR'));
    });
    await check('explicit retry recovers the chart after failed HTTP', async ({ host, render, act }) => {
      reply = () => Response.json({ error: 'SYNTHETIC_PRIVATE_ERROR' }, { status: 503 }); await render();
      assert.ok(!host.textContent.includes('SYNTHETIC_PRIVATE_ERROR')); reply = () => Response.json(payload());
      await act(() => [...host.querySelectorAll('button')].find(b => b.textContent === '再取得する').click()); assert.ok(host.textContent.includes(employee.firstName));
    });
    await check('HTTP401 offers login and hides empty organization guidance', async ({ host, render }) => {
      reply = () => Response.json({ error: 'SYNTHETIC_PRIVATE_ERROR' }, { status: 401 }); await render(); assert.ok(host.querySelector('a[href="/auth/signin?callbackUrl=/hr/org-chart"]')); assert.ok(!host.textContent.includes('まず部署を作成')); assert.ok(!host.textContent.includes('SYNTHETIC_PRIVATE_ERROR'));
    });
    await check('valid empty organization still displays department guidance', async ({ host, render }) => {
      reply = () => Response.json({ ...payload(), unassignedEmployees: [] }); await render(); assert.match(host.textContent, /まず部署を作成/); assert.ok(!host.textContent.includes('取得に失敗'));
    });
    await check('late old actor chart cannot enter current actor screen', async ({ host, render, act }) => {
      let release; reply = () => new Promise(resolve => { release = resolve; }); await render(); const old = release;
      actor = 'synthetic-other'; reply = () => Response.json(payload('CURRENT_ACTOR_EMPLOYEE')); await render();
      await act(() => old(Response.json(payload('OLD_ACTOR_EMPLOYEE')))); assert.ok(host.textContent.includes('CURRENT_ACTOR_EMPLOYEE')); assert.ok(!host.textContent.includes('OLD_ACTOR_EMPLOYEE'));
    });
    await check('actor ABA cannot revive an earlier pending chart', async ({ host, render, act }) => {
      let release; reply = () => new Promise(resolve => { release = resolve; }); await render(); const old = release;
      actor = 'synthetic-other'; reply = () => Response.json(payload('OTHER_ACTOR_EMPLOYEE')); await render();
      actor = 'synthetic-actor'; reply = () => Response.json(payload('CURRENT_ACTOR_EMPLOYEE')); await render();
      await act(() => old(Response.json(payload('OLD_ACTOR_EMPLOYEE')))); assert.ok(host.textContent.includes('CURRENT_ACTOR_EMPLOYEE')); assert.ok(!host.textContent.includes('OLD_ACTOR_EMPLOYEE'));
    });
    await check('auth loading hides private chart and performs no private request', async ({ host, render }) => {
      reply = () => Response.json(payload()); await render(); assert.ok(host.textContent.includes(employee.firstName));
      let requests = 0; reply = () => { requests++; return Response.json(payload()); }; authStatus = 'loading'; await render(); assert.equal(requests, 0); assert.ok(!host.textContent.includes(employee.firstName));
      authStatus = 'authenticated'; await render(); assert.ok(host.textContent.includes(employee.firstName)); assert.equal(requests, 1);
    });
    await check('help accurately describes scrolling and department expansion', async ({ host, render, act }) => {
      reply = () => Response.json(payload()); await render();
      assert.match(host.textContent, /横にスクロール/); assert.match(host.textContent, /所属メンバーと下位部署を開閉/);
      assert.ok(!host.textContent.includes('ドラッグ')); assert.ok(!host.textContent.includes('クリックすると詳細'));
      const button = [...host.querySelectorAll('button')].find(b => b.textContent.includes('所属部署を確認'));
      assert.ok(button); await act(() => button.click()); assert.ok(!host.textContent.includes(employee.firstName));
      await act(() => button.click()); assert.ok(host.textContent.includes(employee.firstName));
    });
    await check('all200 employees remain reachable through incremental member display after four transport pages', async ({ host, render, act }) => {
      const rows=Array.from({length:200},(_,i)=>({...employee,id:'synthetic-many-'+i,firstName:'MANY_EMPLOYEE_'+String(i).padStart(4,'0'),departmentId:'synthetic-many-dept'}));
      reply=url=>{const cursor=new URL(url,'https://example.invalid').searchParams.get('cursor'),index=cursor?Number(cursor.slice(1)):0;return Response.json({success:true,format:'hr-org-chart-page-v1',orgName:'Synthetic organization',revision:'a'.repeat(64),departments:index===0?[{id:'synthetic-many-dept',name:'Synthetic many',code:null,managerId:null,parentId:null,sortOrder:0}]:[],employees:rows.slice(index*50,index*50+50),totals:{departments:1,employees:200},nextCursor:index<3?'p'+(index+1):null})};
      await render();assert.match(host.textContent,/200名/);assert.ok(host.textContent.includes('MANY_EMPLOYEE_0000'));assert.ok(!host.textContent.includes('MANY_EMPLOYEE_0199'));
      const more=[...host.querySelectorAll('button')].find(b=>b.textContent==='さらに100名を表示');assert.ok(more);await act(()=>more.click());assert.ok(host.textContent.includes('MANY_EMPLOYEE_0199'));assert.ok(![...host.querySelectorAll('button')].some(b=>b.textContent.startsWith('さらに')));
      assert.ok(host.querySelector('button[aria-expanded="true"]'));
    });
    await check('loading progress remains visible until every snapshot page has arrived', async ({ host, render, act }) => {
      let finish;
      const row=id=>({...employee,id,departmentId:null});
      const page=(employees,nextCursor)=>({success:true,format:'hr-org-chart-page-v1',orgName:'Synthetic organization',revision:'a'.repeat(64),departments:[],employees,totals:{departments:0,employees:2},nextCursor});
      reply=url=>new URL(url,'https://example.invalid').searchParams.has('cursor')?new Promise(resolve=>{finish=()=>resolve(Response.json(page([row('synthetic-progress-b')],null)))}):Response.json(page([row('synthetic-progress-a')],'next'));
      await render();assert.match(host.textContent,/1 \/ 2 件を取得/);assert.ok(!host.textContent.includes(employee.firstName));assert.equal(typeof finish,'function');await act(()=>finish());assert.ok(host.textContent.includes(employee.firstName));assert.ok(!host.textContent.includes('件を取得しています'));
    });
    await check('manager is included in displayed department employee count', async ({ host, render }) => {
      reply = () => Response.json({ ...payload(), unassignedEmployees: [], orgChart: [{ department: { id: 'synthetic-dept', name: 'Synthetic department', code: null, managerId: employee.id }, employees: [employee], children: [] }] });
      await render(); assert.match(host.textContent, /1名/); assert.ok(!host.textContent.includes('0名'));
    });
  }
  const report = { checkedAt: new Date().toISOString(), expected: process.env.DOYA_TEST_BASELINE ? 14 : 3, passed: cases.filter(c => c.passed).length, cases, sourceHashes: Object.fromEntries([...files, ...(process.env.DOYA_TEST_BASELINE ? [helperFile] : [])].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(sourcePath(file))).digest('hex')])), scope: 'Actual full HR org-chart page and OrgChartView mounted with React StrictMode. Synthetic paged HTTP and decorative motion/link/toast adapters. Original12 behavioral cases retained with explicit legacy-fixture-to-page adapter; actual API/client/DB protocol independently verified in real PostgreSQL16. Adds200-employee four-page display and loading progress. No production data or provider. Separately checks employee representation and load failure being displayed as an empty organization.' };
  fs.writeFileSync(__dirname + '/hr-org-chart-pagination-mounted-' + (process.env.DOYA_TEST_BASELINE ? 'overlay' : 'baseline') + '.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); if (process.env.DOYA_TEST_BASELINE && (report.passed !== 14 || report.cases.length !== 14)) process.exitCode = 1; dom.window.close();
})().catch(error => { console.error(error); dom.window.close(); process.exitCode = 1; });
