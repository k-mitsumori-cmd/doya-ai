process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/pricing'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),tick=()=>new Promise(resolve=>setImmediate(resolve));
const warnings=[],originalError=console.error;console.error=(...args)=>warnings.push(args.map(String).join(' '));
(async()=>{
 let extraConsumer=false;let now=1000,seq=0,status='loading',data=null,visibility='visible',respond=async(url)=>Response.json(dtoFromUrl(url,true)),update=async()=>data,getSessionCheck=async()=>data;
 const requests=[],timers=new Map();class ClockDate extends Date{static now(){return now}}
 Object.defineProperty(document,'visibilityState',{get:()=>visibility,configurable:true});
 const clock={setTimeout:(fn,ms)=>{timers.set(++seq,{fn,at:now+ms});return seq},clearTimeout:id=>timers.delete(id)};
 const load=(file,mocks)=>{const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:output,require:name=>{assert.ok(name in mocks,'Unmocked '+name);return mocks[name]},window,document,Date:ClockDate,URLSearchParams,AbortController,TextDecoder,Uint8Array,fetch:(url,init)=>{requests.push({url,init});return respond(url,init)},console,...clock});return output};
 const helper=load('src/lib/trial-eligibility-client.ts',{});
 const auth={useSession:()=>({status,data,update:()=>update()}),getSession:()=>getSessionCheck()};
 const shared={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'next-auth/react':auth};
 const provider=load('src/components/TrialEligibilityProvider.tsx',{...shared,'react-dom':require('react-dom'),'@/lib/trial-eligibility-client':helper});
 const callout=load('src/components/TrialCallout.tsx',{...shared,'lucide-react':{Gift:()=>null,Sparkles:()=>null},'@/lib/unified-plan':{UNIFIED_TRIAL_DAYS:30},'@/components/TrialEligibilityProvider':provider});
 const LIMIT_EVENT='doya:service-limit';
 const limits=load('src/components/limits/ServiceLimitProvider.tsx',{...shared,'react-dom':require('react-dom'),'next/navigation':{usePathname:()=>window.location.pathname,useSearchParams:()=>new URLSearchParams(window.location.search)},'@/lib/service-limit-ui':{LIMIT_EVENT,observeServiceLimits:original=>original},'@/components/TrialCallout':callout,'@/lib/pricing':{HIGH_USAGE_CONTACT_URL:'/contact'},'@/lib/unified-plan':{isPaidPlan:plan=>plan!=='FREE'},'@/lib/plan-utils':{tierFrom:plan=>plan==='FREE'?'FREE':'PRO'}});
 window.fetch=async()=>Response.json({});
 const Hook=()=>React.createElement('span',null,callout.useTrialEligible()?'HOOK_TRUE':'HOOK_FALSE');
 const container=document.getElementById('root'),root=createRoot(container);
 const tree=()=>React.createElement(React.StrictMode,null,React.createElement(provider.TrialEligibilityProvider,null,React.createElement(limits.default),React.createElement(callout.TrialBadge),React.createElement(callout.TrialNote),React.createElement(callout.TrialInlineSuffix),React.createElement(Hook),extraConsumer&&React.createElement(callout.TrialBadge)));
 const render=()=>React.act(async()=>{root.render(tree());await tick();await tick()});
 const advance=ms=>React.act(async()=>{const target=now+ms;for(let i=0;i<50;i++){const due=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await tick();await tick()}now=target;await tick()});
 const event=(target,name,extra)=>React.act(async()=>{target.dispatchEvent(extra||new dom.window.Event(name));await tick();await tick()});
 const results=[];
 await render();assert.equal(requests.length,0);assert.ok(container.textContent.includes('HOOK_FALSE'));results.push('loading hidden');
 status='authenticated';data={user:{plan:'FREE',email:'a@example.invalid'}};await render();assert.equal(requests.length,0);results.push('missing ID hidden');
 data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();assert.equal(requests.length,1);assert.ok(container.textContent.includes('初月無料'));assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('shared strict-mode reader');
 await event(window,LIMIT_EVENT,new dom.window.CustomEvent(LIMIT_EVENT,{detail:{service:'seo',name:'SEO',pricingHref:'/seo/pricing',kind:'quota',message:'synthetic'}}));
 let dialog=document.querySelector('[role=dialog]');assert.ok(dialog);assert.match(dialog.textContent,/30日間無料/);assert.match(dialog.textContent,/対象プランを確認/);
 await event(window,'keydown',new dom.window.KeyboardEvent('keydown',{key:'Escape'}));results.push('actual ServiceLimitProvider uses confirmed trial');
 respond=async url=>Response.json(dtoFromUrl(url,false));await advance(60000);assert.equal(requests.length,2);assert.ok(container.textContent.includes('HOOK_FALSE'));await event(window,LIMIT_EVENT,new dom.window.CustomEvent(LIMIT_EVENT,{detail:{service:'seo',name:'SEO',pricingHref:'/seo/pricing',kind:'quota',message:'synthetic'}}));
 dialog=document.querySelector('[role=dialog]');assert.ok(dialog);assert.doesNotMatch(dialog.textContent,/30日間無料/);assert.match(dialog.textContent,/プラン・利用条件を確認/);
 await event(window,'keydown',new dom.window.KeyboardEvent('keydown',{key:'Escape'}));results.push('TTL false and ordinary CTA remains');
 status='loading';await render();assert.equal(container.textContent.includes('初月無料'),false);status='authenticated';await render();assert.equal(requests.length,3);results.push('A-loading-A new read');
 data={user:{id:'b',email:'b@example.invalid',plan:'FREE'}};await render();data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();assert.equal(requests.length,5);results.push('A-B-A new read');
 status='unauthenticated';data=null;await render();status='authenticated';data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();status='unauthenticated';data=null;await render();assert.equal(requests.length,8);results.push('guest-A-guest new read');
 visibility='hidden';await event(document,'visibilitychange');assert.ok(container.textContent.includes('HOOK_FALSE'));visibility='visible';respond=async url=>Response.json(dtoFromUrl(url,true));await event(document,'visibilitychange');assert.equal(requests.length,9);assert.ok(container.textContent.includes('HOOK_TRUE'),container.textContent);results.push('resume revalidates SDK and fetches one request');
 // Plan ABA and email changes cannot reuse a previous life or its pending work.
 status='authenticated';data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();
 const planBase=requests.length;const delayed=[];respond=()=>new Promise(resolve=>delayed.push(resolve));
 data={user:{id:'a',email:'a@example.invalid',plan:'PRO'}};await render();
 data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();
 assert.equal(requests.length,planBase+2);assert.ok(container.textContent.includes('HOOK_FALSE'));
 await React.act(async()=>{delayed[0](Response.json(dtoFromUrl(requests[planBase].url,true)));await tick()});assert.ok(container.textContent.includes('HOOK_FALSE'));
 await React.act(async()=>{delayed[1](Response.json(dtoFromUrl(requests[planBase+1].url,true)));await tick()});assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('FREE-PRO-FREE pending result isolated');
 const emailBase=requests.length;respond=async url=>Response.json(dtoFromUrl(url,true));data={user:{id:'a',email:'new@example.invalid',plan:'FREE'}};await render();assert.equal(requests.length,emailBase+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('email change starts fresh scope');
 extraConsumer=true;await render();assert.equal(requests.length,emailBase+1);extraConsumer=false;await render();assert.equal(requests.length,emailBase+1);results.push('new and removed consumer share provider read');
 // 409 keeps the first same-principal verification blocked; a later user focus may retry.
 status='authenticated';data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};
 respond=async()=>new Response(null,{status:409});update=async()=>data;await render();
 assert.ok(container.textContent.includes('HOOK_FALSE'));const conflictCount=requests.length;
 await tick();assert.equal(requests.length,conflictCount);results.push('409 same-principal immediate loop suppressed');
 update=async()=>{throw Error('synthetic SDK offline')};await event(window,'focus');assert.ok(container.textContent.includes('HOOK_FALSE'));const failureCount=requests.length;
 respond=async url=>Response.json(dtoFromUrl(url,true));update=async()=>data;await event(window,'focus');assert.equal(requests.length,failureCount+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('verification error later recovers through one focus');
 // BFCache pagehide invalidates synchronously, and pageshow waits for SDK verification.
 let completeUpdate;update=()=>new Promise(resolve=>{completeUpdate=resolve});
 await event(window,'pagehide');assert.ok(container.textContent.includes('HOOK_FALSE'));
 const hiddenCount=requests.length;await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));
 assert.equal(requests.length,hiddenCount);assert.ok(container.textContent.includes('HOOK_FALSE'));
 await React.act(async()=>{completeUpdate(data);await tick();await tick()});assert.equal(requests.length,hiddenCount+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('pagehide/pageshow persisted blocks until verified');
 // An earlier update(A) proof must not survive SDK B then A.
 const verifyResolvers=[];update=()=>new Promise(resolve=>verifyResolvers.push(resolve));
 await event(window,'pagehide');const beforeABA=requests.length;
 await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));assert.equal(verifyResolvers.length,1);
 data={user:{id:'b',email:'b@example.invalid',plan:'FREE'}};await render();
 data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};await render();assert.ok(verifyResolvers.length>=3);
 await React.act(async()=>{verifyResolvers[0]({user:{id:'a',email:'a@example.invalid',plan:'FREE'}});await tick()});
 assert.equal(requests.length,beforeABA);assert.ok(container.textContent.includes('HOOK_FALSE'));
 await React.act(async()=>{verifyResolvers.at(-1)(data);await tick();await tick()});
 assert.equal(requests.length,beforeABA+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('old update A rejected across SDK A-B-A');
 // NextAuth update itself emits loading with the old A session. One update must recover.
 let sdkUpdateCalls=0;const sdkResolvers=[];
 update=()=>{sdkUpdateCalls++;status='loading';return new Promise(resolve=>sdkResolvers.push(resolve))};
 await event(window,'pagehide');const beforeLoading=requests.length;
 await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));
 await render();assert.ok(container.textContent.includes('HOOK_FALSE'));assert.equal(sdkUpdateCalls,1);
 status='authenticated';data={user:{id:'a',email:'a@example.invalid',plan:'FREE'}};
 await React.act(async()=>{sdkResolvers[0](data);await tick();await tick()});await render();
 assert.equal(sdkUpdateCalls,1);assert.equal(requests.length,beforeLoading+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('own SDK loading roundtrip resumes with one verification and read');
 // Unknown is shared across all consumers, with only two automatic retries.
 update=async()=>data;respond=async()=>Response.json({code:'TRIAL_CHECK_UNAVAILABLE'},{status:503});
 data={user:{id:'unknown',email:'unknown@example.invalid',plan:'FREE'}};const unknownBase=requests.length;await render();
 assert.equal(requests.length,unknownBase+1);assert.ok(container.textContent.includes('HOOK_FALSE'));
 await advance(5000);await advance(15000);await advance(45000);
 assert.equal(requests.length,unknownBase+3);assert.ok(container.textContent.includes('HOOK_FALSE'));results.push('unknown shared retry twice then stops');
 // A hidden expiry does not fetch until a verified visible return.
 respond=async url=>Response.json(dtoFromUrl(url,true));data={user:{id:'hidden',email:'hidden@example.invalid',plan:'FREE'}};await render();
 assert.ok(container.textContent.includes('HOOK_TRUE'));visibility='hidden';await event(document,'visibilitychange');const hiddenBase=requests.length;
 await advance(60000);assert.equal(requests.length,hiddenBase);assert.ok(container.textContent.includes('HOOK_FALSE'));
 visibility='visible';await event(document,'visibilitychange');assert.equal(requests.length,hiddenBase+1);assert.ok(container.textContent.includes('HOOK_TRUE'));
 await event(window,'focus');await event(document,'visibilitychange');assert.equal(requests.length,hiddenBase+1);results.push('hidden expiry zero reads and duplicate resume one read');
 // A 409 with NextAuth's own loading must not restart the same request forever.
 let completeReauth;update=()=>{status='loading';return new Promise(resolve=>{completeReauth=resolve})};
 data={user:{id:'reauth',email:'reauth@example.invalid',plan:'FREE'}};status='authenticated';respond=async()=>new Response(null,{status:409});
 const reauthBase=requests.length;await render();assert.equal(requests.length,reauthBase+1);
 await render();assert.ok(container.textContent.includes('HOOK_FALSE'));
 await React.act(async()=>{completeReauth(data);await tick()});status='authenticated';await render();
 assert.equal(requests.length,reauthBase+1);assert.ok(container.textContent.includes('HOOK_FALSE'));results.push('409 own-loading same actor stays blocked without loop');
 update=async()=>data;respond=async url=>Response.json(dtoFromUrl(url,true));await event(window,'focus');
 assert.equal(requests.length,reauthBase+2);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('later explicit verification recovers reauth boundary');
 // Installed update() returns undefined for guests. getSession may return null;
 // the actual trial API must still confirm guest before the claim appears.
 status='unauthenticated';data=null;update=async()=>undefined;let guestChecks=0;getSessionCheck=async()=>{guestChecks++;return null};
 await render();const guestBase=requests.length;await event(window,'pagehide');assert.ok(container.textContent.includes('HOOK_FALSE'));
 await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));
 assert.equal(guestChecks,1);assert.equal(requests.length,guestBase+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('guest resume uses fresh session read and exact guest API');
 respond=async()=>new Response(null,{status:409});await event(window,'pagehide');const staleGuestBase=requests.length;
 await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));
 assert.equal(requests.length,staleGuestBase+1);assert.ok(container.textContent.includes('HOOK_FALSE'));
 await tick();assert.equal(requests.length,staleGuestBase+1);results.push('guest session-null alone cannot override actual API 409');
 respond=async url=>Response.json(dtoFromUrl(url,true));await event(window,'focus');
 assert.equal(requests.length,staleGuestBase+2);assert.ok(container.textContent.includes('HOOK_TRUE'));
 // getSession can report B before the SDK context catches up: keep trial hidden.
 getSessionCheck=async()=>({user:{id:'b',email:'b@example.invalid',plan:'FREE'}});
 await event(window,'pagehide');const lagBase=requests.length;
 await event(window,'pageshow',new dom.window.PageTransitionEvent('pageshow',{persisted:true}));
 assert.equal(requests.length,lagBase);assert.ok(container.textContent.includes('HOOK_FALSE'));
 status='authenticated';data={user:{id:'b',email:'b@example.invalid',plan:'FREE'}};update=async()=>data;await render();
 assert.equal(requests.length,lagBase+1);assert.ok(container.textContent.includes('HOOK_TRUE'));results.push('guest to authenticated waits for committed SDK and new API');
 await React.act(async()=>root.unmount());assert.equal(timers.size,0);assert.equal(warnings.length,0,JSON.stringify(warnings));results.push('cleanup');
 console.log(JSON.stringify({passed:results.length,results,scope:'Actual Trial provider and consumers mounted with React18 StrictMode/jsdom and synthetic auth/fetch/clock. No browser BFCache, DB or Stripe.'}));
})().catch(error=>{console.error=originalError;console.error(error);console.error(warnings);process.exitCode=1}).finally(()=>{console.error=originalError;dom.window.close()});
function dtoFromUrl(url,eligible){const q=new URL(url,'https://example.invalid').searchParams;return{version:1,principal:q.get('expectedKind')==='guest'?{kind:'guest'}:{kind:'authenticated',actorId:q.get('expectedActor')},eligible}}
