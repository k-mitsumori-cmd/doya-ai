const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture({saveFailure=false}={}){
 const turns=[],evaluations=[];let saves=0
 const row={id:'s',organizationId:'o',roomId:'r',guestId:'g',updatedAt:new Date(),status:'live',startedAt:new Date(),endedAt:null,consentedAt:new Date(),purgeAfter:null,currentPhase:'opening',room:{isPreview:true,scenario:{product:{name:'Synthetic'}},organization:{name:'Synthetic'}}}
 const db={
  $transaction:async fn=>fn(db),$queryRaw:async()=>[],
  aishodanSession:{findUnique:async()=>({...row}),updateMany:async({data})=>{if(row.endedAt)return{count:0};Object.assign(row,data);return{count:1}},findFirst:async()=>({...row}),update:async({data})=>Object.assign(row,data)},
  aishodanTurn:{findMany:async({where})=>where.id?turns.filter(t=>where.id.in.includes(t.id)):turns.slice(),findFirst:async()=>turns.length?{ord:turns.at(-1).ord}:null,createMany:async({data})=>{if(saveFailure)throw Error('Synthetic write failure');turns.push(...data);saves++;return{count:data.length}},count:async()=>turns.filter(t=>t.speaker==='guest').length},
  aishodanSlotValue:{findMany:async()=>[]},aishodanQuestion:{findMany:async()=>[]},aishodanOutcome:{findUnique:async()=>null,upsert:async()=>({})},
 }
 const session={loadGuestSession:async req=>req.headers.get('cookie')==='aishodan_gid=synthetic'?{...row}:null}
 const save=load('src/app/api/aishodan/room/[token]/turn/route.ts',{'@/lib/aishodan/evaluation-task':load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')}),'node:crypto':require('node:crypto'),'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':session})
 const finalize=load('src/lib/aishodan/finalize-evaluation.ts',{'@/lib/prisma':{prisma:db},...require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()})
 const mocks={'@/lib/aishodan/finalize-evaluation':finalize,'../turn/route':save,'next/server':{NextResponse:Response,NextRequest:Request},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':session,'@/lib/aishodan/public':{toScenarioConfig:()=>({})},'@/lib/aishodan/evaluate':{evaluateSession:async input=>{evaluations.push(input.turns.slice());return{verdict:'fit',fitScore:50,summary:{}}}},'@/lib/notifications':{postToSlackBlocks:async()=>{throw Error('Preview must not notify')}},'@/lib/aishodan/types':{VERDICT_LABELS:{fit:'Synthetic'}}};
 require('./aishodan-evaluation-mocks.cjs').attachEvaluationRunner(mocks);
 const end=load('src/app/api/aishodan/room/[token]/end/route.ts',mocks);
 return{turns,row,evaluations,saves:()=>saves,send:async body=>{const r=await end.POST(new Request('https://synthetic.invalid/api/aishodan/room/room/end',{method:'POST',headers:{'Content-Type':'application/json',cookie:'aishodan_gid=synthetic'},body:JSON.stringify({sessionId:'s',...body})}),{params:Promise.resolve({token:'room'})});return{status:r.status,body:await r.json()}}}
}
const line=(id,text='Answer')=>({id,text,speaker:'guest',startMs:100,phase:'hearing'})
;(async()=>{
 await check('bundled end saves final replies before count and evaluation with cookie preserved',async()=>{const f=fixture();const r=await f.send({turns:[line('one'),line('two')]});assert.equal(r.status,200);assert.equal(r.body.status,'evaluated');assert.equal(f.evaluations[0].length,2);assert.equal(f.turns.length,2)})
 await check('lost end response retry does not duplicate speech or evaluation',async()=>{const f=fixture();const body={turns:[line('one'),line('two')]};await f.send(body);await f.send(body);assert.equal(f.turns.length,2);assert.equal(f.evaluations.length,1);assert.equal(f.saves(),1)})
 await check('failed transcript transaction does not end meeting or evaluate',async()=>{const f=fixture({saveFailure:true});await assert.rejects(f.send({turns:[line('one'),line('two')]}));assert.equal(f.row.endedAt,null);assert.equal(f.evaluations.length,0)})
 for(const turns of [null,{},Array.from({length:51},(_,i)=>line(`id-${i}`))])await check('invalid bundled payload does not end '+(Array.isArray(turns)?turns.length:JSON.stringify(turns)),async()=>{const f=fixture();assert.equal((await f.send({turns})).status,400);assert.equal(f.row.endedAt,null);assert.equal(f.saves(),0)})
 await check('partial transcript admission refuses completion',async()=>{const f=fixture();assert.equal((await f.send({turns:[line('one'),line('two','')]})).status,409);assert.equal(f.row.endedAt,null);assert.equal(f.evaluations.length,0)})
 await check('invalid transcript identifier refuses completion',async()=>{const f=fixture();assert.equal((await f.send({turns:[line('bad/id')]})).status,400);assert.equal(f.row.endedAt,null)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
