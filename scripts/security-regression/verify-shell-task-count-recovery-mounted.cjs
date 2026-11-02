process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const source=fs.readFileSync(path.join(repo,'src/components/shell/AppShell.tsx'),'utf8');
async function scenario(strict,kind){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid/kintai/clock'}),prior=new Map(),calls=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 const exports={};let root;
 const icon=()=>null;
 function resolve(n){
  if(n==='react'||n==='react/jsx-runtime')return dep(n);
  if(n==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(n==='lucide-react')return new Proxy({},{get:()=>icon});
  if(n.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
  if(n==='./tools')return {ALL_SHELL_TOOLS:[]};
  if(n==='@/app/(shell)/home/intents')return {HOME_INTENT_GROUPS:[]};
  if(n.startsWith('./')||n.startsWith('@/')||n==='next/navigation'||n==='next-auth/react')return {};
  throw Error('Unexpected import '+n);
 }
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(output+'\nexports.__auditTasksRow=AgentTasksRow;', {exports,require:resolve,console,document:dom.window.document,window:dom.window,setInterval,clearInterval,AbortController,fetch:(url,options)=>{assert.equal(url,'/api/agent/runs/summary');assert.equal(options.cache,'no-store');return new Promise((resolve,reject)=>calls.push(Object.assign(resolve,{signal:options.signal,reject})))}});
 const Component=exports.__auditTasksRow,{createRoot}=dep('react-dom/client');
 try{
  root=createRoot(document.getElementById('root'));
  const render=pathname=>root.render(strict?React.createElement(React.StrictMode,{},React.createElement(Component,{pathname,onNavigate:()=>{}})):React.createElement(Component,{pathname,onNavigate:()=>{}}));
  const response=running=>new Response(JSON.stringify({running,waiting:0,done:0,failed:0}),{status:200});
  const label=()=>document.querySelector('a')?.getAttribute('aria-label');
  const zero='動いているタスク: いま動いている作業はありません',nine='動いているタスク: 実行中9件、できた0件';
  await React.act(async()=>render('/kintai/clock'));const old=calls.splice(0);assert.equal(old.length,strict?2:1);
  if(kind==='unmount'){
   await React.act(async()=>root.unmount());root=null;assert(old.every(x=>x.signal.aborted));await React.act(async()=>{for(const finish of old)finish(response(9))});assert.equal(calls.length,0);return {strict,kind,passed:true,priorRequestsAborted:true};
  }
  if(kind==='normal'){
   await React.act(async()=>{for(const finish of old)finish(response(9))});assert.equal(label(),nine);return {strict,kind,passed:true};
  }
  if(kind==='network-recover'||kind==='invalid-json-recover'){
   await React.act(async()=>{for(const finish of old){if(kind==='network-recover')finish.reject(Error('synthetic network'));else finish({status:200,ok:true,json:async()=>{throw Error('synthetic JSON')}})}});assert.equal(label(),'動いているタスク');
   await React.act(async()=>render('/home'));assert.equal(calls.length,1);await React.act(async()=>calls.shift()(response(0)));assert.equal(label(),zero);return {strict,kind,passed:true};
  }
  if(kind==='latest-404'){
   await React.act(async()=>{for(const finish of old)finish(response(9))});assert.equal(label(),nine);
   await React.act(async()=>render('/home'));await React.act(async()=>calls.shift()(new Response('{}',{status:404})));assert.equal(label(),'動いているタスク');
   await React.act(async()=>render('/kintai/clock'));assert.equal(calls.length,0);return {strict,kind,passed:true};
  }
  let jsonRelease;
  if(kind==='reverse-json')await React.act(async()=>{for(const finish of old.slice(0,-1))finish(response(9));old.at(-1)({status:200,ok:true,json:()=>new Promise(resolve=>{jsonRelease=()=>resolve({running:9,waiting:0,done:0,failed:0})})})});
  await React.act(async()=>render('/home'));assert.equal(calls.length,1);assert(old.every(x=>x.signal.aborted));
  await React.act(async()=>calls.shift()(response(0)));assert.equal(label(),zero);
  if(kind==='reverse-json')await React.act(async()=>jsonRelease());
  else await React.act(async()=>{for(const finish of old)finish(kind==='older-404'?new Response('{}',{status:404}):response(9))});
  assert.equal(label(),zero);
  if(kind==='older-404'){await React.act(async()=>render('/kintai/attendance'));assert.equal(calls.length,1);await React.act(async()=>calls.shift()(response(9)));assert.equal(label(),nine)}
  return {strict,kind,passed:true,priorRequestsAborted:true};
 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(global,k,d);else delete global[k]}
}
(async()=>{const results=[];for(const strict of [false,true])for(const kind of ['reverse-path','reverse-json','older-404','latest-404','network-recover','invalid-json-recover','unmount','normal']){const name=kind+' '+(strict?'StrictMode':'normal');try{const value=await scenario(strict,kind);results.push({...value,name,passed:true});console.log('PASS Shell task count recovery: '+name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL Shell task count recovery: '+name+': '+e.message)}}const out={checkedAt:new Date().toISOString(),sourceHashes:{'src/components/shell/AppShell.tsx':crypto.createHash('sha256').update(source).digest('hex')},cases:results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,productionRequests:0,scope:'Actual repository AgentTasksRow from full module, test-only export; synthetic DOM/network, normal and StrictMode. Header/JSON response order, stale/current404, network/JSON recovery, abort/unmount and positive counts. Not an actual login/browser/API proof.'};if(process.env.DOYA_SHELL_TASK_COUNT_RECOVERY_RESULT)fs.writeFileSync(process.env.DOYA_SHELL_TASK_COUNT_RECOVERY_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed}));if(out.failed)process.exitCode=1})().catch(e=>{console.error(e.stack);process.exitCode=1});
