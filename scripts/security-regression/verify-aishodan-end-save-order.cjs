const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture(options={}){
 const turns=[{id:'old',speaker:'guest',text:'First',ord:0,startMs:0,phase:'opening'}]
 const row={id:'s',organizationId:'o',roomId:'r',guestId:'g',status:'live',startedAt:new Date(),endedAt:null,updatedAt:new Date(),consentedAt:new Date(),purgeAfter:null,currentPhase:'opening',room:{isPreview:true,scenario:{product:{name:'Synthetic'}},organization:{name:'Synthetic'}}}
 let tail=Promise.resolve(),releaseSave,releaseCount,saveStarted,countStarted
 const saveGate=new Promise(r=>releaseSave=r),countGate=new Promise(r=>releaseCount=r)
 const saveReady=new Promise(r=>saveStarted=r),countReady=new Promise(r=>countStarted=r)
 const db={
  $transaction:async fn=>{const prev=tail;let unlock;tail=new Promise(r=>unlock=r);await prev;try{return await fn(db)}finally{unlock()}},
  $queryRaw:async strings=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);options.afterLock?.(row);return[]},
  aishodanSession:{findUnique:async()=>({...row}),findFirst:async()=>({...row}),update:async({data})=>Object.assign(row,data),updateMany:async({where,data})=>{if(row.status!==where.status||row.endedAt)return{count:0};Object.assign(row,data);return{count:1}}},
  aishodanTurn:{findMany:async({where})=>where.id?turns.filter(t=>where.id.in.includes(t.id)):turns.slice(),findFirst:async()=>({ord:turns.at(-1).ord}),createMany:async({data})=>{if(options.holdSave){saveStarted();await saveGate}turns.push(...data);return{count:data.length}},count:async()=>{const count=turns.filter(t=>t.speaker==='guest').length;if(options.holdCount){countStarted();await countGate}return count}},
  aishodanOutcome:{findUnique:async()=>null,upsert:async()=>({})},aishodanSlotValue:{findMany:async()=>[]},aishodanQuestion:{findMany:async()=>[]},
 }
 const session={loadGuestSession:async()=>({...row})}
 const save=load('src/app/api/aishodan/room/[token]/turn/route.ts',{'@/lib/aishodan/evaluation-task':load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')}),'node:crypto':require('node:crypto'),'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':session})
 const finalize=load('src/lib/aishodan/finalize-evaluation.ts',{'@/lib/prisma':{prisma:db},...require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()})
 const mocks={'../turn/route':save,'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':session,'@/lib/aishodan/finalize-evaluation':finalize,'@/lib/aishodan/public':{toScenarioConfig:()=>({})},'@/lib/aishodan/evaluate':{evaluateSession:async()=>({fitScore:50,verdict:'warm',reason:'Synthetic',summary:{},conditions:[],nextAction:''})},'@/lib/notifications':{postToSlackBlocks:async()=>{throw Error('Preview must not notify')}},'@/lib/aishodan/types':{VERDICT_LABELS:{warm:'Synthetic'}}};
 require('./aishodan-evaluation-mocks.cjs').attachEvaluationRunner(mocks);
 const end=load('src/app/api/aishodan/room/[token]/end/route.ts',mocks);
 const invoke=async(fn,body)=>{const r=await fn({json:async()=>({sessionId:'s',...body})},{params:Promise.resolve({token:'synthetic'})});return{status:r.status,body:await r.json()}}
 return{row,turns,saveReady,countReady,releaseSave,releaseCount,save:()=>invoke(save.POST,{turns:[{id:'new',speaker:'guest',text:'Second',startMs:100,phase:'opening'}]}),end:()=>invoke(end.POST,{})}
}
;(async()=>{
 await check('end waits for earlier answer save before counting completion',async()=>{const f=fixture({holdSave:true});const saving=f.save();await f.saveReady;const ending=f.end();await new Promise(r=>setImmediate(r));assert.equal(f.row.endedAt,null);assert.equal(f.turns.length,1);f.releaseSave();await saving;assert.equal((await ending).body.status,'evaluated');assert.equal(f.turns.length,2)})
 await check('end-first serialization recovers aborted status when late answers complete the conversation',async()=>{const f=fixture({holdCount:true});const ending=f.end();await f.countReady;const saving=f.save();await new Promise(r=>setImmediate(r));assert.equal(f.turns.length,1);f.releaseCount();assert.equal((await ending).body.status,'aborted');assert.equal((await saving).status,200);assert.equal(f.turns.length,2);assert.equal(f.row.status,'completed')})
 await check('consent revoked before end lock is checked fresh',async()=>{const f=fixture({afterLock:row=>row.consentedAt=null});assert.equal((await f.end()).status,403);assert.equal(f.row.endedAt,null)})
 await check('retention expires before end lock is checked fresh',async()=>{const f=fixture({afterLock:row=>row.purgeAfter=new Date(Date.now()-1)});assert.equal((await f.end()).status,410);assert.equal(f.row.endedAt,null)})
 await check('ownership changed before end lock rejects without ending',async()=>{const f=fixture({afterLock:row=>row.organizationId='other'});assert.equal((await f.end()).status,404);assert.equal(f.row.endedAt,null)})
 await check('state changed before end lock cannot be revived',async()=>{const f=fixture({afterLock:row=>row.status='expired'});assert.equal((await f.end()).status,409);assert.equal(f.row.endedAt,null)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
