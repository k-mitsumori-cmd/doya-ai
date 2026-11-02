process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const sourceFiles={'AppShell.tsx':path.join(repo,'src/components/shell/AppShell.tsx'),'ShellGate.tsx':path.join(repo,'src/components/shell/ShellGate.tsx')};
const sources=Object.fromEntries(Object.entries(sourceFiles).map(([k,f])=>[k,fs.readFileSync(f,'utf8')]));
async function scenario(strict,kind){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid/kintai/clock'}),prior=new Map(),calls=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 const pass=({children})=>children,none=()=>null,context=()=>React.createContext(null),home={id:'home',href:'/home',name:'Home',hint:'home',icon:'Home'};
 let actor='A',root;const cache={};
 function load(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;const output=ts.transpileModule(sources[file],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(output,{exports,require:resolve,console,Date,document:dom.window.document,window:dom.window,setInterval,clearInterval,AbortController,fetch:(url,options)=>{assert.equal(url,'/api/agent/runs/summary');return new Promise(resolve=>calls.push({actor,finish:resolve,signal:options.signal}))}});return exports}
 function resolve(n){
  if(n==='react'||n==='react/jsx-runtime')return dep(n);
  if(n==='next/link')return {__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)};
  if(n==='next/navigation')return {usePathname:()=>'/kintai/clock',useRouter:()=>({push:()=>{}})};
  if(n==='next-auth/react')return {SessionProvider:pass,signOut:()=>{throw Error('Unexpected signOut')}};
  if(n==='lucide-react')return new Proxy({},{get:()=>none});
  if(n.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
  if(n==='./AppShell')return load('AppShell.tsx');
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
  const render=()=>{const element=React.createElement(Gate,{session:{user:{id:'synthetic-'+actor,name:actor},expires:'2099-01-01T00:00:00Z'},signedIn:true,userName:'Synthetic actor '+actor,agentTasks:true},React.createElement('h1',{},'Synthetic page'));root.render(strict?React.createElement(React.StrictMode,{},element):element)};
  const label=()=>[...document.querySelectorAll('a')].find(x=>x.href.endsWith('/home#home-agent-title'))?.getAttribute('aria-label');
  const response=n=>new Response(JSON.stringify({running:n,waiting:0,done:0,failed:0}),{status:200});
  await React.act(async()=>render());const aReads=calls.splice(0);assert.equal(aReads.length,strict?2:1);
  if(kind==='loaded'||kind==='off')await React.act(async()=>{for(const call of aReads)call.finish(kind==='off'?new Response('{}',{status:404}):response(9))});
  if(kind==='loaded')assert.equal(label(),'動いているタスク: 実行中9件、できた0件');
  actor='B';await React.act(async()=>render());assert(document.body.textContent.includes('Synthetic actor B'));
  const bReads=calls.splice(0);assert(bReads.every(x=>x.actor==='B'));
  assert.equal(bReads.length,strict?2:1);assert(!label().includes('9件'));
  await React.act(async()=>{for(const call of bReads)call.finish(response(0))});
  assert.equal(label(),'動いているタスク: いま動いている作業はありません');
  if(kind==='delayed')await React.act(async()=>{for(const call of aReads)call.finish(response(9))});
  assert.equal(label(),'動いているタスク: いま動いている作業はありません');
  return {strict,kind,bReads:bReads.length,actorCountsReset:true,observed:true};
 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(global,k,d);else delete global[k]}
}
(async()=>{const results=[];for(const strict of [false,true])for(const kind of ['loaded','delayed','off']){const name=kind+' '+(strict?'StrictMode':'normal');try{const value=await scenario(strict,kind);results.push({...value,name,passed:true});console.log('PASS Shell task count session: '+name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL Shell task count session: '+name+': '+e.message)}}const out={checkedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(sources).map(([file,text])=>['src/components/shell/'+file,crypto.createHash('sha256').update(text).digest('hex')])),cases:results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,productionRequests:0,scope:'Actual full repository ShellGate/AppShell with synthetic session/userName prop transition at one pathname, normal and StrictMode. NextAuth/context/network are explicit isolated doubles, not actual OAuth/cookie/production user switching or cross-user API access.'};if(process.env.DOYA_SHELL_TASK_COUNT_SESSION_RESULT)fs.writeFileSync(process.env.DOYA_SHELL_TASK_COUNT_SESSION_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed}));if(out.failed)process.exitCode=1})().catch(e=>{console.error(e.stack);process.exitCode=1});
