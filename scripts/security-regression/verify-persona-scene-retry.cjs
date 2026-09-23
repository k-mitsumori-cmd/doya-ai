const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../../src/app/persona/Tool.tsx'),'utf8'),ast=ts.createSourceFile('Tool.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleGenerateScene')callback=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);
const compiled=ts.transpileModule('('+callback+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{for(const scenario of ['http500','http429','http401','network','invalid-json','missing-image','success','late-error','save-fails']){
 const persona={persona:{name:'A'}},pending=[];let errors={},images={},loading={},saved=0;
 const env={crypto:require('node:crypto'),generatedData:persona,currentPersona:{current:persona},imageAttempts:{current:{}},portraitImage:null,sceneImages:{},currentServerRecord:{current:false},setAccessWarning(){},currentRecordId:{current:'a'},imageRequests:{current:{}},scenePending:{current:new Set()},scenePrompts:{current:{}},setSceneErrors:f=>errors=typeof f==='function'?f(errors):f,setSceneImages:f=>images=f(images),setSceneLoading:f=>loading=f(loading),setError(){},accountStorage:{},savePersonaImage:()=>{if(scenario==='save-fails')throw Error('full');saved++;return true},toFriendlyError:(e,res)=>res?'status '+res.status:e.message,fetch:(url,opts)=>new Promise((resolve,reject)=>pending.push({resolve,reject,url,body:JSON.parse(opts.body)}))};
 const run=vm.runInNewContext(compiled,env);const first=run('original scene','scene-1');await run('original scene','scene-1');assert.equal(pending.length,1);
 if(scenario==='late-error')env.currentPersona.current={persona:{name:'B'}};
 if(scenario==='network'||scenario==='late-error')pending[0].reject(Error('network'));
 else if(scenario==='invalid-json')pending[0].resolve(new Response('{'));
 else if(scenario==='missing-image')pending[0].resolve(Response.json({success:true}));
 else pending[0].resolve(Response.json({success:true,image:'image'},{status:scenario.startsWith('http')?Number(scenario.slice(4)):200}));await first;
 if(scenario==='late-error'){assert.equal(Object.keys(errors).filter(k=>errors[k]).length,0);assert.equal(saved,0)}
 else if(['success','save-fails'].includes(scenario)){assert.equal(images['scene-1'],'image');assert.equal(loading['scene-1'],false);assert.equal(errors['scene-1'],'')}
 else{assert.ok(errors['scene-1']);assert.equal(loading['scene-1'],false);assert.equal(images['scene-1'],undefined);assert.equal(saved,0);const retry=run(env.scenePrompts.current['scene-1'],'scene-1');assert.equal(pending.length,2);assert.deepEqual(pending[1].body,pending[0].body);pending[1].resolve(Response.json({success:true,image:'recovered'}));await retry;assert.equal(images['scene-1'],'recovered');assert.equal(errors['scene-1'],'');assert.equal(saved,1)}
 console.log('PASS scene',scenario);
}})().catch(e=>{console.error(e);process.exitCode=1});
