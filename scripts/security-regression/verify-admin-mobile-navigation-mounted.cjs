process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),out=__dirname,dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const sources={current:path.join(repo,'src/app/admin/layout.tsx')};
function compile(source,imports,extra){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{assert(n in imports,'Unexpected import '+n);return imports[n]},console,...extra});return exports;}
const cases=['children','closed','semantics','initial-focus','tab-wrap','shift-tab-wrap','escape','close','backdrop','same-route-link','pathname','desktop','locks-restored','unmount','login','login-transition','reopen'];
async function run(variant,strict,kind){const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/admin/support'}),win=dom.window,prior=new Map(),mediaListeners=new Set();let pathname=kind==='login'?'/admin/login':'/admin/support',root,statsRequests=0,desktop=false;
for(const[k,v]of Object.entries({window:win,document:win.document,navigator:win.navigator,HTMLElement:win.HTMLElement,Element:win.Element,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
// JSDOM has no layout: this adapter exposes connected elements as visible. Native sizing is separate.
win.HTMLElement.prototype.getClientRects=function(){return this.isConnected?[{width:44,height:44}]:[]};
const mql={get matches(){return desktop},addEventListener:(type,fn)=>mediaListeners.add(fn),removeEventListener:(type,fn)=>mediaListeners.delete(fn)};win.matchMedia=()=>mql;
const imports={'react':React,'react/jsx-runtime':dep('react/jsx-runtime')},extra={window:win,document:win.document,Element:win.Element,AbortController,fetch:async()=>{statsRequests++;return new Response(JSON.stringify({error:'Synthetic unavailable'}),{status:503})}};
try{const jst=compile(fs.readFileSync(path.join(repo,'src/lib/jst.ts'),'utf8'),{},extra),daily=compile(fs.readFileSync(path.join(repo,'src/components/AdminDailyStats.tsx'),'utf8'),{...imports,'@/lib/jst':jst},extra);
const sidebar=compile(fs.readFileSync(path.join(repo,'src/components/AdminSidebar.tsx'),'utf8'),{...imports,'next/link':({children,href,...props})=>React.createElement('a',{href,...props,onClick:e=>e.preventDefault()},children),'next/navigation':{usePathname:()=>pathname},'framer-motion':{motion:{div:({children,className})=>React.createElement('div',{className},children)}},'lucide-react':dep('lucide-react'),'react-hot-toast':{error:()=>{throw Error('Unexpected toast')}},'@/components/AdminDailyStats':daily},extra);
const layout=compile(fs.readFileSync(sources[variant],'utf8'),{...imports,'next/navigation':{usePathname:()=>pathname},'@/components/AdminSidebar':sidebar,'@/components/AdminAuthWrapper':{AdminAuthWrapper:({children})=>React.createElement(React.Fragment,{},children)},'lucide-react':dep('lucide-react')},extra).default;
const {createRoot}=dep('react-dom/client');root=createRoot(document.getElementById('root'));const render=async()=>{const view=React.createElement(layout,{},React.createElement('button',{id:'underlying'},'Underlying content'));await React.act(async()=>root.render(strict?React.createElement(React.StrictMode,{},view):view))};await render();
const opener=()=>document.querySelector('svg.lucide-menu')?.closest('button'),closer=()=>document.querySelector('svg.lucide-x')?.closest('button'),dialog=()=>document.querySelector('[role="dialog"]'),click=async el=>{assert(el,'Missing click target');await React.act(async()=>el.click())},key=async(k,shiftKey=false)=>{await React.act(async()=>document.dispatchEvent(new win.KeyboardEvent('keydown',{key:k,shiftKey,bubbles:true,cancelable:true})))},open=async()=>{opener().focus();await click(opener())},closed=()=>assert(!closer(),'Menu remained open'),returned=()=>assert(document.activeElement===opener(),'Focus did not return to opener');
if(kind==='children')assert(document.getElementById('underlying'));
else if(kind==='closed')assert(!closer());
else if(kind==='login'){assert(!opener());assert(!document.querySelector('aside'));assert.equal(statsRequests,0)}
else{
if(kind==='locks-restored')document.body.style.overflow='scroll';
await open();
if(kind==='semantics'){assert.equal(opener().getAttribute('aria-label'),'管理メニューを開く');assert.equal(closer().getAttribute('aria-label'),'管理メニューを閉じる');assert.equal(opener().getAttribute('aria-expanded'),'true');assert.equal(dialog().getAttribute('aria-modal'),'true');assert(document.getElementById(opener().getAttribute('aria-controls'))===dialog(),'Controlled element mismatch')}
else if(kind==='initial-focus')assert(document.activeElement===closer(),'Focus is not on close button');
else if(kind==='tab-wrap'){const links=dialog()?.querySelectorAll('a[href]')||document.querySelectorAll('a[href]');closer().focus();await key('Tab');assert(document.activeElement===links[0],'Focus did not wrap to first link')}
else if(kind==='shift-tab-wrap'){const links=dialog()?.querySelectorAll('a[href]')||document.querySelectorAll('a[href]');links[0].focus();await key('Tab',true);assert(document.activeElement===closer(),'Focus is not on close button')}
else if(kind==='escape'){await key('Escape');closed();returned()}
else if(kind==='close'){closer().focus();await click(closer());closed();returned()}
else if(kind==='backdrop'){const bg=document.querySelector('.backdrop-blur-sm');assert(bg);await click(bg);closed();returned()}
else if(kind==='same-route-link'){const area=dialog()||closer().parentElement;const link=[...area.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===pathname);await click(link);closed();returned()}
else if(kind==='pathname'){pathname='/admin/services';await render();closed();assert.equal(document.body.style.overflow,'')}
else if(kind==='desktop'){desktop=true;await React.act(async()=>{for(const fn of [...mediaListeners])fn({matches:true})});closed();assert.equal(document.body.style.overflow,'')}
else if(kind==='locks-restored'){assert.equal(document.body.style.overflow,'hidden');assert.equal(document.getElementById('underlying').closest('[aria-hidden="true"]').inert,true);await click(closer());assert.equal(document.body.style.overflow,'scroll');assert.equal(document.getElementById('underlying').closest('main').parentElement.inert,false)}
else if(kind==='unmount'){await React.act(async()=>root.unmount());root=null;assert.equal(document.body.style.overflow,'');assert.equal(mediaListeners.size,0)}
else if(kind==='login-transition'){const before=statsRequests;pathname='/admin/login';await render();assert(!opener());assert(!document.querySelector('aside'));assert.equal(statsRequests,before);assert.equal(document.body.style.overflow,'');assert.equal(mediaListeners.size,0)}
else if(kind==='reopen'){for(let i=0;i<3;i++){assert.equal(mediaListeners.size,1);await key('Escape');closed();assert.equal(mediaListeners.size,0);await open()}await click(closer());closed();assert.equal(mediaListeners.size,0)}
else throw Error('Unknown case');
}
return{variant,strict,kind,passed:true,statsRequests};
}finally{if(root)await React.act(async()=>root.unmount());win.close();for(const[k,d]of prior){if(d)Object.defineProperty(global,k,d);else delete global[k]}}}
(async()=>{
 if(process.argv[2]==='--case'){
  const [variant,strict,kind]=process.argv.slice(3);
  try{console.log(JSON.stringify(await run(variant,strict==='true',kind)))}
  catch(e){console.log(JSON.stringify({variant,strict:strict==='true',kind,passed:false,error:String(e.message).slice(0,500)}))}
  return;
 }
 const rows=[];
 for(const strict of [false,true])for(const kind of cases){
  const child=require('node:child_process').spawnSync(process.execPath,['--max-old-space-size=384',__filename,'--case','current',String(strict),kind],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  assert.equal(child.status,0,'Admin navigation child failed: '+kind+' '+String(child.error?.message||child.signal||child.stderr).slice(0,500));
  const result=JSON.parse(child.stdout); rows.push(result);
  assert(result.passed,kind+' '+(strict?'StrictMode':'normal')+': '+result.error);
  console.log('PASS Admin mobile navigation: '+kind+' '+(strict?'StrictMode':'normal'));
 }
 const report={checkedAt:new Date().toISOString(),cases:rows.length,failed:0,rows,sourceHashes:Object.fromEntries(['src/app/admin/layout.tsx','src/components/AdminSidebar.tsx','src/components/AdminDailyStats.tsx'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,n))).digest('hex')])),productionRequests:0,productionWrites:0,providerCalls:0,scope:'Actual AdminLayout, Sidebar and DailyStats mounted with synthetic AuthWrapper passthrough, Next pathname/link and stable motion adapters; synthetic503 stats response; JSDOM visible geometry shim. Normal and StrictMode. No native layout, real authentication, DB or production proof; native verification is separate.'};
 if(process.env.DOYA_ADMIN_NAV_RESULT)fs.writeFileSync(process.env.DOYA_ADMIN_NAV_RESULT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:rows.length,failed:0}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
