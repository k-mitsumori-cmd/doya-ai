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
const {renderToStaticMarkup,renderToString} = req('react-dom/server');
const {JSDOM} = req('jsdom');
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
  'next-auth/react':{useSession:()=>auth},
  'next-auth':{getServerSession:async()=>{if(routeFailure)throw Error('synthetic auth failure');return routeSession;}},
  '@/lib/auth':{authOptions:{}},
  '@/components/shell/AppShell':{__esModule:true,default:({children})=>children},
  'next/headers':{cookies:async()=>({get:()=>undefined})},
  '@/lib/ui-next':{isUiNext:async()=>pageNext},
  '@/lib/prisma':{prisma},
  '@/lib/home/finance-read':{loadHomeFinance:async()=>({month:'2026-10',income:{state:'unused',organization:null,value:null},expense:{state:'unused',organization:null,value:null}})},
  'next/link':{__esModule:true,default:Link},'next/navigation':{useRouter:()=>({push:href=>navigations.push(href)}),redirect:href=>{throw Error('redirect:'+href)},notFound:()=>{throw Error('production404')}},
  '@/components/shell/tools':{SHELL_GROUPS:[],shellGroups:()=>[]},
  '@/components/shell/icons':{ShellIcon:()=>null},
  '@/components/ds/motion':{CountUp:({value,format})=>React.createElement('span',null,format?format(value):value)},
  '@/components/ds/charts':{AreaChart:()=>null,Bars:()=>null},
  '@/components/shell/ShellCompanyCard':{CompanyRegisterButton:()=>null,ShellCompanyTag:()=>null},
  '@/components/shell/company-context':{useAccountCompany:()=>undefined},
  '@/components/shell/ui-next-context':{useToolHref:()=>x=>x},
  'lucide-react':new Proxy({}, {get:(_,key)=>key==='__esModule'?false:()=>React.createElement('svg')}),
};
let auth, routeSession, routeFailure=false, pageNext=false;
const cache=new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file).exports;
  const mod=new Module(file);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,mod);
  mod.require=id=>{
    const normalized=id.startsWith('.')?'@/'+path.relative(path.join(root,'src'),path.resolve(path.dirname(file),id)).replaceAll(path.sep,'/'):id;
    if(mocks[id]||mocks[normalized]) return mocks[id]||mocks[normalized];
    if(id.endsWith('.css')) return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};
    if(id.startsWith('@/')||id.startsWith('.')) {const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);for(const ext of ['.ts','.tsx']) if(fs.existsSync(base+ext)) return load(base+ext);}
    return req(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
  return mod.exports;
}
const source=relative=>load(path.join(root,relative));
const {getPopupSummary}=source('src/lib/popup/popup-read.ts');
const {getHomeSummary}=source('src/lib/home/summary.ts');
const {planAgent}=source('src/app/(shell)/home/agent.ts');
const dashboards=['HomeDashboard','HomeDashboardLegacy'].map(name=>[name,name]);
async function summary() {return getHomeSummary('viewer',at);}

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
function actorSummary(base,id,minute=0,label=id){return {...base,actorId:id,generatedAt:new Date(at.getTime()+minute*60000).toISOString(),user:{name:'PRIVATE_'+label,email:null}};}
async function harness(Component,run,{strict=false,loading=false,hydrate=false}={}) {
 reset();const base=await summary();const a=actorSummary(base,'a'),b=actorSummary(base,'b');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/home'});
 const previous=Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(global,key,{configurable:true,writable:true,value});
 const oldFetch=global.fetch;const requests=[],checks=[];let mounted,props={initial:a,serverActorId:'a'};
 const update=()=>{const d=deferred();checks.push(d);return d.promise;};
 auth={status:loading?'loading':'authenticated',data:loading?null:{user:{id:'a'}},update};
 global.fetch=(url,options)=>{assert.match(url,/^\/api\/home\/summary\?expectedActor=/);assert.equal(options.cache,'no-store');const d=deferred();requests.push({...d,url,signal:options.signal});return d.promise;};
 const {createRoot,hydrateRoot}=req('react-dom/client');const recoveries=[];Component=source(`src/app/(shell)/home/${Component}.tsx`).default;
 const render=async(next={},actor, status='authenticated')=>{props={...props,...next};if(actor!==undefined)auth={...auth,status,data:actor?{user:{id:actor}}:null};await React.act(async()=>{const element=React.createElement(Component,props);mounted.render(strict?React.createElement(React.StrictMode,null,element):element);});};
 const h={a,b,base,requests,checks,dom,recoveries,text:()=>document.getElementById('root').textContent,render,
 masked:()=>{assert.ok(!document.getElementById('root').textContent.includes('PRIVATE_'),'No private actor subtree while masked');assert.ok(Boolean(document.querySelector('[aria-label="ホームの認証確認"]')));},
 has:id=>assert.ok(document.getElementById('root').textContent.includes('PRIVATE_'+id),'Expected current private actor '+id),
 settle:async(i,data,status=200)=>React.act(async()=>requests[i].resolve(response(data,status))),
 retry:async()=>React.act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='再取得する');assert.ok(button);assert.equal(button.disabled,false);button.click();}),
 refresh:async()=>React.act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('時点'));assert.ok(button);if(button.disabled){const key=Object.keys(button).find(k=>k.startsWith('__reactProps$'));button[key].onClick();}else button.click();}),
 check:async(i,id)=>React.act(async()=>checks[i].resolve(id?{user:{id}}:null)),
 unmount:async()=>{await React.act(async()=>mounted.unmount());mounted=null;},
 hide:()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide',{persisted:true})),
 show:async()=>React.act(async()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true}))),
 server:()=>renderToStaticMarkup(React.createElement(Component,props)),
 };
 try {await React.act(async()=>{const element=React.createElement(Component,props);if(hydrate){document.getElementById('root').innerHTML=renderToString(element);assert.ok(!document.getElementById('root').textContent.includes('PRIVATE_'));mounted=hydrateRoot(document.getElementById('root'),element,{onRecoverableError:e=>recoveries.push(e.message)});}else{mounted=createRoot(document.getElementById('root'));mounted.render(strict?React.createElement(React.StrictMode,null,element):element);}});await run(h);}
 finally {global.fetch=oldFetch;if(mounted)await React.act(async()=>mounted.unmount());dom.window.close();for(const [key,d]of Object.entries(previous)){if(d)Object.defineProperty(global,key,d);else delete global[key];}}
}

