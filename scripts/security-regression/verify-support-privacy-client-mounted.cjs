process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const sourceFiles={'AppShell.tsx':path.join(repo,'src/components/shell/AppShell.tsx'),'ShellGate.tsx':path.join(repo,'src/components/shell/ShellGate.tsx'),'SupportChat.tsx':path.join(repo,'src/components/support-chat/SupportChat.tsx')};
const sources=Object.fromEntries(Object.entries(sourceFiles).map(([k,f])=>[k,fs.readFileSync(f,'utf8')]));
async function scenario(strict,kind){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid/kintai/clock'}),prior=new Map(),calls=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 const pass=({children})=>children,none=()=>null,context=()=>React.createContext(null),home={id:'home',href:'/home',name:'Home',hint:'home',icon:'Home'};
 let actor='A',root;const cache={},held=[];dom.window.sessionStorage.setItem('doya:support-chat:draft','SYNTHETIC-LEGACY-PRIVATE-DRAFT');dom.window.sessionStorage.setItem('doya:support-chat:draft:v2:synthetic-B','SYNTHETIC-B-PREVIOUS-DRAFT');
 function load(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;const output=ts.transpileModule(sources[file],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(output,{exports,require:resolve,console,Date,document:dom.window.document,window:dom.window,setInterval,clearInterval,AbortController,URLSearchParams,sessionStorage:dom.window.sessionStorage,fetch:async(url,options)=>{assert.equal(url,'/api/support-chat/tickets');assert(!options?.method||options.method==='GET');calls.push({actor,url});if(kind==='delayed'&&actor==='A')return new Promise(resolve=>held.push(()=>resolve(new Response(JSON.stringify({tickets:[],unread:1}),{status:200}))));return new Response(JSON.stringify({tickets:[],unread:actor==='A'?1:0}),{status:200})}});return exports}
 function resolve(n){
  if(n==='react'||n==='react/jsx-runtime')return dep(n);
  if(n==='next/link')return {__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)};
  if(n==='next/navigation')return {usePathname:()=>'/kintai/clock',useRouter:()=>({push:()=>{}})};
  if(n==='next-auth/react')return {SessionProvider:pass,signOut:()=>{throw Error('Unexpected signOut')}};
  if(n==='lucide-react')return new Proxy({},{get:()=>none});
  if(n.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
  if(n==='./AppShell')return load('AppShell.tsx');
  if(n==='@/components/support-chat/SupportChat')return load('SupportChat.tsx');
  if(n==='@/components/icons')return {UiIcon:none};
  if(n==='@/lib/support-chat/knowledge')return {suggestedQuestions:()=>[],toolIdForPath:()=>null,toolNameOf:()=>null,SUPPORT_HOURS_LABEL:'synthetic'};
  if(n==='@/lib/support-chat/rules')return {SUPPORT_CATEGORY_CHOICES:['howto','other'],SUPPORT_CATEGORY_LABEL:{howto:'synthetic',other:'synthetic'}};
  if(n==='./tools')return {ALL_SHELL_TOOLS:[home],SHELL_HOME:home,SHELL_GROUPS:[],buildDepartmentGroups:()=>[]};
  if(n==='@/app/(shell)/home/intents')return {HOME_INTENT_GROUPS:[]};
  if(n==='./ui-next-context')return {useToolHref:()=>href=>href,ShellToolHrefsContext:context()};
  if(n==='./in-shell')return {InShellContext:context()};
  if(n==='./company-context')return {AccountCompanyContext:context()};
  if(n==='./registry')return {shouldShowShell:()=>true};
  if(n==='./ShellUsage')return {ShellUsageProvider:pass};
  if(n==='./power')return {ShellPowerProvider:pass,ShellPowerMeter:none};
  if(n==='./low-power')return {DoyaPowerFetchWatcher:none,ShellLowPowerNotice:none};
  if(n==='@/components/doya-power/doya-power-context')return {DoyaPowerContext:context()};
  if(n==='@/components/doya-power/fx-context')return {DoyaPowerFxProvider:pass};
  if(n==='@/components/one-button/context')return {OneButtonContext:context()};
  if(n==='@/components/notice/NoticeProvider')return {__esModule:true,default:pass,useNotice:()=>({enabled:false,held:[],openHeld:()=>{}})};
  if(n==='./icons')return {ShellIcon:none};
  if(n==='./ToolBearIcon')return {ToolBearIcon:none};
  if(n==='@/lib/shell/recent')return {RECENT_COOKIE:'synthetic-recent',serializeRecent:()=>''};
  if(n==='@/lib/shell/nav-groups')return {NAV_GROUPS_COOKIE:'synthetic-groups',serializeNavGroups:()=>''};
  if(n==='@/lib/notice/announcements')return {newToolIds:()=>new Set()};
  if(n==='@/lib/brand')return {brandName:()=> 'Synthetic'};
  if(n==='@/components/brand/DoyaLogo')return {DoyaLogoMark:none};
  if(n==='./heading-guard')return {demoteExtraH1:()=>{}};
  if(['./ShellCompanyCard','./ShellVitals','@/components/notice/ShellNotices','@/components/notice/HandoffSuggest','@/components/support-chat/SupportChat','@/components/notice/PowerOutNotices'].includes(n))return {__esModule:true,default:none};
  if(n==='@/lib/departments')return {};
  throw Error('Unexpected import '+n);
 }
 try{
  const Gate=load('ShellGate.tsx').default,{createRoot}=dep('react-dom/client');root=createRoot(document.getElementById('root'));
  const render=()=>{const element=React.createElement(Gate,{session:{user:{id:'synthetic-'+actor,name:actor},expires:'2099-01-01T00:00:00Z'},signedIn:true,userName:'Synthetic actor '+actor,supportChat:true},React.createElement('h1',{},'Synthetic page'));root.render(strict?React.createElement(React.StrictMode,{},element):element)};
  const draft=()=>document.querySelector('textarea[aria-label="質問"]')?.value;
  if(kind==='flag-off'){
   const element=React.createElement(Gate,{session:{user:{id:'synthetic-A',name:'A'},expires:'2099-01-01T00:00:00Z'},signedIn:true,userName:'Synthetic actor A',supportChat:false},React.createElement('h1',{},'Synthetic page'));await React.act(async()=>root.render(strict?React.createElement(React.StrictMode,{},element):element));assert(!document.querySelector('#support-chat-panel'));assert(!document.querySelector('button[aria-label="質問・お問い合わせのチャットを開く"]'));assert.equal(calls.length,0);assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft'),'SYNTHETIC-LEGACY-PRIVATE-DRAFT');return{strict,kind,widgetAbsent:true,noSupportReads:true,legacyUntouched:true,observed:true};
  }
  if(kind==='actorless-boundary'||kind==='storage-denied'){
   const Support=load('SupportChat.tsx').default,{Simulate}=dep('react-dom/test-utils');const draw=key=>{const element=React.createElement(Support,{actorKey:key});root.render(strict?React.createElement(React.StrictMode,{},element):element)};const type=async value=>React.act(async()=>Simulate.change(document.querySelector('textarea[aria-label="質問"]'),{target:{value}}));
   if(kind==='actorless-boundary'){
    dom.window.sessionStorage.setItem('doya:support-chat:draft:v2:anonymous','SYNTHETIC NAMED-ANONYMOUS OWN DRAFT');actor='unknown';await React.act(async()=>draw(undefined));assert.equal(draft(),'');await type('SYNTHETIC UNKNOWN DRAFT');assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft:v2:anonymous'),'SYNTHETIC NAMED-ANONYMOUS OWN DRAFT');actor='named-anonymous';await React.act(async()=>draw('anonymous'));assert.equal(draft(),'SYNTHETIC NAMED-ANONYMOUS OWN DRAFT');assert.equal(calls.filter(x=>x.actor==='named-anonymous').length,strict?2:1);return{strict,kind,unknownDraftNeverStored:true,namedAnonymousGetsOwnDraftAndFreshReads:true,observed:true};
   }
   const prototype=Object.getPrototypeOf(dom.window.sessionStorage),originalGet=prototype.getItem;for(const name of ['getItem','setItem','removeItem'])Object.defineProperty(prototype,name,{configurable:true,writable:true,value:()=>{throw new dom.window.DOMException('synthetic denied','SecurityError')}});actor='A';await React.act(async()=>draw('synthetic-A'));assert.equal(draft(),'');await type('SYNTHETIC UNSTORED A DRAFT');assert.equal(draft(),'SYNTHETIC UNSTORED A DRAFT');actor='B';await React.act(async()=>draw('synthetic-B'));assert.equal(draft(),'');assert.equal(originalGet.call(dom.window.sessionStorage,'doya:support-chat:draft'),'SYNTHETIC-LEGACY-PRIVATE-DRAFT');return{strict,kind,storageDeniedWithoutCrash:true,actorDraftCleared:true,legacyValueUntouched:true,observed:true};
  }
  await React.act(async()=>render());assert.equal(draft(),'');const {Simulate}=dep('react-dom/test-utils');const type=async value=>React.act(async()=>Simulate.change(document.querySelector('textarea[aria-label="質問"]'),{target:{value}}));await type('SYNTHETIC-A-PRIVATE-DRAFT');assert.equal(draft(),'SYNTHETIC-A-PRIVATE-DRAFT');assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft:v2:synthetic-A'),'SYNTHETIC-A-PRIVATE-DRAFT');assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft'),'SYNTHETIC-LEGACY-PRIVATE-DRAFT');const aReads=calls.filter(x=>x.actor==='A').length;assert.equal(aReads,strict?2:1);
  if(kind==='same-path'||kind==='delayed'){
   actor='B';await React.act(async()=>render());assert(document.body.textContent.includes('Synthetic actor B'));assert.equal(draft(),'SYNTHETIC-B-PREVIOUS-DRAFT');assert.equal(calls.filter(x=>x.actor==='B').length,strict?2:1);assert(!document.querySelector('[aria-label="運営からの返信 1件"]'));await type('SYNTHETIC-B-NEW-DRAFT');
   if(kind==='delayed'){assert.equal(held.length,strict?2:1);await React.act(async()=>{for(const release of held)release()});assert(!document.querySelector('[aria-label="運営からの返信 1件"]'));assert.equal(draft(),'SYNTHETIC-B-NEW-DRAFT');return {strict,kind,oldAResponseIgnoredAfterB:true,ownBDraftRetained:true,legacyUnchanged:true,observed:true}}
   actor='A';await React.act(async()=>render());assert.equal(draft(),'SYNTHETIC-A-PRIVATE-DRAFT');assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft:v2:synthetic-B'),'SYNTHETIC-B-NEW-DRAFT');
   return {strict,kind,actorDraftsSeparated:true,oldUnreadCleared:true,bTicketReads:strict?2:1,actorReturnRestoresOnlyOwnDraft:true,legacyUnchanged:true,observed:true};
  }
  await React.act(async()=>root.unmount());root=createRoot(document.getElementById('root'));actor='B';await React.act(async()=>render());assert.equal(draft(),'SYNTHETIC-B-PREVIOUS-DRAFT');assert.equal(calls.filter(x=>x.actor==='B').length,strict?2:1);assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft:v2:synthetic-A'),'SYNTHETIC-A-PRIVATE-DRAFT');assert.equal(dom.window.sessionStorage.getItem('doya:support-chat:draft'),'SYNTHETIC-LEGACY-PRIVATE-DRAFT');
  return {strict,kind,onlyOwnDraftRestored:true,ownDraftNeverErased:true,otherActorDraftUntouched:true,legacyUnchanged:true,observed:true};
 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(global,k,d);else delete global[k]}
}
(async()=>{const results=[];for(const strict of [false,true])for(const kind of ['same-path','remount-storage','delayed','actorless-boundary','storage-denied','flag-off']){const name=kind+' '+(strict?'StrictMode':'normal');try{const value=await scenario(strict,kind);results.push({...value,name,observed:true});console.log('PASS Support privacy client: '+name)}catch(e){results.push({name,observed:false,error:e.message});console.error('FAIL proposal: '+e.message)}}const out={checkedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(sources).map(([file,text])=>[file,crypto.createHash('sha256').update(text).digest('hex')])),cases:results,observed:results.filter(x=>x.observed).length,failed:results.filter(x=>!x.observed).length,productionRequests:0,providerCalls:0,messageSends:0,scope:'Eight actual ShellGate/AppShell/SupportChat synthetic session/flag-off cases plus four actual SupportChat standalone actorless/storage-denial cases in JSDOM; synthetic tickets GET only. Exact namespaced A/B drafts plus an unattributed legacy draft. Legacy is neither loaded nor deleted. Normal/StrictMode. Not actual OAuth/browser-cookie/production cross-user data access or server authorization bypass.'};if(process.env.DOYA_SUPPORT_PRIVACY_CLIENT_RESULT)fs.writeFileSync(process.env.DOYA_SUPPORT_PRIVACY_CLIENT_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({observed:out.observed,failed:out.failed}));if(out.failed)process.exitCode=1})().catch(e=>{console.error(e.stack);process.exitCode=1});
