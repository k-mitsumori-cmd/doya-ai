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
const client=load('src/lib/adimage/operation-client.ts',{}),hook=load('src/lib/adimage/use-operation-recovery.ts',{react:React,'./operation-client':client});
const project='brand';
function Harness(){view=hook.useAdImageRecovery(status,actor);return React.createElement('div',null,view.message)}
let root,host;
const mount=async()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))))};
const render=()=>act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))));
const close=async()=>{if(root){await act(()=>root.unmount());root=null;host.remove()}};
const body={onlyPending:true};const controller=()=>new AbortController();
const identity=id=>({operationId:id,targetId:project,kind:'generate'});
const completed=id=>({...identity(id),state:'completed',conceptId:'concept-a',campaignId:'campaign-a',copy:{headline:'Synthetic',sub:'',cta:'View'},generation:1,creatives:[{id:'creative-a',placementKey:'square',placementName:'Square',media:'Test',size:'1024x1024',url:'https://local.test/image',verify:null}],previousCreatives:[],previousGeneration:null,appliedDirectives:[],failedPlacements:[],needsReview:false});
const result=(id,state='completed')=>Response.json(state==='completed'?completed(id):{...identity(id),state},{status:['pending','busy'].includes(state)?202:200});
const success=id=>result(id);
const saved=()=>client.readAdImageIntent(actor);
const submit=()=>view.submit('generate',project,body,controller().signal);
const cases=[];const test=async(name,fn)=>{await close();localStorage.clear();calls=[];status='authenticated';actor='actor-a';await mount();await fn();cases.push(name);console.log('PASS '+name)};
(async()=>{
 global.localStorage=dom.window.localStorage;
 await test('metadata persists before POST and two mounted callers cannot duplicate generation',async()=>{
   const hold=deferred();network=c=>{assert.equal(saved().operationId,c.body.operationId);assert.deepEqual(Object.keys(saved()).sort(),['createdAt','kind','operationId','targetId','version']);return hold.promise};
   let first,second,other;function Other(){other=hook.useAdImageRecovery(status,actor);return null}
   const extra=document.createElement('div'),otherRoot=createRoot(extra);await act(()=>otherRoot.render(React.createElement(Other)));
   await act(()=>{first=submit();second=other.submit('generate',project,body,controller().signal).catch(e=>e)});assert.equal(calls.length,1);assert(view.blocked);
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
   localStorage.setItem('adimage-intent:v1:'+encodeURIComponent(actor),'broken');await act(()=>window.dispatchEvent(new dom.window.Event('focus')));assert(view.blocked);network=()=>{throw Error('Unexpected network')};await act(async()=>await assert.rejects(submit()));assert.equal(calls.length,0);
   localStorage.clear();const retained=view.submit;status='unauthenticated';await render();await assert.rejects(retained('generate',project,body,controller().signal));assert.equal(calls.length,0)
 });
 await test('storage replacement clears obsolete result and old acknowledgment cannot consume another intent',async()=>{
   network=c=>success(c.body.operationId);await act(()=>submit());const old=view.result.operationId;client.clearAdImageIntent(actor,old);const next=client.createAdImageIntent(actor,'generate',project);await act(()=>window.dispatchEvent(new dom.window.StorageEvent('storage')));assert.equal(view.intent.operationId,next.operationId);assert.equal(view.result,null);let accepted;await act(()=>{accepted=view.acknowledge(old)});assert.equal(accepted,false);assert.equal(saved().operationId,next.operationId)
 });
 await test('failed storage removal cannot acknowledge completed operation or permit a new generation',async()=>{
   network=c=>success(c.body.operationId);await act(()=>submit());const id=view.result.operationId,prototype=Object.getPrototypeOf(localStorage),native=prototype.removeItem;prototype.removeItem=()=>{throw Error('Synthetic quota')};try{let acknowledged;await act(()=>{acknowledged=view.acknowledge(id)});assert.equal(acknowledged,false);assert.equal(saved().operationId,id);assert(view.blocked)}finally{prototype.removeItem=native}
 });
 await test('quota guidance closes only rejected intent and retains safe pricing link',async()=>{
   network=c=>Response.json({...identity(c.body.operationId),state:'limit',code:'DAILY_IMAGE_LIMIT',error:'上限です',upgradeUrl:'/adimage/pricing'},{status:429});let value;await act(async()=>{value=await submit()});assert.equal(value.state,'limit');assert.equal(value.upgradeUrl,'/adimage/pricing');assert(view.intent);await act(()=>view.acknowledge(view.result.operationId));assert.equal(saved(),null);assert.equal(view.intent,null)
 });
 await test('wrong operation/project/slide or malformed saved result keeps intent and blocks next AI',async()=>{
   for(const mode of ['operation','project','shape','slide','verify','url']){await close();localStorage.clear();await mount();network=c=>{const data=completed(c.body.operationId);if(mode==='operation')data.operationId=crypto.randomUUID();if(mode==='project')data.targetId='another';if(mode==='shape')data.generation='1';if(mode==='slide')data.creatives.push({...data.creatives[0]});if(mode==='verify')data.creatives[0].verify={extraText:'invalid'};if(mode==='url')data.creatives[0].url='javascript:bad';return Response.json(data)};await act(async()=>await assert.rejects(submit()));assert(view.intent);assert(view.blocked);assert.equal(view.result,null)}
 });
 await test('oversized UTF8 and stalled/aborted responses are bounded without clearing intent',async()=>{
   const intent=client.createAdImageIntent(actor,'generate',project);for(const response of [new Response('x',{headers:{'content-length':String(256*1024+1)}}),new Response(new Uint8Array([255]))])await assert.rejects(client.readAdImageOperationResponse(response,intent,controller().signal));
   let cancelled=0;const control=controller(),reading=client.readAdImageOperationResponse(new Response(new ReadableStream({cancel(){cancelled++}})),intent,control.signal);control.abort();await assert.rejects(reading);await new Promise(setImmediate);assert.equal(cancelled,1);assert.equal(saved().operationId,intent.operationId)
 });
 await test('abort terminates a non-cooperating fetch while metadata remains recoverable',async()=>{
   network=()=>new Promise(()=>{});const control=controller();let pending;await act(()=>{pending=view.submit('generate',project,body,control.signal).catch(e=>e)});assert.equal(calls.length,1);assert(view.busy);await act(async()=>{control.abort();await pending});assert.equal(view.busy,false);assert(view.intent);assert(view.blocked)
 });
 await test('refine POST binds parent route and recovered before/after result survives network loss',async()=>{network=()=>{throw Error('Synthetic lost refine response')};await act(async()=>await assert.rejects(view.submit('refine','parent-a',{note:'Private draft'},controller().signal)));const id=saved().operationId;assert.equal(calls[0].url,'/api/adimage/concepts/parent-a/refine');assert.equal(calls[0].body.note,'Private draft');assert.equal(saved().targetId,'parent-a');assert(!JSON.stringify(saved()).includes('Private draft'));network=c=>{assert.equal(c.init.method,'GET');return Response.json({...completed(id),kind:'refine',targetId:'parent-a',generation:2,previousGeneration:1,previousCreatives:[{...completed(id).creatives[0],id:'previous-image'}],appliedDirectives:[{target:'visual',instruction:'Synthetic refine',reason:'Synthetic'}]})};await act(()=>view.recover());assert.equal(view.result.generation,2);assert.equal(view.result.previousCreatives.length,1);assert.equal(calls.filter(c=>c.init.method==='POST').length,1)})
 await test('missing Web Locks rejects before POST without discarding an existing operation',async()=>{const locks=navigator.locks;navigator.locks=undefined;try{network=()=>{throw Error('Unexpected network')};await act(async()=>await assert.rejects(submit()));assert.equal(calls.length,0);assert.equal(saved(),null);assert(view.blocked)}finally{navigator.locks=locks}})
 await close();const files=['src/lib/adimage/operation-client.ts','src/lib/adimage/use-operation-recovery.ts'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/adimage-operation-recovery-mounted-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual client/hook React18 StrictMode; synthetic network/auth/locks. Full Tool, native browser, cross-process locks and production are not proven.'},null,2)+'\n');
})().catch(async e=>{console.error(e);await close();process.exitCode=1});
