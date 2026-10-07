process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.invalid/seo/dashboard'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),unified=load('src/lib/unified-plan.ts'),plans=load('src/lib/plan-utils.ts'),services=load('src/lib/services.ts',{'./unified-plan':unified});
const lib=load('src/lib/service-limit-ui.ts',{'./services':services},{window,CustomEvent:dom.window.CustomEvent,URL,Request,TextDecoder,Uint8Array,setTimeout,clearTimeout});
const providerFile='src/components/limits/ServiceLimitProvider.tsx';
const providerSource=process.env.DOYA_TEST_BASELINE&&fs.existsSync(process.env.DOYA_TEST_BASELINE+'/'+providerFile)?fs.readFileSync(process.env.DOYA_TEST_BASELINE+'/'+providerFile,'utf8'):fs.readFileSync(providerFile,'utf8');
const providerCode=ts.transpileModule(providerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const tick=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}},results=[];
async function fixture(){let status='authenticated',session={user:{id:'alpha',plan:'FREE'}},reply=async()=>Response.json({code:'MONTHLY_LIMIT_REACHED',error:'今月の上限に達しました。'},{status:429}),closed=false;const original=async(...args)=>reply(...args);window.fetch=original;
 const exports={};
 const mocks={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'react-dom':require('react-dom'),'next-auth/react':{useSession:()=>({status,data:session})},'@/lib/service-limit-ui':lib,'@/components/TrialCallout':{TrialNote:()=>React.createElement('p',null,'30日間無料'),useTrialEligible:()=>true,TRIAL_DAYS:30},'@/lib/pricing':{HIGH_USAGE_CONTACT_URL:'https://doyamarke.surisuta.jp/contact'},'@/lib/unified-plan':unified,'@/lib/plan-utils':plans};
 vm.runInNewContext(providerCode,{exports,require:n=>{assert.ok(n in mocks,'Unmocked '+n);return mocks[n]},window,document,Set,Map,console},{filename:providerFile});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);const flush=async()=>{await tick();await tick();await tick()};const act=fn=>React.act(async()=>{await fn();await flush()});const render=()=>act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(exports.default))));await render();
 return{lib,act,render,auth:(s,u)=>{status=s;session=u},reply:fn=>reply=fn,dialog:()=>document.querySelector('[role=dialog]'),request:service=>act(()=>window.fetch('/api/'+service+'/generate')),close:()=>act(()=>{if(!closed){closed=true;root.unmount();container.remove();assert.equal(window.fetch,original)}})};
}
async function check(name,fn){if(process.env.DOYA_LIMIT_DEBUG)console.error('START',name);const f=await fixture();if(process.env.DOYA_LIMIT_DEBUG)console.error('MOUNTED',name);try{await fn(f);results.push({name,passed:true})}catch(e){if(!process.env.DOYA_TEST_BASELINE)throw e;results.push({name,passed:false,error:e.message})}finally{await f.close()}}
(async()=>{
 const baseline=[];
 for(const mode of ['shown-before-navigation','late-old-organization','late-round-trip']){
  const f=await fixture();
  try{
   window.history.replaceState({},'', '/sfa/alpha/deals');await f.render();
   const pending=deferred();let request;
   const response=()=>Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:true,upgradeUrl:'/sfa/pricing',error:'今月のAI実行上限に達しました。'},{status:402});
   if(mode==='shown-before-navigation'){f.reply(async()=>response());await f.request('sfa');assert.ok(f.dialog())}
   else{f.reply(()=>pending.promise);await f.act(()=>{request=window.fetch('/api/sfa/ai/next-action?org=alpha',{method:'POST'})})}
   window.history.replaceState({},'', '/sfa/beta/deals');await f.render();
   if(mode==='late-round-trip'){window.history.replaceState({},'', '/sfa/alpha/deals');await f.render()}
   if(mode!=='shown-before-navigation'){await f.act(()=>pending.resolve(response()));await request;await f.act(()=>{})}
   assert.ok(Boolean(f.dialog()),'Baseline no longer reproduces stale quota navigation');
   baseline.push({case:mode,oldOrgQuotaVisibleAfterNavigation:true,currentPath:window.location.pathname,action:f.dialog().querySelector('a')?.getAttribute('href')||null});
  }finally{await f.close()}
 }
 const crypto=require('node:crypto');console.log(JSON.stringify({checkedAt:new Date().toISOString(),confirmedCases:baseline.length,results:baseline,sourceHash:crypto.createHash('sha256').update(providerSource).digest('hex'),scope:'Actual global provider/classifier/fetch observer in StrictMode with synthetic session/quota and history navigation + explicit render. Confirms stale quota and wrong-org CTA across same-account navigation. Actual Next router transitions and private production behavior unproven.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
