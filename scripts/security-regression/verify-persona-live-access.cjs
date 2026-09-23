const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs')
const source=fs.readFileSync('src/app/persona/Tool.tsx','utf8'),ast=ts.createSourceFile('Tool.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let effect,restore
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'){const s=n.arguments[0].getText(ast);if(s.includes('const verifySavedAccess'))effect=s;if(s.includes("accountStorage.getItem('doya_persona_last')"))restore=s}ts.forEachChild(n,visit)}visit(ast)
const compile=s=>ts.transpileModule('('+s+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const helpers=load('src/lib/persona/history-records.ts'),id='11111111-1111-4111-8111-111111111111'
;(async()=>{
 for(const marker of [true,false,undefined]){
  let path=null,renders=0;const env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),savedPersonaPath:helpers.savedPersonaPath,initialRecord:undefined,accountStorage:{getItem:()=>JSON.stringify({id,serverStored:marker,data:{persona:{name:'Cached'}}})},window:{location:{replace:value=>path=value}},autoGenerateFor:{current:null},currentRecordId:{current:null},currentServerRecord:{current:false},setGeneratedData:()=>renders++,setUrl(){},setPortraitImage(){},setSceneImages(){},setError(){throw Error('unexpected')}}
  vm.runInNewContext(compile(restore),env)();assert.equal(path,marker===true?'/persona/projects/'+id:null);assert.equal(renders,marker===true?0:1)
 }
 assert.equal(helpers.savedPersonaPath({id:'../other',serverStored:true}),null);console.log('PASS server copies redirect before rendering; legacy records remain readable; invalid IDs not routed')
 for(const scenario of ['valid','deleted','unauthorized','failure','network','replaced','new-text','unmounted','hidden','legacy','busy','other-storage']){
  const listeners=new Map();let timer,resolve,calls=0,clears=0,warning='',options
  const env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),AbortController,AbortSignal,document:{hidden:scenario==='hidden',addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},window:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),setInterval:f=>{timer=f;return 1},clearInterval:()=>timer=null},accountStorage:{isKey:(k,n)=>k==='own:'+n},currentRecordId:{current:id},currentServerRecord:{current:scenario!=='legacy'},currentPersona:{current:{persona:{name:'Current'}}},textRequest:{current:scenario==='busy'?Symbol():null},autoGenerateFor:{current:null},setGeneratedData:()=>{clears++;env.currentRecordId.current=null;env.currentServerRecord.current=false},setPortraitImage(){},setSceneImages(){},setUrl(){},setModificationInput(){},setError(){},setAccessWarning:v=>warning=v,fetch:(_url,init)=>{calls++;options=init;assert.equal(init.method,'HEAD');return new Promise((ok,no)=>resolve=scenario==='network'?()=>no(Error('offline')):ok)}}
  const cleanup=vm.runInNewContext(compile(effect),env)()
  let promise
  if(scenario==='other-storage')listeners.get('storage')({key:'other:doya_persona_history'})
  else promise=listeners.get('focus')()
  if(['hidden','legacy','busy','other-storage'].includes(scenario)){assert.equal(calls,0);cleanup();continue}
  listeners.get('focus')();assert.equal(calls,1)
  if(scenario==='replaced')env.currentRecordId.current='new'
  if(scenario==='new-text')env.textRequest.current=Symbol()
  if(scenario==='unmounted')cleanup()
  const status=scenario==='valid'?204:scenario==='unauthorized'?401:scenario==='failure'?503:404
  resolve({status,ok:status===204});await promise
  assert.equal(clears,['deleted','unauthorized'].includes(scenario)?1:0)
  assert.equal(Boolean(warning),['failure','network'].includes(scenario))
  if(scenario!=='unmounted')cleanup()
  assert.equal(options.signal.aborted,true);assert.equal(listeners.size,0);assert.equal(timer,null)
  console.log('PASS live access',scenario)
 }
 const history=load('src/lib/persona/project-history.ts',{'./display-data':load('src/lib/persona/display-data.ts')})
 for(const scenario of ['owner','anonymous','foreign','deleted','invalid','failure']){
  let calls=0
  const route=load('src/app/api/persona/projects/[id]/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>scenario==='anonymous'?null:{user:{id:'owner'}}},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{personaProject:{findFirst:async input=>{calls++;assert.equal(input.where.userId,'owner');assert.equal(input.where.status,'succeeded');assert.equal(input.where.deletedAt,null);assert.equal(Object.keys(input.select).join(','),'id');if(scenario==='failure')throw Error('secret');return ['foreign','deleted'].includes(scenario)?null:{id}}}}},'@/lib/persona/project-history':history,'@/lib/persona/image-ledger':{}})
  const response=await route.HEAD(new Request('http://local'),{params:Promise.resolve({id:scenario==='invalid'?'invalid':id})})
  assert.equal(response.status,scenario==='owner'?204:scenario==='anonymous'?401:scenario==='failure'?503:404);assert.equal(await response.text(),'');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie');assert.equal(calls,['anonymous','invalid'].includes(scenario)?0:1);console.log('PASS HEAD',scenario)
 }
})().catch(error=>{console.error(error);process.exitCode=1})
