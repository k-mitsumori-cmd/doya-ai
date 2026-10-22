// Isolated synthetic Prisma + actual home UI/agent regression. No provider, browser or DB.
process.env.NODE_ENV = 'test';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(__dirname, '../..');
const req = Module.createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const React = req('react');
const {renderToStaticMarkup} = req('react-dom/server');
const {JSDOM} = req('jsdom');
// The actual Home boundary imports react-dom for pagehide flushSync. Initialize the
// DOM event runtime inside a synthetic DOM before loading TSX; assertions/input events stay unchanged.
const eventDom = new JSDOM('');
const eventGlobals = Object.fromEntries(['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
for(const [key,value] of Object.entries({window:eventDom.window,document:eventDom.window.document}))Object.defineProperty(global,key,{configurable:true,writable:true,value});
req('react-dom/client');
for(const [key,descriptor]of Object.entries(eventGlobals)){if(descriptor)Object.defineProperty(global,key,descriptor);else delete global[key];}
eventDom.window.close();

const network = [], writes = [], navigations = [];
global.fetch = async () => { network.push('fetch'); throw Error('Network forbidden'); };
const at = new Date('2026-10-20T15:00:00Z'); // JST 10/21 midnight
const day = value => new Date(value + 'T00:00:00Z');
let current;
function reset() {
  current = { calls: [], fail: null, sites: [
    {id:'own',userId:'viewer',deletedAt:null}, {id:'foreign',userId:'other',deletedAt:null},
    {id:'deleted',userId:'viewer',deletedAt:at},
  ], popups:[
    {id:'p1',siteId:'own',userId:'viewer',name:'One',status:'live'},
    {id:'p2',siteId:'own',userId:'viewer',name:'Two',status:'draft'},
    {id:'p3',siteId:'foreign',userId:'other',name:'Other',status:'live'},
    {id:'p4',siteId:'deleted',userId:'viewer',name:'Deleted',status:'live'},
  ], stats:[
    {popupId:'p1',day:day('2026-10-15'),impressions:100,clicks:10,closes:5},
    {popupId:'p2',day:day('2026-10-21'),impressions:900,clicks:9,closes:2},
    {popupId:'p1',day:day('2026-10-14'),impressions:9999,clicks:999,closes:0},
    {popupId:'p1',day:day('2026-10-22'),impressions:9999,clicks:999,closes:0},
    {popupId:'p3',day:day('2026-10-21'),impressions:8888,clicks:888,closes:0},
    {popupId:'p4',day:day('2026-10-21'),impressions:7777,clicks:777,closes:0},
  ]};
}
const prisma = new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>async input=>{
  current.calls.push({model,method,input});
  if(!['findFirst','findUnique','findMany','count','groupBy'].includes(method)) {writes.push({model,method});throw Error('Write forbidden');}
  if(current.fail===model) throw Error('synthetic private failure');
  if(model==='popupSite') {
    assert.equal(input.where.userId,'viewer'); assert.equal(input.where.deletedAt,null);
    return current.sites.filter(s=>s.userId===input.where.userId && s.deletedAt===null).length;
  }
  if(model==='popup') {
    assert.equal(input.where.userId,'viewer'); assert.equal(input.where.site.deletedAt,null);
    return current.popups.filter(p=>p.userId===input.where.userId && current.sites.find(s=>s.id===p.siteId)?.deletedAt===null).map(p=>({...p,site:{name:'Synthetic site'}}));
  }
  if(model==='popupStat') {
    assert.equal(method,'groupBy');
    const rows=current.stats.filter(r=>input.where.popupId.in.includes(r.popupId) && r.day>=input.where.day.gte && (!input.where.day.lte || r.day<=input.where.day.lte));
    const groups=new Map();
    for(const r of rows) { const entry=groups.get(r.popupId)||{popupId:r.popupId,_sum:{impressions:0,clicks:0,closes:0}}; for(const k of ['impressions','clicks','closes']) entry._sum[k]+=r[k];groups.set(r.popupId,entry); }
    return [...groups.values()];
  }
  if(model==='user') return {name:'Synthetic',email:null,plan:'FREE',stripeCurrentPeriodEnd:null};
  return method==='findMany'?[]:method==='count'?0:null;
}})});
const Link=({children,href,prefetch,...props})=>React.createElement('a',{...props,href},children);
const mocks={
  'next-auth/react':{useSession:()=>({data:{user:{id:'viewer'}},status:'authenticated',update:async()=>({user:{id:'viewer'}})})},
  '@/lib/prisma':{prisma},
  '@/lib/home/finance-read':{loadHomeFinance:async()=>({month:'2026-10',income:{state:'unused',organization:null,value:null},expense:{state:'unused',organization:null,value:null}})},
  'next/link':{__esModule:true,default:Link},'next/navigation':{useRouter:()=>({push:href=>navigations.push(href)})},
  '@/components/shell/tools':{SHELL_GROUPS:[],shellGroups:()=>[]},
  '@/components/shell/icons':{ShellIcon:()=>null},
  '@/components/ds/motion':{CountUp:({value,format})=>React.createElement('span',null,format?format(value):value)},
  '@/components/ds/charts':{AreaChart:()=>null,Bars:()=>null},
  '@/components/shell/ShellCompanyCard':{CompanyRegisterButton:()=>null,ShellCompanyTag:()=>null},
  '@/components/shell/company-context':{useAccountCompany:()=>undefined},
  '@/components/shell/ui-next-context':{useToolHref:()=>x=>x},
  'lucide-react':new Proxy({}, {get:(_,key)=>key==='__esModule'?false:()=>React.createElement('svg')}),
};
const cache=new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file).exports;
  const mod=new Module(file);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,mod);
  mod.require=id=>{
    const normalized=id.startsWith('./')?'@/'+path.relative(path.join(root,'src'),path.resolve(path.dirname(file),id)).replaceAll(path.sep,'/'):id;
    if(mocks[id]||mocks[normalized]) return mocks[id]||mocks[normalized];
    if(id.endsWith('.css')) return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};
    if(id.startsWith('@/')||id.startsWith('./')) {const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);for(const ext of ['.ts','.tsx']) if(fs.existsSync(base+ext)) return load(base+ext);}
    return req(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
  return mod.exports;
}
const source=relative=>load(path.join(root,relative));
const {getPopupSummary}=source('src/lib/popup/popup-read.ts');
const {getHomeSummary}=source('src/lib/home/summary.ts');
const {planAgent}=source('src/app/(shell)/home/agent.ts');
const dashboards=['HomeDashboard','HomeDashboardLegacy'].map(name=>[name,source(`src/app/(shell)/home/${name}.tsx`).default]);
async function summary() {return getHomeSummary('viewer',at);}
function card(Component,s) {const dom=new JSDOM(renderToStaticMarkup(React.createElement(Component,{initial:s,serverActorId:s.actorId})));const node=dom.window.document.querySelector('section[aria-label="集客の数字（7日）"]');const out=node?{text:node.textContent,href:node.querySelector('a')?.getAttribute('href')}:null;dom.window.close();return out;}
test('popup home fixed JST window, shared read, UI and agent',async t=>{
  const oldError=console.error;console.error=()=>{};
  try {
    await t.test('inclusive seven days excludes old/future/foreign/deleted; weighted CTR',async()=>{
      reset();const s=await getPopupSummary(prisma,'viewer',7,at);
      assert.equal(s.totals.impressions,1000);assert.equal(s.totals.clicks,19);assert.equal(s.totals.ctr,1.9);assert.equal(s.siteCount,1);assert.equal(s.liveCount,1);
      const calls=current.calls.filter(c=>c.model==='popupStat');assert.equal(calls.length,1);assert.equal(calls[0].input.where.day.gte.toISOString(),'2026-10-15T00:00:00.000Z');assert.equal(calls[0].input.where.day.lte.toISOString(),'2026-10-21T00:00:00.000Z');
    });
    await t.test('JST year boundary ignores ambient date and timezone',async()=>{
      const tz=process.env.TZ;
      try {for(const zone of ['UTC','Asia/Tokyo','America/Los_Angeles']) {process.env.TZ=zone;reset();current.stats=[{popupId:'p1',day:day('2026-12-26'),impressions:4,clicks:1,closes:0},{popupId:'p2',day:day('2027-01-01'),impressions:6,clicks:1,closes:0},{popupId:'p1',day:day('2027-01-02'),impressions:900,clicks:90,closes:0}];const s=await getPopupSummary(prisma,'viewer',7,new Date('2026-12-31T15:00:00Z'));assert.equal(s.totals.impressions,10);assert.equal(s.totals.ctr,20);}}
      finally {if(tz===undefined) delete process.env.TZ;else process.env.TZ=tz;}
    });
    await t.test('just before JST midnight uses previous seven dates',async()=>{
      reset();await getPopupSummary(prisma,'viewer',7,new Date('2026-10-20T14:59:59.999Z'));const w=current.calls.find(c=>c.model==='popupStat').input.where.day;assert.equal(w.gte.toISOString(),'2026-10-14T00:00:00.000Z');assert.equal(w.lte.toISOString(),'2026-10-20T00:00:00.000Z');
    });
    await t.test('zero denominator is null even with target clicks',async()=>{reset();current.stats=[{popupId:'p1',day:day('2026-10-21'),impressions:0,clicks:2,closes:0}];const s=await getPopupSummary(prisma,'viewer',7,at);assert.equal(s.totals.clicks,2);assert.equal(s.totals.ctr,null);});
    await t.test('summary uses one real popup aggregate and same reference',async()=>{reset();const s=await summary();assert.equal(s.popup.state,'ready');assert.equal(s.popup.value.totals.impressions,1000);assert.equal(s.generatedAt,at.toISOString());assert.equal(current.calls.filter(c=>c.model==='popupStat').length,1);assert.equal(s.finance.income.state,'unused');});
    for(const [name,Component] of dashboards) {
      await t.test(name+' ready metrics and link from snapshot',async()=>{reset();const s=await summary();const result=card(Component,s);assert.ok(result);assert.match(result.text,/1,000/);assert.match(result.text,/19/);assert.match(result.text,/1.9%/);assert.match(result.text,/JST/);assert.equal(result.href,'/popup');});
      await t.test(name+' successful zero remains measured zero',async()=>{reset();current.stats=[];const s=await summary();assert.equal(s.popup.state,'ready');const result=card(Component,s);assert.ok(result);assert.match(result.text,/表示回数0/);assert.match(result.text,/クリック数0/);assert.match(result.text,/クリック率—/);assert.doesNotMatch(result.text,/取得できません/);});
      await t.test(name+' zero sites hidden',async()=>{reset();current.sites=[];current.popups=[];const s=await summary();assert.equal(s.popup.value.siteCount,0);assert.equal(card(Component,s),null);assert.equal(current.calls.filter(c=>c.model==='popupStat').length,0);});
      await t.test(name+' failure is not zero or unused',async()=>{reset();current.fail='popupStat';const s=await summary();assert.equal(s.popup.state,'error');assert.equal(s.popup.value,null);const result=card(Component,s);assert.match(result.text,/取得できませんでした/);assert.doesNotMatch(result.text,/表示回数0/);assert.equal(s.contract.tier,'FREE');});
      await t.test(name+' old snapshot remains supported',async()=>{reset();const s=await summary();delete s.popup;assert.equal(card(Component,s),null);});
    }
    await t.test('agent uses same weighted snapshot metrics',async()=>{reset();const s=await summary();const p=planAgent('ポップアップのクリック率',s);assert.equal(p.intent,'popup');assert.deepEqual(p.rows.slice(0,3).map(r=>r.value),['1,000回','19回','1.9%']);assert.equal(p.actions[0].href,'/popup');const marketing=planAgent('集客を強化したい',s);assert.ok(marketing.rows.some(r=>r.label.includes('表示回数')&&r.value==='1,000回'));});
    await t.test('agent error stays unavailable',async()=>{reset();current.fail='popupSite';const s=await summary();const p=planAgent('Popupの表示回数',s);assert.match(p.lead,/取得できませんでした/);assert.equal(p.rows.length,0);});
    await t.test('agent measured zero and no sites differ',async()=>{reset();current.stats=[];const zero=planAgent('ポップアップ',await summary());assert.equal(zero.rows[0].value,'0回');assert.equal(zero.rows[2].value,'—');reset();current.sites=[];current.popups=[];const empty=planAgent('ポップアップ',await summary());assert.equal(empty.rows.length,0);assert.match(empty.lead,/未使用/);});
    await t.test('AskLink clicks are never fabricated from Popup',async()=>{reset();const s=await summary();const p=planAgent('AskLinkのクリック数',s);assert.match(p.lead,/計測していません/);assert.equal(p.rows.length,0);assert.doesNotMatch(p.lead,/19回|1.9%/);});
    await t.test('new dashboard Popup numeric suggestion answers without navigation; creation destination remains intact',async()=>{
      reset();const s=await summary();const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/home'});
      const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'];
      const previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
      Object.defineProperty(global,'window',{configurable:true,writable:true,value:dom.window});
      Object.defineProperty(global,'document',{configurable:true,writable:true,value:dom.window.document});
      Object.defineProperty(global,'navigator',{configurable:true,writable:true,value:dom.window.navigator});
      global.IS_REACT_ACT_ENVIRONMENT=true;
      const {createRoot}=req('react-dom/client');let mounted;
      try {
        await React.act(async()=>{mounted=createRoot(document.getElementById('root'));mounted.render(React.createElement(dashboards[0][1],{initial:s,serverActorId:s.actorId}));});
        const buttons=[...document.querySelectorAll('button')];const stats=buttons.find(b=>b.textContent==='ポップアップの7日の数字は？');assert.ok(stats);
        await React.act(async()=>stats.click());
        assert.equal(navigations.length,0);assert.ok(document.querySelector('ol'));
        await React.act(async()=>new Promise(resolve=>setTimeout(resolve,550)));
        await React.act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
        assert.match(document.querySelector('section[aria-label="やりたいことを頼む"]').textContent,/1,000回/);
        const createLink=[...document.querySelectorAll('a')].find(a=>a.textContent==='サイトにポップアップを出したい');assert.equal(createLink.getAttribute('href'),'/popup');
        const {matchHomeIntent}=source('src/app/(shell)/home/intents.ts');assert.equal(matchHomeIntent('サイトにポップアップを出したい').href,'/popup');
        const {isPopupStatsQuestion}=source('src/app/(shell)/home/agent.ts');assert.equal(isPopupStatsQuestion('ポップアップのクリック率は？'),true);assert.equal(isPopupStatsQuestion('クリック率を改善するバナーを作りたい'),false);
      } finally {if(mounted) await React.act(async()=>mounted.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor) Object.defineProperty(global,key,descriptor);else delete global[key];}}
    });
    const questionCases=[
      {query:'ポップアップのクリック率は？',intent:'popup',popup:true},
      {query:'サイトにポップアップを出したい',intent:'popup-action',create:true},
      {query:'ポップアップを配信したい',intent:'popup-action',create:true},
      {query:'AskLinkのクリック数は？',intent:'asklink',note:'計測していません'},
      {query:'バナーのクリック数は？',intent:'metrics-source',note:'取得していません'},
      {query:'LPのCTRは？',intent:'metrics-source',note:'取得していません'},
      {query:'CTRは？',intent:'metrics-source',note:'どのサービス'},
      {query:'PopupとLPのクリック率は？',intent:'metrics-source',note:'どのサービス'},
    ];
    for(const c of questionCases) {
      await t.test('shared metric classification: '+c.query,async()=>{
        reset();const s=await summary();const {isPopupStatsQuestion,isHomeMetricsQuestion}=source('src/app/(shell)/home/agent.ts');
        assert.equal(isPopupStatsQuestion(c.query),Boolean(c.popup));assert.equal(isHomeMetricsQuestion(c.query),!c.create);
        const p=planAgent(c.query,s);assert.equal(p.intent,c.intent);
        if(c.popup) assert.deepEqual(p.rows.slice(0,3).map(r=>r.value),['1,000回','19回','1.9%']);
        else {assert.equal(p.rows.length,0);assert.doesNotMatch(p.lead,/1,000回|19回|1\.9%/);}
        if(c.note) assert.ok(p.lead.includes(c.note));
        if(c.create) assert.equal(p.actions[0].href,'/popup');
      });
      for(const [name,Component] of dashboards) await t.test(name+' actual mounted question: '+c.query,async()=>{
        reset();const s=await summary();const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/home'});
        const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'];const previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
        for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(global,key,{configurable:true,writable:true,value});
        const {createRoot}=req('react-dom/client');let mounted;const navBefore=navigations.length;
        try {
          await React.act(async()=>{mounted=createRoot(document.getElementById('root'));mounted.render(React.createElement(Component,{initial:s,serverActorId:s.actorId}));});
          const input=document.querySelector('input[aria-label="エージェントへの依頼"]');
          await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,c.query);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
          assert.equal(document.querySelector('button[type="submit"]').disabled,false,'Actual input must update React state');
          await React.act(async()=>input.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
          if(c.create&&name==='HomeDashboard') {assert.deepEqual(navigations.slice(navBefore),['/popup']);return;}
          assert.equal(navigations.length,navBefore);
          const stepCount=document.querySelectorAll('section[aria-label] ol li').length;
          for(let step=0;step<stepCount;step++) await React.act(async()=>new Promise(resolve=>setTimeout(resolve,550)));
          await React.act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
          const agent=document.querySelector(name==='HomeDashboard'?'section[aria-label="やりたいことを頼む"]':'section[aria-label="経営エージェント"]');
          if(c.popup) assert.match(agent.textContent,/1,000回/);
          else {assert.doesNotMatch(agent.textContent,/1,000回|19回|1\.9%/);if(c.note) assert.ok(agent.textContent.includes(c.note));if(c.create) assert.equal(agent.querySelector('a').getAttribute('href'),'/popup');}
        } finally {if(mounted) await React.act(async()=>mounted.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor) Object.defineProperty(global,key,descriptor);else delete global[key];}}
      });
    }
    await t.test('unqualified click rate, click count and impressions require a service',async()=>{reset();const s=await summary();const {isPopupStatsQuestion}=source('src/app/(shell)/home/agent.ts');for(const query of ['クリック数は？','クリック率は？','表示回数は？','ctrは？']) {assert.equal(isPopupStatsQuestion(query),false);const p=planAgent(query,s);assert.equal(p.intent,'metrics-source');assert.equal(p.rows.length,0);assert.match(p.lead,/どのサービス/);}});
    await t.test('ordinary revenue number questions retain finance precedence',async()=>{reset();const s=await summary();const {isHomeMetricsQuestion}=source('src/app/(shell)/home/agent.ts');assert.equal(isHomeMetricsQuestion('今月の売上の数字を教えて'),false);assert.equal(planAgent('今月の売上の数字を教えて',s).intent,'revenue');});
    await t.test('all operations are reads with no network' ,()=>{assert.deepEqual(writes,[]);assert.deepEqual(network,[]);});
  } finally {console.error=oldError;}
});