test('Home actual actor boundary, API identity and private response contract',async t=>{
const originalError=console.error;console.error=()=>{};
try {
 for(const [name,Component]of dashboards){
 const check=(label,run,options)=>t.test(name+' '+label,()=>harness(Component,run,options));
 await check('unkeyed props and SDK actor switch masks immediately; only new GET admits B',async h=>{h.has('a');await h.render({initial:h.b,serverActorId:'b'},'b');h.masked();assert.equal(h.requests.length,1);assert.match(h.requests[0].url,/expectedActor=b$/);await h.settle(0,h.b);h.has('b');});
 await check('SDK loading and ABA cannot readmit original seed; actor A requires new GET',async h=>{await h.render({},null,'loading');h.masked();await h.render({},'a');h.masked();assert.equal(h.requests.length,1);await h.settle(0,actorSummary(h.base,'a',1,'freshA'));h.has('freshA');});
 await check('actor A-B-A rejects both old bodies and old catch/finally',async h=>{await h.refresh();await h.render({initial:h.b,serverActorId:'b'},'b');await h.render({initial:h.a,serverActorId:'a'},'a');assert.equal(h.requests.length,3);h.masked();await h.settle(1,h.b);await React.act(async()=>h.requests[0].reject(Error('old catch')));h.masked();assert.equal(document.querySelector('button').disabled,true);await h.settle(2,actorSummary(h.base,'a',2,'freshA'));h.has('freshA');});
 await check('body delayed beyond actor change rejects ignored-abort result',async h=>{const body=deferred();await h.refresh();await React.act(async()=>h.requests[0].resolve({ok:true,status:200,json:()=>body.promise}));await h.render({initial:h.b,serverActorId:'b'},'b');await h.settle(1,h.b);h.has('b');await React.act(async()=>body.resolve(h.a));h.has('b');assert.ok(h.requests[0].signal.aborted);});
 await check('old 401 headers cannot mask or navigate current B',async h=>{const before=navigations.length;await h.refresh();await h.render({initial:h.b,serverActorId:'b'},'b');await h.settle(1,h.b);await h.settle(0,null,401);h.has('b');assert.equal(navigations.length,before);});
 await check('same actor newer props and refresh timestamps never roll back',async h=>{await h.refresh();const newer=actorSummary(h.base,'a',5,'props5');await h.render({initial:newer});h.has('props5');await h.settle(0,actorSummary(h.base,'a',1,'old1'));h.has('props5');await h.render({initial:h.a});h.has('props5');await h.refresh();await h.settle(1,actorSummary(h.base,'a',6,'refresh6'));h.has('refresh6');await h.render({initial:newer});h.has('refresh6');});
 await check('same actor HTTP500 retains only previous snapshot with explicit age; network fails closed',async h=>{await h.refresh();await h.settle(0,null,500);h.has('a');assert.match(h.text(),/前回の取得時刻/);await h.refresh();await React.act(async()=>h.requests[1].reject(Error('offline')));h.masked();});
 await check('mismatched or absent body actor and malformed JSON mask',async h=>{await h.refresh();await h.settle(0,h.b);h.masked();await h.retry();await h.check(0,'a');await h.settle(1,{...h.a,actorId:undefined});h.masked();await h.retry();await h.check(1,'a');await React.act(async()=>h.requests[2].resolve({ok:true,status:200,json:async()=>{throw Error('bad json')}}));h.masked();});
 await check('stale server props wait recovers through real session confirmation, never adopts old seed',async h=>{await h.render({initial:h.b,serverActorId:'b'},'b');await h.settle(0,h.b);await h.render({initial:h.a,serverActorId:'a'});h.masked();assert.equal(h.requests.length,1);await h.retry();assert.equal(h.checks.length,1);await h.check(0,'b');assert.equal(h.requests.length,2);h.masked();await h.settle(1,actorSummary(h.base,'b',3,'freshB'));h.has('freshB');});
 for(const status of [401,409])await check(status+' retry refreshes session then waits for SDK match before new GET',async h=>{await h.refresh();await h.settle(0,null,status);h.masked();await h.retry();await h.check(0,'b');h.masked();assert.equal(h.requests.length,1);await h.render({},'b');h.masked();assert.equal(h.requests.length,2);assert.match(h.requests[1].url,/expectedActor=b$/);await h.settle(1,h.b);h.has('b');});
 await check('pagehide synchronously masks before dispatch returns; BFCache requires session proof and fresh GET',async h=>{h.has('a');await React.act(async()=>{h.hide();h.masked();});assert.equal(h.requests.length,0);await h.show();assert.equal(h.checks.length,1);h.masked();await h.check(0,'a');h.masked();assert.equal(h.requests.length,1);await h.settle(0,actorSummary(h.base,'a',4,'afterCache'));h.has('afterCache');});
 await check('BFCache returned actor B with cached SDK A stays masked until SDK B and new summary',async h=>{await React.act(async()=>h.hide());await h.show();await h.check(0,'b');h.masked();assert.equal(h.requests.length,0);await h.render({},'b');h.masked();assert.equal(h.requests.length,1);await h.settle(0,h.b);h.has('b');});
 await check('StrictMode re-effect then post-unmount fetch/body/session callbacks cannot render or navigate',async h=>{const body=deferred();await h.refresh();await React.act(async()=>h.requests[0].resolve({ok:true,status:200,json:()=>body.promise}));await React.act(async()=>h.hide());await h.show();await h.unmount();const before=navigations.length;await React.act(async()=>{body.resolve(h.a);h.checks[0].resolve({user:{id:'a'}})});assert.equal(document.getElementById('root').textContent,'');assert.equal(navigations.length,before);},{strict:true});
 await check('SSR unseeded SDK loading hydrates privacy mask without recoveries; authenticated epoch fetches',async h=>{h.masked();assert.ok(!h.server().includes('PRIVATE_'));await h.render({},'a');h.masked();assert.equal(h.requests.length,1);await h.settle(0,h.a);h.has('a');assert.deepEqual(h.recoveries,[]);},{loading:true,hydrate:true});
 await check('server actor/body mismatch and missing SDK ID remain masked until fresh actor GET',async h=>{await h.render({initial:h.b,serverActorId:'a'});h.masked();await h.render({},'', 'authenticated');h.masked();await h.render({},'a');h.masked();await h.settle(h.requests.length-1,h.a);h.has('a');});
 await check('unauthenticated epoch clears seed and old data before authenticated recovery',async h=>{await h.render({},null,'unauthenticated');h.masked();assert.match(h.text(),/ログインが必要/);await h.render({},'a');h.masked();await h.settle(0,actorSummary(h.base,'a',3,'afterLogin'));h.has('afterLogin');});
 await check('same actor reverse refresh order and ignored cancellation preserve latest request',async h=>{await h.refresh();await h.refresh();assert.equal(h.requests.length,2);assert.ok(h.requests[0].signal.aborted);await h.settle(1,actorSummary(h.base,'a',4,'new4'));h.has('new4');await h.settle(0,actorSummary(h.base,'a',8,'late8'));h.has('new4');});
 await check('a failed session confirmation stays masked and a new explicit confirmation recovers',async h=>{await h.refresh();await h.settle(0,null,409);await h.retry();await React.act(async()=>h.checks[0].reject(Error('session unavailable')));h.masked();await h.retry();await h.check(1,'a');h.masked();await h.settle(1,actorSummary(h.base,'a',3,'retried'));h.has('retried');});
 await check('old session proof cannot supersede a newer BFCache confirmation',async h=>{await React.act(async()=>h.hide());await h.show();await React.act(async()=>h.hide());await h.show();await h.check(1,'b');await h.render({},'b');assert.equal(h.requests.length,1);await h.check(0,'a');await h.settle(0,h.b);h.has('b');});
 await check('actual old agent timer, submit and action closures are rejected after actor change',async h=>{
  const oldSet=global.setTimeout, oldClear=global.clearTimeout, timers=[];global.setTimeout=(fn,ms,...args)=>{if(ms===520){const token={fn:()=>fn(...args)};timers.push(token);return token;}return oldSet(fn,ms,...args);};global.clearTimeout=id=>{if(!timers.includes(id))oldClear(id);};
  try{const input=document.querySelector('input[aria-label="エージェントへの依頼"]');await React.act(async()=>{Object.getOwnPropertyDescriptor(h.dom.window.HTMLInputElement.prototype,'value').set.call(input,'保存された展示会の出展条件は？');input.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));});
   const form=input.closest('form');const propsKey=Object.keys(form).find(k=>k.startsWith('__reactProps$'));const oldSubmit=form[propsKey].onSubmit;
   await React.act(async()=>form.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true})));
   assert.ok(timers.length>0,'Actual agent scheduled its plan step');
   const action=document.querySelector('a[href="/pricing"]');const actionProps=action[Object.keys(action).find(k=>k.startsWith('__reactProps$'))];const oldAction=actionProps.onClick;
   await h.render({initial:h.b,serverActorId:'b'},'b');h.masked();let prevented=false;const navBefore=navigations.length;
   await React.act(async()=>{for(const timer of timers)timer.fn();oldSubmit({preventDefault(){}});oldAction({preventDefault(){prevented=true;},stopPropagation(){}});});h.masked();assert.ok(prevented);assert.equal(navigations.length,navBefore);
   await h.settle(0,h.b);h.has('b');assert.equal(Boolean(document.querySelector('section[aria-label] ol')),false,'Old agent run must not migrate into actor B');
  }finally{global.setTimeout=oldSet;global.clearTimeout=oldClear;}
 });
 for(const outcome of ['resolve','reject'])for(const transition of ['B','ABA'])await check('pending session '+outcome+' cannot affect external actor '+transition+' metadata',async h=>{
   await h.refresh();await h.settle(0,null,409);await h.retry();assert.equal(h.checks.length,1);
   await h.render({initial:h.b,serverActorId:'b'},'b');h.masked();assert.equal(h.requests.length,2);if(transition==='ABA')await h.render({initial:h.a,serverActorId:'a'},'a');assert.equal(document.querySelector('button').disabled,true);
   await React.act(async()=>outcome==='resolve'?h.checks[0].resolve({user:{id:'a'}}):h.checks[0].reject(Error('old session rejected')));
   h.masked();assert.ok(!h.text().includes('再確認できませんでした'));assert.equal(document.querySelector('button').disabled,true,'Old finally cannot change new loading');
   if(transition==='B'){await h.settle(1,h.b);h.has('b');}else{await h.settle(2,actorSummary(h.base,'a',2,'freshABA'));h.has('freshABA');}
 });
 await check('session update SDK loading to new B discards old promise but recovers through actor-bound GET',async h=>{
  await h.refresh();await h.settle(0,null,401);await h.retry();await h.render({},null,'loading');h.masked();await h.render({initial:h.b,serverActorId:'b'},'b');h.masked();assert.equal(h.requests.length,2);
  await h.check(0,'a');h.masked();assert.equal(document.querySelector('button').disabled,true);await h.settle(1,h.b);h.has('b');
 });
 await check('StrictMode preserves current success and new actor request',async h=>{h.has('a');await h.render({initial:h.b,serverActorId:'b'},'b');h.masked();await h.settle(h.requests.length-1,h.b);h.has('b');},{strict:true});
 }
 const {GET}=source('src/app/api/home/summary/route.ts');
 const request=id=>({nextUrl:new URL('https://example.test/api/home/summary'+(id===undefined?'':'?expectedActor='+id))});
 const privateResponse=result=>{assert.match(result.headers.get('cache-control'),/private/);assert.match(result.headers.get('cache-control'),/no-store/);assert.match(result.headers.get('vary'),/Cookie/);};
 await t.test('API requires actual authenticated actor before expectedActor and aggregates no unauthorized input',async()=>{reset();routeSession=null;let result=await GET(request('viewer'));assert.equal(result.status,401);privateResponse(result);assert.equal(current.calls.length,0);routeSession={user:{id:'viewer'}};for(const id of [undefined,'foreign']){result=await GET(request(id));assert.equal(result.status,409);privateResponse(result);}assert.equal(current.calls.length,0);});
 await t.test('API success carries authenticated actor, private headers and no writes; partial read failure retains actor',async()=>{reset();routeSession={user:{id:'viewer'}};let result=await GET(request('viewer'));assert.equal(result.status,200);privateResponse(result);assert.equal((await result.json()).actorId,'viewer');current.fail='user';result=await GET(request('viewer'));assert.equal(result.status,200);assert.equal((await result.json()).actorId,'viewer');assert.deepEqual(writes,[]);});
 await t.test('API auth failure is private 500',async()=>{routeFailure=true;try{const result=await GET(request('viewer'));assert.equal(result.status,500);privateResponse(result);}finally{routeFailure=false;}});
 await t.test('actual server page connects actor ID and key to both actual UI branches; missing auth redirects',async()=>{reset();const Page=source('src/app/(shell)/home/page.tsx').default;routeSession={user:{id:'viewer'}};for(const [flag,Component]of [[true,dashboards[0][1]],[false,dashboards[1][1]]]){pageNext=flag;const element=await Page();assert.equal(element.type,source(`src/app/(shell)/home/${Component}.tsx`).default);assert.equal(element.key,'viewer');assert.equal(element.props.serverActorId,'viewer');assert.equal(element.props.initial.actorId,'viewer');}routeSession=null;await assert.rejects(Page(),/redirect:\/auth\/signin/);assert.deepEqual(network,[]);assert.deepEqual(writes,[]);});
 await t.test('development sample stays serializable and DB-free behind original production 404',()=>{reset();const Preview=source('src/app/(shell)/home/preview/page.tsx').default;const oldEnv=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.throws(()=>Preview(),/production404/);assert.equal(current.calls.length,0);process.env.NODE_ENV='test';const element=Preview();const preview=element.props.children;assert.deepEqual(Object.keys(preview.props),['initial']);assert.equal(preview.props.initial.actorId,'development-preview-sample');assert.doesNotThrow(()=>JSON.stringify(preview.props));const html=renderToStaticMarkup(element);assert.match(html,/サンプル/);assert.equal(current.calls.length,0);assert.deepEqual(network,[]);}finally{process.env.NODE_ENV=oldEnv;}});
}finally{console.error=originalError;}
});
