process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom'),{load}=require('./load-typescript.cjs');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.invalid/seo/dashboard'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),unified=load('src/lib/unified-plan.ts'),plans=load('src/lib/plan-utils.ts'),services=load('src/lib/services.ts',{'./unified-plan':unified});
const lib=load('src/lib/service-limit-ui.ts',{'./services':services},{window,CustomEvent:dom.window.CustomEvent,URL,Request,TextDecoder,Uint8Array,setTimeout,clearTimeout});
const providerFile='src/components/limits/ServiceLimitProvider.tsx';
const providerSource=process.env.DOYA_TEST_BASELINE&&fs.existsSync(process.env.DOYA_TEST_BASELINE+'/'+providerFile)?fs.readFileSync(process.env.DOYA_TEST_BASELINE+'/'+providerFile,'utf8'):fs.readFileSync(providerFile,'utf8');
const providerCode=ts.transpileModule(providerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const tick=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}},results=[];
async function fixture(){window.history.replaceState({},'', '/seo/dashboard');let status='authenticated',session={user:{id:'alpha',plan:'FREE'}},reply=async()=>Response.json({code:'MONTHLY_LIMIT_REACHED',error:'今月の上限に達しました。'},{status:429}),closed=false;const original=async(...args)=>reply(...args);window.fetch=original;
 const exports={};
 const mocks={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'react-dom':require('react-dom'),'next/navigation':{usePathname:()=>window.location.pathname,useSearchParams:()=>new URLSearchParams(window.location.search)},'next-auth/react':{useSession:()=>({status,data:session})},'@/lib/service-limit-ui':lib,'@/components/TrialCallout':{TrialNote:()=>React.createElement('p',null,'30日間無料'),useTrialEligible:()=>true,TRIAL_DAYS:30},'@/lib/pricing':{HIGH_USAGE_CONTACT_URL:'https://doyamarke.surisuta.jp/contact'},'@/lib/unified-plan':unified,'@/lib/plan-utils':plans};
 vm.runInNewContext(providerCode,{exports,require:n=>{assert.ok(n in mocks,'Unmocked '+n);return mocks[n]},window,document,Set,Map,console},{filename:providerFile});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);const flush=async()=>{await tick();await tick();await tick()};const act=fn=>React.act(async()=>{await fn();await flush()});const render=()=>act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(exports.default))));await render();
 return{lib,act,render,navigate:path=>{window.history.replaceState({},'',path);return render()},auth:(s,u)=>{status=s;session=u},reply:fn=>reply=fn,dialog:()=>document.querySelector('[role=dialog]'),request:service=>act(()=>window.fetch('/api/'+service+'/generate')),close:()=>act(()=>{if(!closed){closed=true;root.unmount();container.remove();assert.equal(window.fetch,original)}})};
}
async function check(name,fn){if(process.env.DOYA_LIMIT_DEBUG)console.error('START',name);const f=await fixture();if(process.env.DOYA_LIMIT_DEBUG)console.error('MOUNTED',name);try{await fn(f);results.push({name,passed:true})}catch(e){if(!process.env.DOYA_TEST_BASELINE)throw e;results.push({name,passed:false,error:e.message})}finally{await f.close()}}
(async()=>{
 const active=services.getActiveServices();assert.equal(active.length,18);
 for(const s of active){
  await check(s.id+' recognized quota shows current service and next action',async f=>{await f.request(s.id);assert.ok(f.dialog());assert.ok(f.dialog().textContent.includes(s.name));const link=f.dialog().querySelector('a');assert.ok(link);assert.equal(link.getAttribute('href'),s.pricingHref);assert.match(f.dialog().textContent,/30日間無料/)});
  await check(s.id+' old notice never returns after alpha beta alpha',async f=>{await f.request(s.id);assert.ok(f.dialog());f.auth('authenticated',{user:{id:'beta',plan:'FREE'}});await f.render();assert.equal(Boolean(f.dialog()),false);f.auth('authenticated',{user:{id:'alpha',plan:'FREE'}});await f.render();assert.equal(Boolean(f.dialog()),false)});
 }

 for(const service of active){
  await check(service.id+' navigation hides previous view notice and returning does not revive it',async f=>{await f.request(service.id);assert.ok(f.dialog());await f.navigate('/'+service.id+'/another-view');assert.equal(Boolean(f.dialog()),false);await f.navigate('/seo/dashboard');assert.equal(Boolean(f.dialog()),false)});
  await check(service.id+' new view still shows a fresh quota action',async f=>{await f.navigate('/'+service.id+'/another-view');await f.request(service.id);assert.ok(f.dialog());assert.ok(f.dialog().textContent.includes(service.name))});
 }
 for(const [name,from,to,back] of [
  ['path organization','/sfa/alpha/deals','/sfa/beta/deals',false],
  ['path organization round trip','/sfa/alpha/deals','/sfa/beta/deals',true],
  ['query organization','/quote/settings?org=alpha','/quote/settings?org=beta',false],
  ['query organization round trip','/quote/settings?org=alpha','/quote/settings?org=beta',true],
  ['service navigation','/seo/dashboard','/persona',false],
 ]) await check('Late quota suppressed across '+name,async f=>{await f.navigate(from);const pending=deferred();f.reply(()=>pending.promise);let request;await f.act(()=>{request=window.fetch('/api/sfa/ai/next-action?org=alpha',{method:'POST'})});await f.navigate(to);if(back)await f.navigate(from);await f.act(()=>pending.resolve(Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:true,upgradeUrl:'/sfa/pricing',error:'今月のAI実行上限に達しました。'},{status:402})));await request;await f.act(()=>{});assert.equal(Boolean(f.dialog()),false)});
 await check('Path organization keeps current billing owner action',async f=>{await f.navigate('/sfa/beta/deals');f.reply(async()=>Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:true,upgradeUrl:'/sfa/pricing',error:'今月のAI実行上限に達しました。'},{status:402}));await f.request('sfa');assert.equal(f.dialog().querySelector('a').getAttribute('href'),'/sfa/pricing?org=beta')});

 for(const [path,href] of [
  ['/sfa/pricing?org=alpha','/sfa/pricing?org=alpha'],
  ['/sfa/pricing/?org=alpha','/sfa/pricing?org=alpha'],
  ['/sfa/'+encodeURIComponent('日本語')+'/deals','/sfa/pricing?org='+encodeURIComponent('日本語')],
  ['/sfa/pricing','/sfa/pricing'],
  ['/sfa/invite/synthetic-token','/sfa/pricing'],
  ['/sfa/pricing?org='+encodeURIComponent('日本語&scope=別組織'),'/sfa/pricing?org='+encodeURIComponent('日本語&scope=別組織')],
 ])await check('SFA pricing scope follows actual route '+path,async f=>{await f.navigate(path);f.reply(async()=>Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:true,upgradeUrl:'/sfa/pricing',error:'今月のAI実行上限に達しました。'},{status:402}));await f.request('sfa');assert.equal(f.dialog().querySelector('a').getAttribute('href'),href)});
 await check('Current non-owner never receives pricing action',async f=>{await f.navigate('/sfa/beta/deals');f.reply(async()=>Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:false,error:'組織の契約者にご相談ください。'},{status:402}));await f.request('sfa');assert.ok(f.dialog());assert.equal(Boolean(f.dialog().querySelector('a[href*="pricing"]')),false)});
 await check('Query organization notice hides immediately on query-only navigation',async f=>{await f.navigate('/quote/settings?org=alpha');await f.request('quote');assert.ok(f.dialog());await f.navigate('/quote/settings?org=beta');assert.equal(Boolean(f.dialog()),false)});
 await check('Late previous-account quota response does not show for new account',async f=>{const pending=deferred();f.reply(()=>pending.promise);let request;await f.act(()=>{request=window.fetch('/api/seo/generate')});f.auth('authenticated',{user:{id:'beta',plan:'FREE'}});await f.render();await f.act(()=>pending.resolve(Response.json({code:'MONTHLY_LIMIT_REACHED',error:'今月の上限に達しました。'},{status:429})));await request;assert.equal(Boolean(f.dialog()),false)});
 await check('FREE PRO FREE transitions do not revive an old free notice',async f=>{await f.request('seo');f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();assert.equal(Boolean(f.dialog()),false);f.auth('authenticated',{user:{id:'alpha',plan:'FREE'}});await f.render();assert.equal(Boolean(f.dialog()),false)});
 await check('Guest login logout transitions do not revive old login prompt',async f=>{f.auth('unauthenticated',null);await f.render();await f.request('seo');assert.match(f.dialog().textContent,/無料登録・ログイン/);f.auth('authenticated',{user:{id:'alpha',plan:'FREE'}});await f.render();assert.equal(Boolean(f.dialog()),false);f.auth('unauthenticated',null);await f.render();assert.equal(Boolean(f.dialog()),false)});
 await check('Explicit quota event remains usable; Escape dismisses and restores focus',async f=>{const button=document.createElement('button');document.body.append(button);button.focus();await f.act(()=>f.lib.showServiceLimit('/api/seo/generate',429,{code:'MONTHLY_LIMIT_REACHED',error:'今月の上限に達しました。'}));assert.ok(f.dialog());assert.equal(document.activeElement===f.dialog(),true);await f.act(()=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));assert.equal(Boolean(f.dialog()),false);assert.equal(document.activeElement===button,true);button.remove()});

 {
  let ready=false;const held=deferred(),exports={};
  const mocks={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next-auth/react':{SessionProvider:({children})=>children},'@/components/limits/ServiceLimitProvider':{__esModule:true,default:()=>{if(!ready)throw held.promise;return React.createElement('aside',{id:'quota-ready'},'quota ready')}}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/Providers.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n]}});
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  try{await React.act(async()=>{root.render(React.createElement(exports.Providers,null,React.createElement('main',{id:'application-ready'},'application ready')));await tick()});assert.ok(container.querySelector('#application-ready'));assert.equal(Boolean(container.querySelector('#quota-ready')),false);await React.act(async()=>{ready=true;held.resolve();await tick();await tick()});assert.ok(container.querySelector('#application-ready'));assert.ok(container.querySelector('#quota-ready'));results.push({name:'Actual root boundary keeps application rendered while quota navigation hooks suspend',passed:true})}finally{await React.act(async()=>root.unmount());container.remove()}
 }

 for(const field of ['bannerPlan','seoPlan','kantanPlan','interviewPlan','openingPlan','doyalistPlan','kintaiPlan']) {
  const session=plan=>({user:{id:'alpha',plan:'FREE',[field]:plan}});
  await check(field+' change hides current notice immediately',async f=>{f.auth('authenticated',session('FREE'));await f.render();await f.request('seo');assert.ok(f.dialog());f.auth('authenticated',session('PRO'));await f.render();assert.equal(Boolean(f.dialog()),false)});
  await check(field+' round trip never revives previous notice',async f=>{f.auth('authenticated',session('FREE'));await f.render();await f.request('seo');assert.ok(f.dialog());f.auth('authenticated',session('PRO'));await f.render();f.auth('authenticated',session('FREE'));await f.render();assert.equal(Boolean(f.dialog()),false)});
  await check(field+' delayed earlier response is rejected through plan ABA',async f=>{f.auth('authenticated',session('FREE'));await f.render();const pending=deferred();f.reply(()=>pending.promise);let task;await f.act(()=>{task=window.fetch('/api/seo/articles',{method:'POST'})});f.auth('authenticated',session('PRO'));await f.render();f.auth('authenticated',session('FREE'));await f.render();await f.act(()=>pending.resolve(Response.json({code:'SEO_ARTICLE_LIMIT',error:'今月の生成回数の上限に達しました（3回/月）。',upgradeUrl:'/seo/pricing'},{status:429})));await task;await f.act(()=>{});assert.equal(Boolean(f.dialog()),false)});
  await check(field+' new current plan still receives a fresh quota action',async f=>{f.auth('authenticated',session('PRO'));await f.render();await f.request('seo');assert.ok(f.dialog());assert.equal(f.dialog().querySelector('a').getAttribute('href'),'/seo/pricing')});
 }
 assert.equal(results.length,119,'All previous91 checks and28 service-plan regressions must run');
 const sourceFiles=['src/components/limits/ServiceLimitProvider.tsx','src/components/Providers.tsx','src/lib/service-limit-ui.ts','src/lib/services.ts','src/lib/unified-plan.ts','src/lib/plan-utils.ts'];
 const report={checkedAt:new Date().toISOString(),expected:119,passed:results.filter(r=>r.passed).length,cases:results,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,require('node:crypto').createHash('sha256').update(f===providerFile?providerSource:fs.readFileSync(f)).digest('hex')])),scope:'Actual shared provider/classifier/fetch observer and root Suspense boundary mounted with synthetic sessions/quota replies and mocked Next navigation/trial eligibility;18 active service IDs, path/query/actor/unified-plan transitions and all7 actual independent session service-plan transitions including delayed/ABA replies. Actual Next/browser/customer/provider operations remain unverified.'};
 const output=require('node:path').resolve('docs/audits/2026-10-06-all-services-recheck');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/service-limit-plan-'+(process.env.DOYA_TEST_BASELINE?'overlay':'integrated')+'-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.passed===report.expected?0:1;

})().catch(e=>{console.error(e);process.exitCode=1});
