process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body></body>',{url:'https://local.test'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<8;i++)await new Promise(setImmediate)});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
let network,calls=[],imageMode='good',status='authenticated',actor='actor-a',view;
class FakeImage {set src(value){if(!value)return;queueMicrotask(()=>{this.naturalWidth=imageMode==='oversize'?9000:320;this.naturalHeight=50;if(imageMode==='bad')this.onerror?.();else if(imageMode==='good'||imageMode==='oversize')this.onload?.()})}}
let lockTail=Promise.resolve();const navigator={locks:{request:(_name,fn)=>{const next=lockTail.then(fn);lockTail=next.catch(()=>{});return next}}};
const globals={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,crypto,navigator,Image:FakeImage,AbortController,Response,URL,URLSearchParams,Date,Map,Set,Error,TextDecoder,Uint8Array,console,setTimeout,clearTimeout,fetch:async(url,init)=>{const c={url,init,body:init.body?JSON.parse(init.body):null};calls.push(c);return network(c)}};
function load(file,mocks,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},...globals,...extra},{filename:file});return exports}
const client=load('src/lib/doyaslide/operation-client.ts',{}),hook=load('src/lib/doyaslide/use-operation-recovery.ts',{react:React,'./operation-client':client});
const Panel=load('src/components/doyaslide/DoyaSlideOperationRecovery.tsx',{'react/jsx-runtime':require('react/jsx-runtime')}).default;
const project='project-a';
function Harness(){view=hook.useDoyaSlideRecovery(status,actor,project);return React.createElement(Panel,{recovery:view,onConfirm:async()=>view.acknowledge(view.result?.operationId)})}
let root,host;
const mount=async()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))))};
const render=()=>act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))));
const close=async()=>{if(root){await act(()=>root.unmount());root=null;host.remove()}};
const body={onlyPending:true};const controller=()=>new AbortController();
const identity=id=>({operationId:id,projectId:project,kind:'batch'});
const result=(id,state='completed')=>Response.json({...identity(id),state,errorCount:0,skipped:0,deferred:0,limit:20,results:state==='completed'?[{slideId:'slide-a',imageUrl:'https://local.test/image',rawImageUrl:'https://local.test/raw',version:1,model:'synthetic'}]:[]},{status:state==='pending'?202:200});
const success=id=>result(id);
const saved=()=>client.readDoyaSlideIntent(actor,project);
const submit=()=>view.submit('batch',body,controller().signal);
const cases=[];const test=async(name,fn)=>{await close();localStorage.clear();calls=[];status='authenticated';actor='actor-a';await mount();await fn();cases.push(name);console.log('PASS '+name)};
(async()=>{
 global.localStorage=dom.window.localStorage;
 await test('metadata persists before POST and two mounted callers cannot duplicate generation',async()=>{
   const hold=deferred();network=c=>{assert.equal(saved().operationId,c.body.operationId);assert.deepEqual(Object.keys(saved()).sort(),['createdAt','kind','operationId','projectId','version']);return hold.promise};
   let first,second,other;function Other(){other=hook.useDoyaSlideRecovery(status,actor,project);return null}
   const extra=document.createElement('div'),otherRoot=createRoot(extra);await act(()=>otherRoot.render(React.createElement(Other)));
   await act(()=>{first=submit();second=other.submit('batch',body,controller().signal).catch(e=>e)});assert.equal(calls.length,1);assert(view.blocked);
   hold.resolve(success(calls[0].body.operationId));await act(async()=>{await first;await second});await act(()=>otherRoot.unmount());
   assert(view.intent);let accepted;await act(()=>{accepted=view.acknowledge(view.result.operationId)});assert.equal(accepted,true);assert.equal(view.intent,null);assert.equal(view.acknowledge(calls[0].body.operationId),false)
 });
 await test('network loss keeps intent across remount and recovery uses GET without generating',async()=>{
   network=()=>{throw Error('Synthetic private failure')};await act(async()=>await assert.rejects(submit()));const id=saved().operationId;await close();await mount();assert.equal(view.intent.operationId,id);assert(view.blocked);
   network=c=>{assert.equal(c.init.method,'GET');return success(id)};await act(()=>view.recover());assert.equal(view.result.state,'completed');assert.equal(calls.filter(c=>c.init.method==='POST').length,1)
 });
 await test('pending cannot acknowledge; missing requires DELETE fence before closing and a new UUID',async()=>{
   network=c=>result(c.body?.operationId||saved().operationId,'pending');await act(()=>submit());const id=view.intent.operationId;assert.equal(view.acknowledge(id),false);
   network=()=>result(id,'missing');await act(()=>view.recover());assert.equal(view.acknowledge(id),false);
   network=c=>{assert.equal(c.init.method,'DELETE');return result(id,'cancelled')};await act(()=>view.recover(true));await act(()=>view.acknowledge(id));assert.equal(saved(),null);
   network=c=>success(c.body.operationId);await act(()=>submit());assert.notEqual(view.intent.operationId,id)
 });
 await test('auth A-loading-A and A-B-A fence late responses and preserve only scoped metadata',async()=>{
   const hold=deferred();network=()=>hold.promise;let first;await act(()=>{first=submit().catch(()=>{})});const id=saved().operationId;status='loading';await render();assert(calls[0].init.signal.aborted);status='authenticated';await render();hold.resolve(success(id));await act(async()=>await first);assert.equal(view.result,null);
   actor='actor-b';await render();assert.equal(view.intent,null);actor='actor-a';await render();assert.equal(view.intent.operationId,id)
 });
 await test('corrupt storage and stale guest callbacks cannot invoke provider',async()=>{
   localStorage.setItem('doyaslide-intent:v1:'+encodeURIComponent(JSON.stringify([actor,project])),'broken');await act(()=>window.dispatchEvent(new dom.window.Event('focus')));assert(view.blocked);network=()=>{throw Error('Unexpected network')};await act(async()=>await assert.rejects(submit()));assert.equal(calls.length,0);
   localStorage.clear();const retained=view.submit;status='unauthenticated';await render();await assert.rejects(retained('batch',body,controller().signal));assert.equal(calls.length,0)
 });
 await test('storage replacement clears obsolete result and old acknowledgment cannot consume another intent',async()=>{
   network=c=>success(c.body.operationId);await act(()=>submit());const old=view.result.operationId;client.clearDoyaSlideIntent(actor,project,old);const next=client.createDoyaSlideIntent(actor,project,'batch');await act(()=>window.dispatchEvent(new dom.window.StorageEvent('storage')));assert.equal(view.intent.operationId,next.operationId);assert.equal(view.result,null);let accepted;await act(()=>{accepted=view.acknowledge(old)});assert.equal(accepted,false);assert.equal(saved().operationId,next.operationId)
 });
 await test('failed storage removal cannot acknowledge completed operation or permit a new generation',async()=>{
   network=c=>success(c.body.operationId);await act(()=>submit());const id=view.result.operationId,prototype=Object.getPrototypeOf(localStorage),native=prototype.removeItem;prototype.removeItem=()=>{throw Error('Synthetic quota')};try{let acknowledged;await act(()=>{acknowledged=view.acknowledge(id)});assert.equal(acknowledged,false);assert.equal(saved().operationId,id);assert(view.blocked)}finally{prototype.removeItem=native}
 });
 await test('quota guidance closes only rejected intent and retains safe pricing link',async()=>{
   network=()=>Response.json({code:'LIMIT_REACHED',limit:20,error:'上限です',upgradeUrl:'/doyaslide/pricing'},{status:403});let value;await act(async()=>{value=await submit()});assert.equal(value.state,'limit');assert.equal(value.upgradeUrl,'/doyaslide/pricing');assert.equal(saved(),null);assert.equal(view.intent,null)
 });
 await test('wrong operation/project/slide or malformed saved result keeps intent and blocks next AI',async()=>{
   for(const mode of ['operation','project','shape','slide']){await close();localStorage.clear();await mount();network=c=>{const data={...identity(c.body.operationId),state:'completed',errorCount:0,skipped:0,deferred:0,limit:20,results:[{slideId:'slide-a',imageUrl:'https://local.test/image',rawImageUrl:'https://local.test/raw',version:1,model:'synthetic'}]};if(mode==='operation')data.operationId=crypto.randomUUID();if(mode==='project')data.projectId='another';if(mode==='shape')data.results[0].version='1';if(mode==='slide')data.results.push({...data.results[0]});return Response.json(data)};await act(async()=>await assert.rejects(submit()));assert(view.intent);assert(view.blocked);assert.equal(view.result,null)}
 });
 await test('oversized UTF8 and stalled/aborted responses are bounded without clearing intent',async()=>{
   const intent=client.createDoyaSlideIntent(actor,project,'batch');for(const response of [new Response('x',{headers:{'content-length':String(80*1024+1)}}),new Response(new Uint8Array([255]))])await assert.rejects(client.readDoyaSlideOperationResponse(response,intent,controller().signal));
   let cancelled=0;const control=controller(),reading=client.readDoyaSlideOperationResponse(new Response(new ReadableStream({cancel(){cancelled++}})),intent,control.signal);control.abort();await assert.rejects(reading);await new Promise(setImmediate);assert.equal(cancelled,1);assert.equal(saved().operationId,intent.operationId)
 });
 await test('abort terminates a non-cooperating fetch while metadata remains recoverable',async()=>{
   network=()=>new Promise(()=>{});const control=controller();let pending;await act(()=>{pending=view.submit('batch',body,control.signal).catch(e=>e)});assert.equal(calls.length,1);assert(view.busy);await act(async()=>{control.abort();await pending});assert.equal(view.busy,false);assert(view.intent);assert(view.blocked)
 });
 await close();const files=['src/lib/doyaslide/operation-client.ts','src/lib/doyaslide/use-operation-recovery.ts','src/components/doyaslide/DoyaSlideOperationRecovery.tsx'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/doyaslide-operation-recovery-mounted-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual client/hook/panel React18 StrictMode; synthetic network/auth/locks. Full editor, native browser, cross-process locks and production are not proven.'},null,2)+'\n');
})().catch(async e=>{console.error(e);await close();process.exitCode=1});
