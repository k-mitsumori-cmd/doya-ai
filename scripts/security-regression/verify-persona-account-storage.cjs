const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const rows=new Map([['doya_persona_last','legacy private'],['doya_persona_history','legacy history']]);
const moduleExports={};
vm.runInNewContext(compile(fs.readFileSync(path.join(root,'src/lib/persona/browser-storage.ts'),'utf8')),{exports:moduleExports,window:{localStorage:{getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)}}});
const a=moduleExports.personaBrowserStorage('A'),b=moduleExports.personaBrowserStorage('B');
assert.equal(a.getItem('doya_persona_last'),null);a.setItem('doya_persona_last','A private');assert.equal(b.getItem('doya_persona_last'),null);b.setItem('doya_persona_last','B private');a.removeItem('doya_persona_last');assert.equal(b.getItem('doya_persona_last'),'B private');assert.equal(rows.get('doya_persona_last'),'legacy private');assert.throws(()=>moduleExports.personaBrowserStorage(''));
console.log('PASS account scoped reads writes deletion and legacy isolation');
const historyHelpers=require('./load-typescript.cjs').load('src/lib/persona/history-records.ts',{});
const source=fs.readFileSync(path.join(root,'src/app/persona/Tool.tsx'),'utf8');
const ast=ts.createSourceFile('Tool.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),callbacks={};
function visit(n){if(ts.isVariableDeclaration(n)&&['handleGenerate','handleModify'].includes(n.name.getText(ast)))callbacks[n.name.getText(ast)]=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);
async function run(kind,scenario){
 const old={persona:{name:'old'}}, fresh={persona:{name:'new'}};let result=old,error='',loading=false,calls=0,writes=0,resolve,reject,sequence=0,quotaNotice=null,errorAction=null;const requests=[];
 const env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),...historyHelpers,crypto:{randomUUID:()=> 'new-id-'+(++sequence)},PersonaQuotaError:class PersonaQuotaError extends Error {},currentServerRecord:{current:false},setAccessWarning(){},setErrorAction:v=>errorAction=v,setQuotaNotice:v=>quotaNotice=v,currentRecordId:{current:null},autoGenerateFor:{current:null},alive:{current:true},generationAttempt:{current:null},textRequest:{current:null},currentPersona:{current:old},generatedData:old,url:'https://example.invalid',serviceName:'example',additionalInfo:'',modificationInput:'change',modifying:false,portraitAutoTriggered:{current:true},sceneAutoTriggered:{current:true},setLoading:v=>loading=v,setModifying:v=>loading=v,setError:v=>error=v,setPortraitError(){},setGeneratedData:v=>{result=v;env.currentPersona.current=v},setPortraitImage(){},setSceneImages(){},setModificationInput(){},toFriendlyError:e=>e.message,accountStorage:{getItem:()=> '[]',setItem:()=>{if(scenario==='full')throw Error('full');writes++}},fetch:(_url,options)=>{requests.push(JSON.parse(options.body));calls++;return new Promise((yes,no)=>{resolve=yes;reject=no})}};
 const fn=vm.runInNewContext(compile('('+callbacks[kind]+');'),env);const pending=fn();assert.equal(calls,1);await fn();assert.equal(calls,1,'duplicate request prevented');
 if(scenario==='quota'){
  resolve(Response.json({code:'DAILY_LIMIT_REACHED',error:'本日の上限に達しました'},{status:429}));await pending;
  assert.equal(quotaNotice,'text');assert.equal(error,'本日の上限に達しました');assert.equal(errorAction,null);assert.equal(writes,0);
  console.log('PASS',kind,scenario);return;
 }
 if(scenario==='retry'||scenario==='changed-input'){
  reject(Error('Network interrupted'));await pending;
  if(scenario==='changed-input'){env.additionalInfo='different';env.modificationInput='different'}
  const retry=fn();assert.equal(calls,2);
  assert.equal(requests[0].requestKey===requests[1].requestKey,scenario==='retry');
  resolve(Response.json({data:fresh,projectId:'server-owned-id'}));await retry;
  assert.equal(env.currentRecordId.current,'server-owned-id');assert.equal(env.generationAttempt.current,null);
  console.log('PASS',kind,scenario);return;
 }
 if(scenario==='unmounted'||scenario==='late-error'){env.alive.current=false;env.textRequest.current=null;}
 if(scenario==='replaced')env.currentPersona.current={persona:{name:'replacement'}};
 if(scenario==='late-error')reject(Error('late'));else resolve(Response.json({data:fresh}));await pending;
 if(['unmounted','late-error','replaced'].includes(scenario)){assert.equal(writes,0);assert.notEqual(result?.persona?.name,'new');assert.equal(error,'')}
 else {assert.equal(result.persona.name,'new');assert.equal(env.autoGenerateFor.current,result);assert.equal(loading,false);assert.equal(env.textRequest.current,null);if(scenario==='full'){assert.match(error,/完了しましたが/);assert.equal(writes,0)}else {assert.equal(error,'');assert.ok(writes>0)}}
 console.log('PASS',kind,scenario);
}
(async()=>{for(const kind of ['handleGenerate','handleModify'])for(const s of ['normal','unmounted','late-error','full','retry','changed-input','quota'])await run(kind,s);await run('handleModify','replaced')})().catch(e=>{console.error(e);process.exitCode=1});
