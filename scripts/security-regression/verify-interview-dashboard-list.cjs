const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const file='src/app/interview/Tool.tsx',source=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect;
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes("readInterviewCreationResponse('/api/interview/projects'"))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);assert.ok(effect);
const reader=compile(fs.readFileSync(path.join(root,'src/lib/interview/creation-response.ts'),'utf8')),tick=()=>new Promise(r=>setImmediate(r));
function fixture(actor='owner'){
 const requests=[],timers=new Map(),state={projects:[{id:'old'}],error:true,loading:false};let t=0;const exports={};
 vm.runInNewContext(reader,{exports,Error,AbortController,TextDecoder,TextEncoder,fetch:(url,init)=>new Promise((resolve,reject)=>requests.push({url,init,resolve,reject})),setTimeout:fn=>{timers.set(++t,fn);return t},clearTimeout:id=>timers.delete(id)});
 const run=vm.runInNewContext(compile('('+effect+');'),{...exports,AbortController,Error,Array,uploadActor:actor,setProjects:v=>state.projects=v,setProjectListError:v=>state.error=v,setLoading:v=>state.loading=v});
 return{requests,timers,state,cleanup:run()};
}
(async()=>{let passed=0;
 for(const kind of ['success','large','http500','truthy','invalid','network','deadline']){
  const f=fixture();assert.equal(f.state.projects.length,0);assert.equal(f.state.loading,true);assert.equal(f.requests[0].init.cache,'no-store');
  if(kind==='network')f.requests[0].reject(Error('PRIVATE_SYNTHETIC'));
  else if(kind==='deadline'){f.requests[0].resolve(new Response(new ReadableStream({pull(){return new Promise(()=>{})}})));await tick();for(const expire of f.timers.values())expire()}
  else f.requests[0].resolve(kind==='invalid'?new Response('{'):Response.json({success:kind==='truthy'?'yes':true,projects:[{id:'new',summary:kind==='large'?'a'.repeat(80000):''}]},{status:kind==='http500'?500:200}));
  await tick();await tick();assert.equal(f.state.loading,false);assert.equal(f.state.error,!['success','large'].includes(kind));assert.equal(f.state.projects.length,['success','large'].includes(kind)?1:0);assert.equal(f.timers.size,0);passed++;
 }
 for(const kind of ['success','network']){
  const f=fixture();f.cleanup();const snapshot=JSON.stringify(f.state);assert.equal(f.requests[0].init.signal.aborted,true);
  if(kind==='success')f.requests[0].resolve(Response.json({success:true,projects:[{id:'other-owner'}]}));else f.requests[0].reject(Error('private'));
  await tick();await tick();assert.equal(JSON.stringify(f.state),snapshot);assert.equal(f.timers.size,0);passed++;
 }
 const guest=fixture('guest');assert.equal(guest.requests.length,0);assert.equal(guest.state.projects.length,0);assert.equal(guest.state.loading,false);assert.equal(guest.state.error,false);passed++;
 console.log(JSON.stringify({passed,scope:'Actual dashboard list effect and bounded reader; synthetic fetch/state/timer. Cleanup simulates actor change/unmount; no browser/auth/database E2E.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
