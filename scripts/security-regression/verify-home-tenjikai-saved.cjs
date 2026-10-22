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
  current = { calls: [], fail: null, projects: [
    {id:'b',userId:'viewer',name:'営業部の出展条件',eventName:'合同展示会',eventStart:new Date(at),status:'planning'},
    {id:'a',userId:'viewer',name:'開発部の出展条件',eventName:'合同展示会',eventStart:new Date(at),status:'draft'},
    {id:'foreign',userId:'other',name:'FOREIGN',eventName:'Other',eventStart:new Date(at)},
  ], sites: [
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
  if(current.fail===model) throw current.failure || Error('synthetic private failure');
  if(model==='tenjikaiProject') {
    assert.equal(method,'findMany');assert.equal(input.where.userId,'viewer');
    assert.deepEqual(input.select,{id:true,name:true,eventName:true,eventStart:true});
    assert.deepEqual(input.orderBy,[{eventStart:'asc'},{id:'asc'}]);assert.equal(input.take,20);
    return current.projects.filter(p=>p.userId===input.where.userId && p.eventStart>=input.where.eventStart.gte && p.eventStart<input.where.eventStart.lt).sort((a,b)=>a.eventStart-b.eventStart||a.id.localeCompare(b.id)).slice(0,input.take).map(({id,name,eventName,eventStart})=>({id,name,eventName,eventStart}));
  }
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

function exhibitionCard(Component,s) {
  const dom=new JSDOM(renderToStaticMarkup(React.createElement(Component,{initial:s,serverActorId:s.actorId})));
  const node=dom.window.document.querySelector('section[aria-label="保存された出展条件"]');
  const result=node?{text:node.textContent,links:[...node.querySelectorAll('a')].map(a=>a.getAttribute('href'))}:null;
  dom.window.close();return result;
}
const assertNoProgress=text=>assert.doesNotMatch(text,/タスク0|予算0|進捗率|0%|生成済み|準備完了/);
async function mountedQuestion(Component,name,s,question,create=false) {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/home'});
  const previous=Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(global,key,{configurable:true,writable:true,value});
  const {createRoot}=req('react-dom/client');let mounted;const navBefore=navigations.length;
  try {
    await React.act(async()=>{mounted=createRoot(document.getElementById('root'));mounted.render(React.createElement(Component,{initial:s,serverActorId:s.actorId}));});
    const input=document.querySelector('input[aria-label="エージェントへの依頼"]');
    await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,question);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    assert.equal(document.querySelector('button[type="submit"]').disabled,false);
    await React.act(async()=>input.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
    if(create) {assert.deepEqual(navigations.slice(navBefore),['/tenjikai']);return '';}
    assert.equal(navigations.length,navBefore,'Read questions must not navigate to a new plan wizard');
    const stepCount=document.querySelectorAll('section[aria-label] ol li').length;
    for(let i=0;i<stepCount;i++) await React.act(async()=>new Promise(resolve=>setTimeout(resolve,550)));
    await React.act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
    const agent=document.querySelector(name==='HomeDashboard'?'section[aria-label="やりたいことを頼む"]':'section[aria-label="経営エージェント"]');
    const answer=agent.querySelector('h3')?.parentElement;
    assert.ok(answer,'Actual agent answer must be rendered');
    return answer.textContent;
  } finally {if(mounted) await React.act(async()=>mounted.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor) Object.defineProperty(global,key,descriptor);else delete global[key];}}
}

test('saved Tenjikai facts use one scoped read in Home UI and agent; progress/restoration remain unavailable',async t=>{
  const oldError=console.error;console.error=()=>{};
  try {
    await t.test('actual read summary serializes saved project facts, same event/date distinct names and IDs',async()=>{
      reset();const s=JSON.parse(JSON.stringify(await summary()));
      assert.equal(s.tenjikai.state,'ready');assert.deepEqual(s.tenjikai.items.map(p=>[p.key,p.projectName,p.eventName,p.eventDate,p.daysUntil]),[
        ['tenjikai:project:a','開発部の出展条件','合同展示会','2026-10-21',0],['tenjikai:project:b','営業部の出展条件','合同展示会','2026-10-21',0],
      ]);assert.equal(current.calls.filter(c=>c.model==='tenjikaiProject').length,1);assert.equal(s.generatedAt,at.toISOString());assert.equal(s.popup.state,'ready');assert.equal(s.finance.income.state,'unused');
    });
    await t.test('reference and JST year/day boundaries are shared with Home generatedAt',async()=>{
      reset();current.projects=[{id:'a',userId:'viewer',name:'保存案件',eventName:'合同展示会',eventStart:new Date('2026-12-31T15:00:00Z')}];
      const s=await getHomeSummary('viewer',new Date('2026-12-31T15:00:00Z'));assert.equal(s.generatedAt,'2026-12-31T15:00:00.000Z');assert.equal(s.tenjikai.items[0].eventDate,'2027-01-01');assert.equal(s.tenjikai.items[0].daysUntil,0);
      const w=current.calls.find(c=>c.model==='tenjikaiProject').input.where.eventStart;assert.equal(w.gte.toISOString(),'2026-12-31T15:00:00.000Z');assert.equal(w.lt.getTime()-w.gte.getTime(),61*86400000);
    });
    for(const [name,Component] of dashboards) {
      await t.test(name+' facts only; names distinguish the same exhibition and date; entry only',async()=>{
        reset();const result=exhibitionCard(Component,await summary());assert.ok(result);for(const text of ['開発部の出展条件','営業部の出展条件','合同展示会','2026-10-21','JST','開発中','再表示する機能にはまだ対応していません']) assert.ok(result.text.includes(text),text);assert.deepEqual(result.links,['/tenjikai']);assertNoProgress(result.text);
      });
      await t.test(name+' ready empty hides without claiming unused/completed',async()=>{reset();current.projects=[];const s=await summary();assert.deepEqual(s.tenjikai,{state:'ready',items:[],href:'/tenjikai'});assert.equal(exhibitionCard(Component,s),null);});
      await t.test(name+' read error stays error/null but passive unlisted card hides',async()=>{
        for(const failure of [new Error('synthetic failure'),{code:'P2021'}]) {
          reset();current.projects=[];current.fail='tenjikaiProject';current.failure=failure;const s=await summary();
          assert.deepEqual(s.tenjikai,{state:'error',items:null,href:'/tenjikai'});assert.equal(exhibitionCard(Component,s),null);assert.equal(s.popup.state,'ready');
          const answer=planAgent('保存された展示会の出展条件は？',s);assert.match(answer.lead,/取得できませんでした/);assert.equal(answer.rows.length,0);assert.doesNotMatch(answer.lead,/未使用|0件|準備完了/);assertNoProgress(answer.lead);
          assert.match(card(Component,s).text,/1,000/);
        }
      });
      await t.test(name+' old snapshot without optional field still renders',async()=>{reset();const s=await summary();delete s.tenjikai;assert.equal(exhibitionCard(Component,s),null);});
      await t.test(name+' actual mounted saved question returns facts without navigation',async()=>{reset();const text=await mountedQuestion(Component,name,await summary(),'保存された展示会の出展条件は？');for(const value of ['開発部の出展条件','営業部の出展条件','合同展示会','2026-10-21','再表示する機能はまだ未対応']) assert.ok(text.includes(value),value);assertNoProgress(text);});
      await t.test(name+' actual mounted preparation question stays unavailable, no invented zeros',async()=>{reset();const text=await mountedQuestion(Component,name,await summary(),'展示会の予算とタスクの準備状況は？');assert.match(text,/まだ取得していません/);assertNoProgress(text);assert.ok(!text.includes('開発部の出展条件'));});
    }
    for(const [name,Component] of dashboards) {
      await t.test(name+' same error snapshot hides card but mounted explicit question reports failure',async()=>{
        reset();current.fail='tenjikaiProject';current.failure={code:'P2021'};const s=await summary();assert.equal(exhibitionCard(Component,s),null);
        const answer=await mountedQuestion(Component,name,s,'保存された展示会の出展条件は？');assert.match(answer,/取得できませんでした/);assert.doesNotMatch(answer,/未使用|0件|準備完了|1,000回|19回|1\.9%/);
      });
      await t.test(name+' same mounted ready-error-ready refresh clears old facts; keyed actor remount keeps them cleared',async()=>{
        reset();const ready=await summary();current.fail='tenjikaiProject';const error=await summary();current.fail=null;current.projects=current.projects.map(p=>({...p,name:'再取得した案件'+p.id}));const recovered=await summary();
        const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/home'});
        const previous=Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
        for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(global,key,{configurable:true,writable:true,value});
        const previousFetch=global.fetch;const localRequests=[];const responses=[error,recovered];
        global.fetch=async(url,options)=>{assert.equal(url,'/api/home/summary?expectedActor=viewer');assert.equal(options.cache,'no-store');localRequests.push(url);return {ok:true,json:async()=>responses.shift()};};
        const {createRoot}=req('react-dom/client');let mounted;
        const section=()=>document.querySelector('section[aria-label="保存された出展条件"]');
        const popup=()=>document.querySelector('section[aria-label="集客の数字（7日）"]')?.textContent;
        try {
          await React.act(async()=>{mounted=createRoot(document.getElementById('root'));mounted.render(React.createElement(Component,{initial:ready,serverActorId:ready.actorId,key:'actor-a'}));});
          assert.ok(section().textContent.includes('開発部の出展条件'));const priorPopup=popup();
          for(const expected of [null,'再取得した案件']) {
            const refresh=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('時点'));assert.ok(refresh);
            await React.act(async()=>refresh.click());
            if(expected===null) assert.ok(section()===null,'Tenjikai card must be absent after unavailable result');else {assert.ok(section().textContent.includes(expected));assert.ok(!section().textContent.includes('開発部の出展条件'));}
            assert.equal(popup(),priorPopup,'Popup output is unaffected by Tenjikai visibility changes');
          }
          assert.equal(localRequests.length,2);assert.equal(responses.length,0);
          await React.act(async()=>mounted.render(React.createElement(Component,{initial:{...error,user:{name:'Different synthetic actor',email:null}},serverActorId:error.actorId,key:'actor-b'})));
          assert.ok(section()===null,'Tenjikai card must be absent after unavailable result');assert.ok(!document.getElementById('root').textContent.includes('再取得した案件'));
        } finally {global.fetch=previousFetch;if(mounted) await React.act(async()=>mounted.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor) Object.defineProperty(global,key,descriptor);else delete global[key];}}
      });
    }
    await t.test('agent uses saved names and facts only, no detail links or guessed status',async()=>{
      reset();const s=await summary();const p=planAgent('保存された展示会の出展条件は？',s);assert.equal(p.intent,'tenjikai-saved');assert.deepEqual(p.rows.map(r=>r.label),['開発部の出展条件','営業部の出展条件']);assert.deepEqual(p.actions.map(a=>a.href),['/tenjikai']);assertNoProgress(p.rows.map(r=>r.value).join(' '));
    });
    await t.test('agent distinguishes empty, read failure and old snapshot',async()=>{
      reset();current.projects=[];const empty=planAgent('保存された展示会の出展条件は？',await summary());assert.equal(empty.rows.length,0);assert.match(empty.lead,/60日以内/);assert.doesNotMatch(empty.lead,/未使用|完了/);
      current.fail='tenjikaiProject';const failed=planAgent('保存された展示会の出展条件は？',await summary());assert.equal(failed.rows.length,0);assert.match(failed.lead,/取得できませんでした/);
      const old=await summary();delete old.tenjikai;assert.match(planAgent('保存された展示会の出展条件は？',old).lead,/未取得/);
    });
    for(const subject of ['支出','売上','契約','発注額','入金','クリック率']) {
      await t.test('explicit exhibition '+subject+' never falls through to another service',async()=>{
        reset();const s=await summary();const p=planAgent(`展示会の${subject}は？`,s);assert.equal(p.intent,'tenjikai-progress-unavailable');assert.equal(p.rows.length,0);assert.match(p.lead,/まだ取得していません/);assert.deepEqual(p.actions.map(a=>a.href),['/tenjikai']);
      });
      for(const [name,Component] of dashboards) await t.test(name+' mounted exhibition '+subject+' has no foreign numbers',async()=>{
        reset();const text=await mountedQuestion(Component,name,await summary(),`展示会の${subject}は？`);assert.match(text,/業務指標をまだ取得していません/);assertNoProgress(text);assert.doesNotMatch(text,/売上予定（|契約中のプラン|1,000回|19回|1\.9%/);
      });
    }
    await t.test('new Home retains exhibition creation navigation',async()=>{reset();await mountedQuestion(dashboards[0][1],'HomeDashboard',await summary(),'展示会の準備をしたい',true);});
    await t.test('read layer never expands into write, provider or background fetch',()=>{assert.deepEqual(writes,[]);assert.deepEqual(network,[]);});
  } finally {console.error=oldError;}
});
