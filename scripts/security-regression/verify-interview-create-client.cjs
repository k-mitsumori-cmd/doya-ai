const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const file=path.resolve(__dirname,'../../src/app/interview/projects/new/page.tsx'),source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleSubmit')callback=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const reader=compile(fs.readFileSync(path.resolve(__dirname,'../../src/lib/interview/creation-response.ts'),'utf8'));
const tick=()=>new Promise(r=>setImmediate(r)),scope='a'.repeat(64);
function fixture(){const requests=[],timers=new Map(),routes=[];let timer=0;const state={error:'',loading:false,login:false};const env={title:'synthetic',intervieweeName:'',intervieweeRole:'',intervieweeCompany:'',genre:'',theme:'',targetAudience:'',tone:'friendly',crypto:require('node:crypto'),AbortController,activeCreate:{current:null},creationAttempt:{current:null},setError:v=>state.error=v,setLoading:v=>state.loading=v,setLoginRequired:v=>state.login=v,router:{push:url=>routes.push(url)}};const exports={};vm.runInNewContext(reader,{exports,Error,TextDecoder,TextEncoder,AbortController,fetch:(url,init)=>new Promise((resolve,reject)=>requests.push({url,init,resolve,reject})),setTimeout:(fn,ms)=>{assert.equal(ms,35000);timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id)});Object.assign(env,exports);const fn=vm.runInNewContext(compile('('+callback+');'),env);return{env,state,requests,timers,routes,run:()=>fn({preventDefault(){}})}}
async function prepare(f){const request=f.requests.at(-1);assert.ok(request.url.includes('prepareCreate=1'));request.resolve(Response.json({success:true,creationScope:scope}));await tick();return f.requests.at(-1)}
(async()=>{let passed=0;
 for(const scenario of ['success','http500-success-body','missing-id','object-id','path-id','truthy-success','invalid-json','private-network','headers-oversize','stream-oversize','body-error','fetch-deadline','body-deadline','quota','http400','http401','cookie-required','scope-change','conflict','unmounted']){
  const f=fixture(),first=f.run();await f.run();assert.equal(f.requests.length,1,'duplicate is rejected during preparation');assert.equal(f.state.loading,true);
  const post=await prepare(f);assert.equal(f.requests.length,2);assert.equal(post.url,'/api/interview/projects');assert.match(JSON.parse(post.init.body).requestKey,/^[a-f0-9-]{36}$/);assert.equal(JSON.parse(post.init.body).creationScope,scope);await f.run();assert.equal(f.requests.length,2,'duplicate is rejected during POST');
  if(scenario==='private-network')post.reject(Error('SYNTHETIC_PRIVATE'));
  else if(scenario==='fetch-deadline'){for(const expire of f.timers.values())expire()}
  else if(scenario==='body-deadline'){
   let canceled=0;post.resolve(new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){canceled++}})));await tick();for(const expire of f.timers.values())expire();await first;assert.equal(canceled,1);
  }else if(scenario==='headers-oversize')post.resolve(new Response('{}',{headers:{'content-length':'65537'}}));
  else if(scenario==='stream-oversize')post.resolve(new Response('x'.repeat(65537)));
  else if(scenario==='body-error')post.resolve(new Response(new ReadableStream({pull(c){c.error(Error('SYNTHETIC_PRIVATE'))}})));
  else if(scenario==='invalid-json')post.resolve(new Response('{'));
  else{
   if(scenario==='unmounted'){f.env.activeCreate.current.abort();f.env.activeCreate.current=null}
   const id=scenario==='missing-id'?undefined:scenario==='object-id'?{}:scenario==='path-id'?'../foreign':'synthetic';
   const status=scenario==='http500-success-body'?500:scenario==='quota'?429:scenario==='http400'?400:scenario==='http401'?401:['cookie-required','scope-change','conflict'].includes(scenario)?409:200;
   const code=scenario==='quota'?'GUEST_LIMIT':scenario==='cookie-required'?'GUEST_SESSION_REQUIRED':scenario==='scope-change'?'CREATION_SCOPE_CHANGED':scenario==='conflict'?'REQUEST_CONFLICT':undefined;
   post.resolve(Response.json({success:scenario==='truthy-success'?'yes':true,project:{id},code,error:'SYNTHETIC_PRIVATE'},{status}));
  }
  await first;assert.equal(f.timers.size,0);assert.ok(!f.state.error.includes('SYNTHETIC_PRIVATE'));
  if(scenario==='success'){assert.deepEqual(f.routes,['/interview/projects/synthetic/materials']);assert.equal(f.state.loading,true);await f.run();assert.equal(f.requests.length,2,'navigation retains synchronous lock')}
  else{assert.equal(f.routes.length,0);if(scenario==='unmounted'){assert.equal(f.state.error,'')}else{assert.ok(f.state.error);assert.equal(f.state.loading,false);assert.equal(f.env.activeCreate.current,null);assert.equal(f.state.login,['quota','http401'].includes(scenario));const second=f.run();const retry=await prepare(f);assert.equal(JSON.parse(retry.init.body).requestKey,JSON.parse(post.init.body).requestKey,'uncertain result retains operation key');retry.resolve(Response.json({success:true,project:{id:'recovered'}}));await second;assert.deepEqual(f.routes,['/interview/projects/recovered/materials'])}}
  passed++;
 }
 for(const scenario of ['preparation-error','preparation-private-network','preparation-invalid','preparation-deadline','preparation-unmounted']){const f=fixture(),first=f.run(),req=f.requests[0];if(scenario==='preparation-private-network')req.reject(Error('SYNTHETIC_PRIVATE'));else if(scenario==='preparation-deadline')for(const expire of f.timers.values())expire();else{if(scenario==='preparation-unmounted'){f.env.activeCreate.current.abort();f.env.activeCreate.current=null}req.resolve(Response.json({success:true,creationScope:scenario==='preparation-invalid'?'bad':scope},{status:scenario==='preparation-error'?500:200}))}await first;assert.equal(f.requests.length,1,'failed preparation never writes');assert.equal(f.routes.length,0);assert.equal(f.timers.size,0);assert.ok(!f.state.error.includes('SYNTHETIC_PRIVATE'));passed++}
 const f=fixture();f.env.creationAttempt.current={input:JSON.stringify({title:'synthetic',intervieweeName:null,intervieweeRole:null,intervieweeCompany:null,genre:null,theme:null,targetAudience:null,tone:'friendly'}),key:'old',scope:'b'.repeat(64)};const changed=f.run();f.requests[0].resolve(Response.json({success:true,creationScope:scope}));await changed;assert.equal(f.requests.length,1);assert.equal(f.env.creationAttempt.current,null);assert.ok(f.state.error);passed++;
 assert.match(source,/role="alert"/);assert.match(source,/href="\/interview\/projects"/);assert.match(source,/<fieldset disabled=\{loading\}/);
 console.log(JSON.stringify({passed,scope:'Actual creation callback with actual bounded reader, synthetic fetch/state/clock/router. No real project creation or browser E2E.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
