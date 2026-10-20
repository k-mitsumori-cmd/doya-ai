// Runs in its own Node process: synthetic SSR/hydration only; no providers, DB or browser session.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const req = createRequire(path.join(repo, 'package.json'));
const React = req('react');
const { renderToString } = req('react-dom/server');
const { JSDOM } = req('jsdom');
const ts = req('typescript');
const RealDate = Date;
const cache = new Map();
const Link = ({children, href, prefetch, ...props}) => React.createElement('a', {...props, href}, children);
const mocks = {
  'next/link': {__esModule:true, default:Link},
  'next/navigation': { useRouter: () => ({push(){}}) },
  'lucide-react': new Proxy({}, {get: (_,k) => k==='__esModule'?false:() => React.createElement('svg')}),
  '@/components/shell/tools': {SHELL_GROUPS:[], shellGroups:()=>[]},
  '@/components/shell/icons': {ShellIcon:()=>React.createElement('svg')},
  '@/components/ds/motion': {CountUp:({value,format})=>React.createElement('span',null,format?format(value):value)},
  '@/components/ds/charts': {AreaChart:()=>null,Bars:()=>null},
  '@/components/shell/ShellCompanyCard': {CompanyRegisterButton:()=>null,ShellCompanyTag:()=>null},
  '@/components/shell/company-context': {useAccountCompany:()=>undefined},
  '@/components/shell/ui-next-context': {useToolHref:()=>x=>x},
};
function load(filename) {
  if(cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); cache.set(filename,mod);
  mod.require=id=>{
    if(mocks[id]) return mocks[id];
    if(id.endsWith('.css')) return {__esModule:true,default:new Proxy({}, {get:(_,k)=>String(k)})};
    if(id==='./agent') return {AGENT_SUGGESTIONS:[],planAgent:()=>{throw Error('no actions allowed')}};
    if(id==='./intents') return {HOME_INTENT_GROUPS:[],matchHomeIntent:()=>null};
    if(id.startsWith('./') || id.startsWith('@/')) {
      const root=id.startsWith('@/')?path.join(repo,'src',id.slice(2)):path.join(path.dirname(filename),id);
      for(const ext of ['.ts','.tsx']) if(fs.existsSync(root+ext)) return load(root+ext);
    }
    return req(id);
  };
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  mod._compile(code,filename); return mod.exports;
}
function clock(iso,tz) {
  process.env.TZ=tz;
  const epoch=RealDate.parse(iso);
  global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[epoch]))} static now(){return epoch}};
}
function fixture(at) {return {
  generatedAt:at,sources:{revenue:'sfa_quote',cost:'promane'},user:{name:null,email:null},
  contract:{tier:'FREE',label:'無料',paid:false,status:null,currentPeriodEnd:'2026-10-31T15:30:00Z',cancelAtPeriodEnd:false},
  sales:{state:'empty',href:'/sfa',wonThisMonth:0,wonCountThisMonth:0,openPipeline:0,weightedPipeline:0,openDeals:0,stages:[],openTasks:0,overdueTasks:0,newLeads:0},
  quotes:{state:'empty',href:'/quote',confirmedThisMonth:0,draftCount:0,sentCount:0},
  projects:{state:'empty',href:'/promane',activeProjects:0,revenue:0,cost:0,profit:0,openTasks:0,top:[]},
  attendance:{state:'empty',href:'/kintai',scope:'self',workHoursThisMonth:0,overtimeHoursThisMonth:0,pendingRequests:0,employees:0},
  people:{state:'empty',href:'/hr',activeEmployees:0,departments:0},trend:[{month:'2026-10',won:0,quoted:0}],events:[],
};}
async function probe(componentName,c) {
  const Component=load(path.join(repo,'src/app/(shell)/home',componentName+'.tsx')).default;
  const props={initial:fixture(c.summaryAt === undefined ? c.server : c.summaryAt)};
  if (c.events) props.initial.events = c.events;
  clock(c.server,c.serverTZ);
  const html=renderToString(React.createElement(Component,props));
  const dom=new JSDOM('<div id="root">'+html+'</div>',{url:'https://example.test/home'});
  global.window=dom.window; global.document=dom.window.document; global.navigator=dom.window.navigator;
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const {hydrateRoot}=req('react-dom/client');
  clock(c.client,c.clientTZ);
  const recoveries=[], warnings=[]; const old=console.error;
  console.error=(...args)=>warnings.push(args.map(String).join(' '));
  let root;
  try {
    await React.act(async()=>{root=hydrateRoot(document.getElementById('root'),React.createElement(Component,props),{onRecoverableError:e=>recoveries.push(e.message)}); await new Promise(r=>setTimeout(r,25));});
    const after=document.getElementById('root').textContent;
    const before=new JSDOM(html).window.document.body.textContent;
    assert.ok(before.length > 100, 'The actual dashboard must render its content');
    if (c.events) {
      for (const content of [before, after]) {
        assert.ok(content.includes('日付だけの予定'), 'Date-only events retain their existing calendar meaning');
        assert.ok(!content.includes('タイムゾーンなしの予定'), 'Ambiguous datetime events must not depend on the environment timezone');
      }
    }
    if (c.summaryAt === 'invalid' || c.name === 'timezone-less-generated-at') {
      for (const content of [before, after]) {
        assert.ok(content.includes('日付を取得できませんでした。'), 'Unavailable snapshot time has an explicit fallback');
        assert.ok(!content.includes('1970年'), 'Unavailable snapshot time must not show a synthetic calendar');
      }
    }
    const result={component:componentName,case:c.name,recoveries:recoveries.length,textMismatch:before!==after,serverGreeting:(before.match(/おはようございます|こんにちは|おつかれさまです/)||[])[0],clientGreeting:(after.match(/おはようございます|こんにちは|おつかれさまです/)||[])[0],warnings:warnings.length};
    await React.act(async()=>root.unmount()); dom.window.close(); return result;
  } finally {console.error=old;global.Date=RealDate;}
}
test('actual home SSR and hydration preserve snapshot text across time zones and date boundaries', async()=>{
  const previousTZ = process.env.TZ;
  const previousGlobals = Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'].map(key => [key,Object.getOwnPropertyDescriptor(global,key)]));
  try {
  const cases=[
    {name:'utc-ssr-jst-client',server:'2026-10-20T06:24:00Z',client:'2026-10-20T06:24:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo'},
    {name:'same-zone-jst-greeting-boundary',server:'2026-10-20T01:59:59Z',client:'2026-10-20T02:00:01Z',serverTZ:'Asia/Tokyo',clientTZ:'Asia/Tokyo'},
    {name:'jst-day-boundary',server:'2026-10-20T14:59:59Z',client:'2026-10-20T15:00:01Z',serverTZ:'Asia/Tokyo',clientTZ:'Asia/Tokyo'},
    {name:'invalid-generated-at',server:'2026-10-20T06:24:00Z',client:'2026-10-20T06:24:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo',summaryAt:'invalid'},
    {name:'timezone-less-generated-at',server:'2026-10-20T06:24:00Z',client:'2026-10-20T06:24:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo',summaryAt:'2026-10-20T15:24:00'},
    {name:'explicit-offset-generated-at',server:'2026-10-20T06:24:00Z',client:'2026-10-20T06:24:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo',summaryAt:'2026-10-20T15:24:00+09:00'},
    {name:'date-only-and-timezone-less-events',server:'2026-10-20T06:24:00Z',client:'2026-10-20T06:24:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo',events:[{id:'date-only',date:'2026-10-20',title:'日付だけの予定',kind:'task',href:'/x'},{id:'implicit',date:'2026-10-20T18:00:00',title:'タイムゾーンなしの予定',kind:'task',href:'/x'}]},
    {name:'jst-month-boundary',server:'2026-10-31T14:59:59Z',client:'2026-10-31T15:00:01Z',serverTZ:'UTC',clientTZ:'Asia/Tokyo'},
  ];
  const results=[];
  for(const name of ['HomeDashboard','HomeDashboardLegacy']) for(const c of cases) results.push(await probe(name,c));
  const inputs = ['src/app/(shell)/home/HomeDashboard.tsx','src/app/(shell)/home/HomeDashboardLegacy.tsx','src/app/(shell)/home/clock.ts','src/app/(shell)/home/today.ts'];
  const hashes = Object.fromEntries(inputs.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')]));
  const out={scope:'actual dashboard source with synthetic summary, navigation/icons/charts mocked; no network or DB',hashes,results};
  console.log(JSON.stringify(out,null,2));
  assert.equal(results.length,16);
  assert.ok(results.every(x=>x.recoveries===0&&!x.textMismatch&&x.warnings===0),'SSR/hydration must preserve text without recoveries or warnings in every case');
  } finally {
    global.Date=RealDate;
    if(previousTZ===undefined) delete process.env.TZ; else process.env.TZ=previousTZ;
    for(const [key,descriptor] of Object.entries(previousGlobals)) { if(descriptor) Object.defineProperty(global,key,descriptor); else delete global[key]; }
  }
});
