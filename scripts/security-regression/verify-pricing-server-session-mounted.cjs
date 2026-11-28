(function(){
process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sourceRoot=process.env.DOYA_PRICING_SESSION_SOURCE_ROOT||path.resolve(__dirname,'../..'),output=process.env.DOYA_PRICING_SESSION_RESULT;
assert(sourceRoot);const dep=n=>require(path.join(sourceRoot,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const bindings={},results=[],warnings=[];global.fetch=async()=>{throw Error('Network outside synthetic test scope forbidden')};
const session=id=>id?{user:{id,email:id+'@example.invalid',name:'Synthetic '+id,plan:'PRO'},expires:'2099-01-01T00:00:00.000Z'}:null;
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
async function scenario(kind,strict){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/pricing'}),prior=new Map(),calls=[],cache=new Map(),classes=new Proxy({},{get:(_,k)=>String(k)});
 const state={server:session('owner-a'),view:(kind.startsWith('team')||kind==='same-owner-refresh-preserves-invite-draft')?'team':'legacy',throwSession:false};
 const outer=kind.includes('other-owner')||kind==='anonymous-stale-client'?session('owner-b'):null;
 if(kind==='anonymous-stale-client'||kind==='server-session-error'){state.server=null;state.view='new';state.throwSession=kind==='server-session-error';}
 if(kind==='missing-server-actor')state.server={user:{email:'missing@example.invalid',name:'Missing ID'},expires:'2099-01-01T00:00:00.000Z'};
 const pass=({children})=>children,none=()=>null,ctx=()=>React.createContext(null);
 let root,actualAuth,memberHold=null,billingHold=null;
 const nativeFetch=async(url,init={})=>{
  const requestPath=typeof url==='string'?url:new URL(url.url).pathname,method=init.method||'GET',owner=new Headers(init.headers).get('x-doya-owner');
  calls.push({path:requestPath,method,owner});if(requestPath.endsWith('/api/auth/_log'))return new Response(null,{status:204});assert.equal(method,'GET','No payment, invite or mutation allowed in session handoff fixture');
  if(requestPath.endsWith('/api/auth/session'))return Response.json(state.server||{});
  if(requestPath==='/api/pricing/billing'){if(billingHold){const held=billingHold;billingHold=null;return held.promise;}return Response.json({subscription:null,upcoming:null,invoices:[]});}
  if(requestPath==='/api/pricing/checkout-recovery')return Response.json({error:'Synthetic unsigned request'},{status:401});
  if(requestPath==='/api/pricing/seats')return Response.json({seats:3,used:2,interval:'month',monthly:18740,points:2400});
  if(requestPath==='/api/pricing/members'){
   if(kind==='member-api-denial-is-not-login')return Response.json({error:'Synthetic membership permission denied'},{status:403});
   assert(['owner-a','owner-b'].includes(owner),'Validated actor missing');
   if(memberHold){const held=memberHold;memberHold=null;return held.promise;}
   return Response.json({members:[],seatUsageUnavailable:false,kind:state.view==='team'?'team':'legacy',used:2,limit:state.view==='team'?3:1});
  }
  throw Error('Unbound synthetic request '+requestPath);
 };
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true,fetch:nativeFetch})){
  prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true});
 }
 const oldError=console.error;console.error=(...a)=>warnings.push({kind,strict,message:a.map(String).join(' ').slice(0,500)});
 try{
 actualAuth=dep('next-auth/react');
 const shellContextMocks={
  './company-context':{AccountCompanyContext:ctx()},'./ui-next-context':{ShellToolHrefsContext:ctx()},
  '@/components/doya-power/doya-power-context':{DoyaPowerContext:ctx()},'@/components/one-button/context':{OneButtonContext:ctx()},
  './power':{ShellPowerProvider:pass},'./low-power':{DoyaPowerFetchWatcher:none,ShellLowPowerNotice:none},
  '@/components/doya-power/fx-context':{DoyaPowerFxProvider:pass},
 };
 function resolveFile(name,file){const p=name.startsWith('@/')?'src/'+name.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),name));for(const ext of ['.ts','.tsx','/index.ts','/index.tsx'])if(fs.existsSync(path.join(sourceRoot,p+ext)))return p+ext;throw Error('Unbound source '+p);}
 function load(file){
  if(cache.has(file))return cache.get(file);
  const selectedFile=file==='src/app/pricing/page.tsx'&&process.env.DOYA_PRICING_PAGE_OVERRIDE?process.env.DOYA_PRICING_PAGE_OVERRIDE:path.join(sourceRoot,file);const text=fs.readFileSync(selectedFile,'utf8'),exports={};bindings[file]=crypto.createHash('sha256').update(text).digest('hex');cache.set(file,exports);
  const resolve=n=>{
   if(n==='react'||n==='react/jsx-runtime'||n==='react-dom')return dep(n);
   if(n==='next-auth/react')return actualAuth;
   if(n==='next-auth')return{getServerSession:async()=>{if(state.throwSession)throw Error('Synthetic session unavailable');return state.server;}};
   if(n==='@/lib/auth')return{authOptions:{}};
   if(n==='next/headers')return{cookies:async()=>({get:()=>undefined})};
   if(n==='@/lib/shell/company.server')return{getAccountCompanyName:async()=>({id:'synthetic-company',name:'Synthetic company'})};
   if(n==='@/lib/shell/tool-hrefs.server')return{shellToolHrefs:async()=>({})};
   if(n==='@/lib/pricing-v2/view.server')return{resolvePricingView:async()=>state.view,resolvePerSeatForView:async()=>false};
   if(n==='@/lib/pricing-v2/prices')return{powerPackPriceId:()=>null};
   if(n==='@/lib/doya-power/flag')return{doyaPowerLedgerAllowed:()=>false};
   if(n==='@/lib/support-chat/flag')return{isSupportChatEnabled:async()=>false};
   if(n==='next/navigation')return{usePathname:()=>'/pricing',useRouter:()=>({push:()=>{throw Error('Unexpected navigation')},replace:()=>{throw Error('Unexpected navigation')},refresh:()=>{}})};
   if(n==='next/link')return{__esModule:true,default:({children,href,prefetch,...props})=>React.createElement('a',{href,...props},children)};
   if(n==='lucide-react')return new Proxy({},{get:()=>none});
   if(n.endsWith('.module.css'))return{__esModule:true,default:classes};
   if(n==='@/components/TrialCallout')return{TrialNote:none,TrialBadge:none,useTrialEligible:()=>false};
   if(n==='@/lib/services')return{getListedServiceCount:()=>18};
   if(n==='@/components/ds')return{confirmDialog:()=>{throw Error('Unexpected financial confirmation')}};
   if(file==='src/components/shell/ShellGate.tsx'){
    if(n in shellContextMocks)return shellContextMocks[n];
    if(n==='./AppShell')return{__esModule:true,default:({children,actorKey,userName})=>React.createElement('div',{'data-shell-actor':actorKey},React.createElement('p',{'data-shell-name':true},userName),children)};
    if(n==='./registry')return{shouldShowShell:()=>true};
    if(['./ShellVitals','@/components/notice/NoticeProvider','@/components/notice/ShellNotices','@/components/notice/HandoffSuggest','@/components/notice/PowerOutNotices','@/components/support-chat/SupportChat','@/components/agent-chat/AgentChatProvider','@/components/agent-chat/AgentDock'].includes(n))return{__esModule:true,default:n.endsWith('Provider')?pass:none};
   }
   if(n==='@/components/pricing/PricingNext')return{__esModule:true,default:()=>{throw Error('Legacy-off page outside this fixture')}};
   if(n==='node:crypto')return crypto;
   if(n.startsWith('@/')||n.startsWith('.'))return load(resolveFile(n,file));
   throw Error('Unbound module '+n+' for '+file);
  };
  vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:resolve,console,Date,Promise,URL,URLSearchParams,Headers,Request,Response,AbortController,TextDecoder,Uint8Array,Array,Map,Set,Object,Error,Buffer,fetch:nativeFetch,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,crypto:crypto.webcrypto,setTimeout,clearTimeout,process:{env:{}}},{filename:file});
  return exports;
 }
 const Page=load('src/app/pricing/page.tsx').default;
 const render=async()=>{const page=await Page({searchParams:Promise.resolve({})});await React.act(async()=>{root.render(React.createElement(strict?React.StrictMode:React.Fragment,{},React.createElement(actualAuth.SessionProvider,{session:outer,refetchOnWindowFocus:false},page)));await flush();});};
 root=dep('react-dom/client').createRoot(dom.window.document.getElementById('root'));
 let heldMemberResolve,heldBillingResolve;
 if(kind==='late-members-after-owner-change')memberHold={promise:new Promise(r=>heldMemberResolve=r)};
 if(kind==='late-billing-after-owner-change')billingHold={promise:new Promise(r=>heldBillingResolve=r)};
 await render();
 const text=()=>dom.window.document.getElementById('root').textContent;
 const memberCalls=()=>calls.filter(c=>c.path==='/api/pricing/members');
 if(['anonymous-stale-client','server-session-error','missing-server-actor'].includes(kind)){
  assert.equal(memberCalls().length,0,'Unauthenticated or missing server actor cannot request members');
  assert(!text().includes('会社全体で使用中'));
 }else{
  assert(memberCalls().length>0,'Server-verified session must reach member consumer');
  assert(memberCalls().every(c=>c.owner==='owner-a'));
  assert(!text().includes('ログインして契約情報をご確認ください。'));
  assert(dom.window.document.querySelector('[data-shell-actor="owner-a"]'));
  if(state.view==='legacy'&&kind!=='late-members-after-owner-change'&&kind!=='member-api-denial-is-not-login')assert(text().includes('会社全体で使用中 2人 / 上限 1人'));
  if(kind==='member-api-denial-is-not-login'){assert(text().includes('Synthetic membership permission denied'));assert(!text().includes('会社全体で使用中'));}
  if(kind==='same-owner-refresh-preserves-invite-draft'){
   const input=dom.window.document.querySelector('input[type=email]');assert(input);
   await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'draft@example.invalid');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await flush();});
   assert(![...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='招待する').disabled,'React email state must update without submitting');
   state.server={...session('owner-a'),expires:'2099-01-02T00:00:00.000Z'};await render();assert.equal(dom.window.document.querySelector('input[type=email]').value,'draft@example.invalid','Same verified actor must retain its draft');
  }
  if(kind==='late-members-after-owner-change'){
   const before=calls.length;state.server=session('owner-b');await render();assert(calls.slice(before).some(c=>c.path==='/api/pricing/members'&&c.owner==='owner-b'));
   await React.act(async()=>{heldMemberResolve(Response.json({members:[{id:'retired-member',email:'retired-visible@example.invalid',role:'member',status:'active'}],seatUsageUnavailable:false,kind:'legacy',used:1,limit:1}));await flush();});
   assert(!text().includes('retired-visible@example.invalid'),'Retired member response must not reappear for new actor');
  }
  if(kind==='late-billing-after-owner-change'){
   state.server=session('owner-b');await render();
   await React.act(async()=>{heldBillingResolve(Response.json({subscription:null,upcoming:null,invoices:[{id:'retired-invoice',number:null,createdAt:'2026-01-01T00:00:00.000Z',total:123456789,status:'paid',url:null,pdf:null}]}));await flush();});
   assert(!text().includes('123,456,789'),'Retired invoice response must not reappear for new actor');
  }
  if(kind==='server-owner-change'){
   const before=calls.length;state.server=session('owner-b');await render();
   const later=calls.slice(before).filter(c=>c.path==='/api/pricing/members');assert(later.length>0,'New verified server actor must remount its initial session');
   assert(later.every(c=>c.owner==='owner-b'),'Old actor must not be used after server actor change');
   assert(dom.window.document.querySelector('[data-shell-actor="owner-b"]'));
  }
  if(kind==='server-signout'){
   const before=calls.length;state.server=null;state.view='new';await render();assert(!dom.window.document.querySelector('#manage'));assert.equal(calls.slice(before).filter(c=>c.path==='/api/pricing/members').length,0);
  }
 }
 assert(calls.every(c=>c.method==='GET'||c.path.endsWith('/api/auth/_log')));assert.equal(calls.filter(c=>c.path.endsWith('/api/auth/_log')).length,0,'Unexpected NextAuth client error telemetry');
 return{name:kind+(strict?' StrictMode':' normal'),passed:true,memberRequests:memberCalls().length,mutationRequests:0};
 }finally{
  if(root)await React.act(async()=>{root.unmount();await flush();});console.error=oldError;dom.window.close();
  for(const[k,v]of prior){if(v)Object.defineProperty(global,k,v);else delete global[k];}
 }
}
(async()=>{
 const kinds=['legacy-stale-unauthenticated','team-stale-unauthenticated','legacy-stale-other-owner','team-stale-other-owner','server-owner-change','server-signout','same-owner-refresh-preserves-invite-draft','late-members-after-owner-change','late-billing-after-owner-change','member-api-denial-is-not-login','anonymous-stale-client','server-session-error','missing-server-actor'];
 for(const strict of [false,true])for(const kind of kinds){try{const r=await scenario(kind,strict);results.push(r);}catch(e){results.push({name:kind+(strict?' StrictMode':' normal'),passed:false,error:e.message.slice(0,600)});}}
 assert.equal(results.length,26);const report={expectedCases:26,complete:results.length===26,applicationPageOverrideUsed:!!process.env.DOYA_PRICING_PAGE_OVERRIDE,checkedAt:new Date().toISOString(),sourceRoot,count:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results,sourceHashes:bindings,warnings,actualPricingPageShellGatePricingV2TeamManage:true,actualNextAuthSessionProviderAndUseSession:true,syntheticServerAuthAndFetch:true,authEndpointReturnsCurrentServerActor:true,nextAuthVersion:dep('next-auth/package.json').version,nextAuthReactSha256:crypto.createHash('sha256').update(fs.readFileSync(require.resolve(path.join(sourceRoot,'node_modules/next-auth/react')))).digest('hex'),realNextNavigationVerified:false,realServerCookiesOrJwtVerified:false,productionWrites:0,realPurchases:0,scope:'Actual async PricingPage, ShellGate, complete PricingV2/TeamManage and real NextAuth React provider with stale outer session. Server session/flags/company/storage and HTTP synthetic; decorative or disabled shell feature leaves substituted. React same-instance rerender simulates new server props; not actual Next routing/SSR or production authorization.'};
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,count:report.count}));if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
})();
