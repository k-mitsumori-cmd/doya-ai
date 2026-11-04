// React.act needs the development runtime, including when npm build sets
// NODE_ENV=production in the parent. This dedicated test process is synthetic.
process.env.NODE_ENV = 'development';
const reportFailure = console.error.bind(console);
const { root: seatRepo, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=seatRepo,dep=n=>require(repo+'/node_modules/'+n),ts=dep('typescript'),React=dep('react'),{JSDOM}=dep('jsdom');
const file='src/components/pricing/TeamManage.tsx',source=fs.readFileSync(seatSourcePath(file),'utf8');
const plans=require(repo+'/scripts/security-regression/load-typescript.cjs').load('src/lib/pricing-v2/plans.ts');
const pending=action=>({operationKey:'original-operation-0001',requested:6,previousSeats:5,action});
const ready=seats=>({seats,used:3,interval:'month',monthly:plans.teamMonthly(seats),points:plans.teamMonthlyPoints(seats)});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r))};
async function scenario(name,options,work){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/pricing'}),prior=new Map(),errors=[],calls=[],dialogs=[],timers=new Map();let root,timerId=0,actor='owner-a',uuidCalls=0;
 const state={pending:options.pending||null,seatsA:5,seatsB:7,postReplies:0};
 const Session=React.createContext(null),confirm=options.confirmDeferred?deferred():null;
 const oldError=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 Object.defineProperty(dom.window.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(options.clipboardReject)throw Error('SYNTHETIC_CLIPBOARD_DENIED')}}});
 const response=(data,status=200)=>Response.json(data,{status});
 const fetcher=async(url,init={})=>{
  const method=init.method||'GET',owner=new Headers(init.headers).get('x-doya-owner'),body=init.body?JSON.parse(init.body):null;
  const call={url,method,owner,body,signal:init.signal};calls.push(call);
  assert(['owner-a','owner-b'].includes(owner),'expected principal header missing');
  if(options.onFetch){const custom=await options.onFetch({url,method,owner,body,init,state,response,call});if(custom!==undefined)return custom}
  if(method==='GET'&&url==='/api/pricing/seats')return response(owner==='owner-a'&&state.pending?{pending:state.pending}:ready(owner==='owner-a'?state.seatsA:state.seatsB));
  if(method==='GET'&&url==='/api/pricing/members')return response({members:[]});
  if(method==='POST'&&url==='/api/pricing/seats'){
   state.postReplies++;state.pending=null;if(owner==='owner-a')state.seatsA=body.seats;else state.seatsB=body.seats;return response({ok:true,seats:body.seats});
  }
  if(method==='POST'&&url==='/api/pricing/members')return response({inviteUrl:'https://synthetic.invalid/pricing/join?token=synthetic'});
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 };
 const cache=new Map(),classes=new Proxy({},{get:(_,key)=>String(key)});
 function load(name){
  if(cache.has(name))return cache.get(name);
  const target=seatSourcePath(name),bytes=fs.readFileSync(fs.existsSync(target)?target:path.join(repo,name),'utf8'),exports={};cache.set(name,exports);
  const requireMock=n=>{
   if(n==='react')return React;if(n==='react/jsx-runtime')return dep('react/jsx-runtime');
   if(n==='next-auth/react')return{useSession:()=>React.useContext(Session)};
   if(n==='lucide-react')return{Minus:()=>null,Plus:()=>null,Copy:()=>null,Check:()=>null};
   if(n==='@/components/ds')return{confirmDialog:async data=>{dialogs.push(data);return confirm?confirm.promise:true}};
   if(n.endsWith('.module.css'))return{__esModule:true,default:classes};
   if(n.startsWith('@/'))return load('src/'+n.slice(2)+'.ts');
   if(n.startsWith('.'))return load(path.posix.normalize(path.posix.join(path.posix.dirname(name),n))+'.ts');
   throw Error('UNEXPECTED_CLIENT_DEPENDENCY '+n);
  };
  vm.runInNewContext(ts.transpileModule(bytes,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:requireMock,console,Promise,URL,Headers,Request,Response,AbortController,TextDecoder,Uint8Array,Map,Set,Error,fetch:fetcher,navigator:dom.window.navigator,window:dom.window,document:dom.window.document,crypto:{randomUUID:()=>{uuidCalls++;return'00000000-0000-4000-8000-000000000001'}},setTimeout:(cb,ms)=>{const id=++timerId;timers.set(id,{cb,ms});return id},clearTimeout:id=>timers.delete(id)},{filename:name});
  return exports;
 }
 const TeamManage=load(file).TeamManage;
 const render=async(next=actor,status='authenticated')=>{actor=next;await React.act(async()=>{root.render(React.createElement(options.strict?React.StrictMode:React.Fragment,{},React.createElement(Session.Provider,{value:{status,data:status==='authenticated'?{user:{id:actor}}:null}},React.createElement(TeamManage))));await flush()})};
 const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label);
 const click=async label=>{const target=button(label);assert(target,'missing button '+label);assert(!target.disabled,'disabled button '+label);await React.act(async()=>{target.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));await flush()})};
 try{
  root=dep('react-dom/client').createRoot(document.getElementById('root'));await render();
  await work({dom,state,calls,dialogs,confirm,button,click,render,flush,expire:async()=>{const due=[...timers.values()];assert(due.length);assert(due.every(t=>t.ms===35000));await React.act(async()=>{for(const t of due)t.cb();await flush()})},uuid:()=>uuidCalls,text:()=>document.body.textContent});
  assert.equal(errors.length,0,name+': React/render errors: '+errors.join(' | '));
  assert(calls.every(c=>c.url.startsWith('/api/pricing/')));
  return{name,requests:calls.length,posts:calls.filter(c=>c.method==='POST').length,uuidCalls,strict:Boolean(options.strict),renderErrors:errors.length};
 }finally{
  try { if(root)await React.act(async()=>{root.unmount();await flush()}); }
  finally {
   console.error=oldError;
   for(const[k,descriptor]of prior){if(descriptor)Object.defineProperty(global,k,descriptor);else delete global[k]}dom.window.close();
  }
 }
}
(async()=>{
 const results=[];
 results.push(await scenario('pending-reload-retains-original-operation-and-explicit-resume',{pending:pending('resume')},async x=>{
  assert(x.text().includes('5人から6人への変更を確認中'));assert(!x.text().includes('original-operation'));assert(x.button('招待する').disabled);
  await x.click('元の変更を再開する');const post=x.calls.find(c=>c.method==='POST');assert.equal(post.body.operationKey,'original-operation-0001');assert.equal(post.body.mode,'resume');assert.equal(x.uuid(),0);assert.equal(x.dialogs.length,1);assert(x.dialogs[0].message.includes('日割り請求'));assert(x.text().includes('今の人数 6人'));
 }));
 results.push(await scenario('check-mode-is-explicit-and-does-not-open-payment-confirmation',{pending:pending('check')},async x=>{
  await x.click('元の変更結果を確認する');const post=x.calls.find(c=>c.method==='POST');assert.equal(post.body.mode,'check');assert.equal(post.body.operationKey,'original-operation-0001');assert.equal(x.dialogs.length,0);assert.equal(x.uuid(),0);
 }));
 results.push(await scenario('active-worker-shows-wait-and-get-only-refresh',{pending:pending('wait')},async x=>{
  assert(!x.button('元の変更を再開する'));assert(!x.button('元の変更結果を確認する'));await x.click('状態を再確認する');assert(x.calls.every(c=>c.method==='GET'));
 }));
 results.push(await scenario('fresh-change-binds-confirmed-quantity-and-principal',{},async x=>{
  await x.click('1人増やす');await x.click('人数を変える');const posts=x.calls.filter(c=>c.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].body.expectedSeats,5);assert.equal(posts[0].body.seats,6);assert.equal(posts[0].owner,'owner-a');assert.equal(x.uuid(),1);
 }));
 results.push(await scenario('double-click-before-render-does-not-duplicate-confirmation',{confirmDeferred:true},async x=>{
  await x.click('1人増やす');const target=x.button('人数を変える');await React.act(async()=>{target.dispatchEvent(new x.dom.window.MouseEvent('click',{bubbles:true}));target.dispatchEvent(new x.dom.window.MouseEvent('click',{bubbles:true}));await flush()});assert.equal(x.dialogs.length,1);await React.act(async()=>{x.confirm.resolve(true);await flush()});assert.equal(x.calls.filter(c=>c.method==='POST').length,1);
 }));
 results.push(await scenario('account-change-during-confirmation-prevents-old-post',{pending:pending('resume'),confirmDeferred:true},async x=>{
  await x.click('元の変更を再開する');await x.render('owner-b');await React.act(async()=>{x.confirm.resolve(true);await flush()});assert.equal(x.calls.filter(c=>c.method==='POST').length,0);assert(x.text().includes('今の人数 7人'));assert(!x.text().includes('変更を確認中'));
 }));
 {
  const late=deferred();
  results.push(await scenario('late-old-owner-read-cannot-overwrite-new-owner',{onFetch:({url,owner})=>owner==='owner-a'&&url==='/api/pricing/seats'?late.promise:undefined},async x=>{
   await x.render('owner-b');await React.act(async()=>{late.resolve(Response.json(ready(2)));await flush()});assert(x.text().includes('今の人数 7人'));assert(!x.text().includes('今の人数 2人'));
  }));
 }
 results.push(await scenario('malformed-ready-dto-does-not-enable-purchase',{onFetch:({url,response})=>url==='/api/pricing/seats'?response({...ready(5),monthly:1}):undefined},async x=>{assert(x.text().includes('人数を読み込めませんでした'));assert(x.button('人数を変える').disabled);assert(!x.button('状態を再確認する').disabled)}));
 results.push(await scenario('malformed-pending-dto-does-not-enable-recovery',{onFetch:({url,response})=>url==='/api/pricing/seats'?response({pending:{...pending('resume'),operationKey:'short'}}):undefined},async x=>{assert(!x.button('元の変更を再開する'));assert(x.button('人数を変える').disabled)}));
 results.push(await scenario('failed-member-read-is-not-an-empty-member-list',{onFetch:({url,response})=>url==='/api/pricing/members'?response({error:'synthetic'},503):undefined},async x=>{assert(x.text().includes('メンバー情報を読み込めませんでした'));assert(!x.text().includes('まだメンバーはいません'));assert(x.button('招待する').disabled)}));
 results.push(await scenario('stalled-http-read-has-deadline-and-manual-retry',{onFetch:({url})=>url==='/api/pricing/seats'?new Promise(()=>{}):undefined},async x=>{await x.expire();assert(x.text().includes('人数を読み込めませんでした'));assert(!x.button('状態を再確認する').disabled);assert(x.calls.every(c=>c.method==='GET'))}));
 results.push(await scenario('stalled-body-read-has-deadline-and-manual-retry',{onFetch:({url})=>url==='/api/pricing/seats'?new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}}):undefined},async x=>{await x.expire();assert(x.text().includes('人数を読み込めませんでした'));assert(!x.button('状態を再確認する').disabled)}));
 results.push(await scenario('mutation-timeout-queries-status-without-auto-retrying-payment',{onFetch:({url,method,body,state})=>{if(url==='/api/pricing/seats'&&method==='POST'){state.pending={...pending('wait'),operationKey:body.operationKey};return new Promise(()=>{})}}},async x=>{await x.click('1人増やす');await x.click('人数を変える');await x.expire();assert.equal(x.calls.filter(c=>c.method==='POST').length,1);assert(x.text().includes('変更を確認中'));assert(x.button('招待する').disabled)}));
 results.push(await scenario('strict-mode-does-not-create-or-resume-a-payment',{pending:pending('resume'),strict:true},async x=>{assert(x.text().includes('変更を確認中'));assert(x.calls.every(c=>c.method==='GET'));assert.equal(x.uuid(),0)}));
 results.push(await scenario('logout-removes-prior-owner-data-and-controls',{},async x=>{await x.render('owner-a','unauthenticated');assert(x.text().includes('ログインして'));assert(!x.button('人数を変える'));assert(!x.text().includes('今の人数 5人'))}));
 const files=[file,'src/lib/pricing-v2/seat-operation-view.ts'];fs.writeFileSync(evidenceDir+'/team-manage-mounted-result.json',JSON.stringify({checkedAt:new Date().toISOString(),count:results.length,results,actualReactDomAndCandidateComponent:true,actualSharedBillingResponseHelper:true,sessionFetchAndConfirmSynthetic:true,manualTimerWitnessDelayMs:35000,realNetworkRequests:0,realPayments:0,nativeBrowserVisualQa:false,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(f))).digest('hex')])),sharedReadHelperSha256:crypto.createHash('sha256').update(fs.readFileSync(repo+'/src/lib/billing-response-client.ts')).digest('hex')},null,2)+'\n');console.log(JSON.stringify({passed:results.length,realNetworkRequests:0,realPayments:0}));
})().catch(e=>{reportFailure(e);process.exitCode=1});
