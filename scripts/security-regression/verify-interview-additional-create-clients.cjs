const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function extract(file,name){const source=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)result=(ts.isCallExpression(n.initializer)?n.initializer.arguments[0]:n.initializer).getText(ast);ts.forEachChild(n,visit)}visit(ast);assert.ok(result);return compile('('+result+');')}
const sources={template:extract('src/app/interview/templates/page.tsx','handleCreateFromTemplate'),dashboard:extract('src/app/interview/Tool.tsx','uploadFromDashboard')};
const reader=compile(fs.readFileSync(path.join(root,'src/lib/interview/creation-response.ts'),'utf8')),tick=()=>new Promise(r=>setImmediate(r));
const file={name:'synthetic.wav',size:10,type:'audio/wav',lastModified:1},template={sampleTitle:'synthetic',genre:'OTHER',description:'supplied template description'};
function fixture(kind,options={}){const requests=[],timers=new Map(),routes=[];let timer=0,xhrCalls=0;const state={error:'',login:false,loading:false,uploads:new Map(),listError:false,projects:[],staleWrites:0,uploadUrls:[]};const env={crypto:require('node:crypto'),AbortController,URL,Map,Date,console:{warn(){}},SUPPORT_CONTACT_URL:'https://example.invalid/contact',router:{push:url=>routes.push(url)},activeTemplateCreate:{current:null},templateCreateAttempt:{current:null},setCreating:v=>state.loading=v,setCreateError:v=>state.error=v,setCreateLoginRequired:v=>state.login=v,uploadActor:'owner',uploadActorRef:{current:'owner'},uploadsAlive:{current:true},dashboardAttempts:{current:new Map()},getProjectTitle:()=> 'synthetic',setUploads:f=>{if(!env.uploadsAlive.current)state.staleWrites++;state.uploads=typeof f==='function'?f(state.uploads):f},setUpsellLimitType(){},setUpsellIsGuest(){},setUpsellOpen(){},xhrRef:{current:new Map()},uploadSpeedRef:{current:new Map()},setProjects:v=>state.projects=v,setProjectListError:v=>state.listError=v,FormData:class{append(){}},setTimeout:(fn,ms)=>{assert.equal(ms,5000);return 1},XMLHttpRequest:class{constructor(){this.listeners={};this.upload={addEventListener(){}};this.status=options.xhrStatuses?.shift()||options.xhrStatus||200}addEventListener(name,fn){this.listeners[name]=fn}open(method,url){assert.equal(method,'PUT');assert.ok(url.startsWith('https://'));state.uploadUrls.push(url);}setRequestHeader(){}send(){xhrCalls++;options.beforeLoad?.(env);this.listeners.load();this.listeners.loadend?.()}abort(){this.listeners.abort?.();this.listeners.loadend?.()}}};
const exports={};vm.runInNewContext(reader,{exports,Error,TextDecoder,TextEncoder,AbortController,fetch:(url,init)=>new Promise((resolve,reject)=>requests.push({url,init,body:init.body?JSON.parse(init.body):null,resolve,reject})),setTimeout:(fn,ms)=>{assert.equal(ms,35000);timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id)});Object.assign(env,exports,{fetch:async()=>Response.json({success:true,projects:[]})});const fn=vm.runInNewContext(sources[kind],env);return{env,state,requests,timers,routes,get xhrCalls(){return xhrCalls},run:(input)=>fn(input||(kind==='template'?template:file))}}
async function next(f){await tick();return f.requests.at(-1)}
async function prepare(f){if(f.env.dashboardAttempts.current.size){const req=await next(f);assert.equal(req.body.preflight,true);req.resolve(Response.json({success:true}));await tick()}const req=f.requests.at(-1);assert.ok(req.url.includes('prepareCreate=1'));req.resolve(Response.json({success:true,creationScope:'a'.repeat(64)}));return next(f)}
const imageUpload={success:true,signedUrl:'https://example.invalid/storage/synthetic',materialId:'material'};
(async()=>{let passed=0;
for(const kind of ['template','dashboard'])for(const scenario of ['success','http500','missing-id','object-id','private-error','quota','body-deadline','late-result']){
 const f=fixture(kind),first=f.run();await f.run();assert.equal(f.requests.length,1,'same-turn duplicates blocked');const post=await prepare(f);assert.equal(post.url,'/api/interview/projects');const key=post.body.requestKey;assert.ok(key);if(kind==='template')assert.equal(post.body.purpose,template.description);
 if(scenario==='private-error')post.reject(Error('SYNTHETIC_PRIVATE'));
 else if(scenario==='body-deadline'){let canceled=0;post.resolve(new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){canceled++}})));await tick();for(const expire of f.timers.values())expire();await first;assert.equal(canceled,1)}
 else{if(scenario==='late-result'){if(kind==='template'){f.env.activeTemplateCreate.current.abort();f.env.activeTemplateCreate.current=null}else{f.env.uploadsAlive.current=false;for(const op of f.env.dashboardAttempts.current.values())op.controller.abort()}}post.resolve(Response.json({success:true,project:scenario==='missing-id'?{}:{id:scenario==='object-id'?{}:'synthetic'},code:scenario==='quota'?'GUEST_LIMIT':undefined,error:'SYNTHETIC_PRIVATE'},{status:scenario==='http500'?500:scenario==='quota'?429:200}))}
 if(scenario==='success'&&kind==='dashboard'){const url=await next(f);assert.equal(url.url,'/api/interview/materials/upload-url');url.resolve(Response.json(imageUpload));const confirm=await next(f);assert.equal(confirm.url,'/api/interview/materials/confirm');confirm.resolve(Response.json({success:true}))}
 await first;assert.equal(f.timers.size,0);assert.equal(f.routes.length,scenario==='success'?1:0);if(scenario==='success'){const before=f.requests.length;await f.run();assert.equal(f.requests.length,before,'successful operation cannot duplicate before leaving')}
 else if(scenario!=='late-result'){const error=kind==='template'?f.state.error:[...f.state.uploads.values()][0].error;assert.ok(error);assert.ok(!error.includes('SYNTHETIC_PRIVATE'));const second=f.run(),retry=await prepare(f);assert.equal(retry.body.requestKey,key);retry.resolve(Response.json({success:true,project:{id:'recovered'}}));if(kind==='dashboard'){const sign=await next(f);sign.resolve(Response.json(imageUpload));const confirm=await next(f);confirm.resolve(Response.json({success:true}))}await second;assert.equal(f.routes.length,1)}passed++;
}
// Server scope-change code maps to a recheck, retaining the uncertain key.
for(const kind of ['template','dashboard']) {
 const f=fixture(kind), first=f.run(), post=await prepare(f), key=post.body.requestKey;
 post.resolve(Response.json({success:false,code:'CREATION_SCOPE_CHANGED'},{status:409})); await first;
 const error=kind==='template'?f.state.error:[...f.state.uploads.values()][0].error;
 assert.ok(error.includes('利用情報が変わりました'));
 const second=f.run(), retry=await prepare(f); assert.equal(retry.body.requestKey,key);
 retry.resolve(Response.json({success:false},{status:500})); await second; passed++;
}
// Later-stage failures reuse project/material. Confirm retry must not upload or create again.
for(const stage of ['signing','confirmation']){const f=fixture('dashboard'),first=f.run(),post=await prepare(f);post.resolve(Response.json({success:true,project:{id:'saved'}}));const signing=await next(f);assert.match(signing.body.requestKey,/^[0-9a-f-]{36}$/i);const signingKey=signing.body.requestKey;if(stage==='signing')signing.resolve(Response.json({success:true,...imageUpload},{status:500}));else{signing.resolve(Response.json(imageUpload));const confirm=await next(f);confirm.resolve(Response.json({success:true},{status:500}))}await first;assert.equal(f.routes.length,0);const second=f.run();const preflight=await next(f);assert.equal(preflight.body.preflight,true);preflight.resolve(Response.json({success:true}));const req=await next(f);assert.equal(req.url,stage==='signing'?'/api/interview/materials/upload-url':'/api/interview/materials/confirm');assert.equal(f.requests.filter(x=>x.url==='/api/interview/projects').length,1);if(stage==='signing'){assert.equal(req.body.requestKey,signingKey);req.resolve(Response.json(imageUpload));const confirm=await next(f);confirm.resolve(Response.json({success:true}))}else req.resolve(Response.json({success:true}));await second;assert.equal(f.xhrCalls,1);assert.equal(f.routes.length,1);passed++}
// A late storage failure after cleanup must not update state or schedule retries.
{ const f=fixture('dashboard',{xhrStatus:500,beforeLoad:env=>env.uploadsAlive.current=false}), first=f.run(), post=await prepare(f); post.resolve(Response.json({success:true,project:{id:'saved'}})); (await next(f)).resolve(Response.json(imageUpload)); await first; assert.equal(f.state.staleWrites,0); assert.equal(f.xhrCalls,1); passed++; }
// A rejected URL is renewed for the same material, without another project or row.
for(const changedId of [false,true]){
 const f=fixture('dashboard',{xhrStatuses:[403,200]}),first=f.run(),post=await prepare(f);
 post.resolve(Response.json({success:true,project:{id:'saved'}}));(await next(f)).resolve(Response.json(imageUpload));await first;
 assert.equal([...f.state.uploads.values()][0].status,'error');
 const second=f.run();(await next(f)).resolve(Response.json({success:true}));
 const signing=await next(f);assert.equal(signing.body.materialId,'material');assert.equal(signing.body.projectId,'saved');
 signing.resolve(Response.json({...imageUpload,materialId:changedId?'other':'material',signedUrl:'https://example.invalid/storage/renewed'}));
 if(!changedId)(await next(f)).resolve(Response.json({success:true}));
 await second;assert.equal(f.requests.filter(r=>r.url==='/api/interview/projects').length,1);
 assert.equal(f.xhrCalls,changedId?1:2);assert.equal(f.routes.length,changedId?0:1);
 if(!changedId)assert.equal(f.state.uploadUrls[1],'https://example.invalid/storage/renewed');
 passed++;
}
// A malformed/failed capacity preflight must stop before project creation.
for(const response of [Response.json({success:true},{status:500}),Response.json({success:'yes'}),new Response('{')]){const f=fixture('dashboard'),request=f.run();f.requests[0].resolve(response);await request;assert.equal(f.requests.length,1);assert.equal(f.routes.length,0);passed++}
// List refresh failure after confirmed storage must preserve successful upload.
for (const outcome of ['http500', 'invalid-body', 'body-deadline', 'large-success', 'success']) {
 const f=fixture('dashboard'), input={...file,type:'application/pdf'}, first=f.run(input), post=await prepare(f);
 post.resolve(Response.json({success:true,project:{id:'saved'}}));
 (await next(f)).resolve(Response.json(imageUpload));
 (await next(f)).resolve(Response.json({success:true}));
 const refresh=await next(f); assert.equal(refresh.url,'/api/interview/projects');
 if(outcome==='body-deadline') {
  refresh.resolve(new Response(new ReadableStream({pull(){return new Promise(()=>{})}})));
  await tick(); for(const expire of f.timers.values()) expire();
 } else refresh.resolve(outcome==='http500'?Response.json({success:true,projects:[]},{status:500}):outcome==='invalid-body'?new Response('{'):Response.json({success:true,projects:[{id:'saved',transcriptionSummary:outcome==='large-success'?'a'.repeat(80000):''}]}));
 await first; assert.equal([...f.state.uploads.values()][0].status,'done');
 assert.equal(f.state.listError,!['success','large-success'].includes(outcome)); assert.equal(f.timers.size,0);
 const calls=f.requests.length; await f.run(input); assert.equal(f.requests.length,calls,'refresh failure cannot trigger duplicate upload');
 assert.equal(f.xhrCalls,1); passed++;
}
console.log(JSON.stringify({passed,scope:'Actual template and dashboard callbacks plus actual shared creation reader; synthetic fetch/state/XHR/router. No real upload, signed URL, transcription, paid provider or database writes.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
