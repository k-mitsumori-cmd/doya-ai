const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture(change){
 const turns=[{id:'t1',speaker:'guest',text:'First'},{id:'t2',speaker:'guest',text:'Second'}]
 const row={id:'s',organizationId:'o',roomId:'r',guestId:'g',status:'live',startedAt:new Date(),endedAt:null,updatedAt:new Date(),consentedAt:new Date(),purgeAfter:null,room:{isPreview:true,scenario:{product:{name:'Synthetic'}},organization:{name:'Synthetic'}}}
 let manual=null,writes=0,saved=null;const inputs=[]
 const db={$transaction:async fn=>fn(db),$queryRaw:async()=>[],aishodanSession:{findUnique:async()=>({...row}),findFirst:async()=>({...row}),updateMany:async({data})=>{Object.assign(row,data);return{count:1}},update:async({data})=>Object.assign(row,data)},aishodanTurn:{count:async()=>turns.length,findMany:async()=>turns.map(t=>({...t}))},aishodanSlotValue:{findMany:async()=>[]},aishodanQuestion:{findMany:async()=>[]},aishodanOutcome:{findUnique:async()=>manual,upsert:async args=>{saved=args.create;writes++;return{}}}}
 const helper=load('src/lib/aishodan/finalize-evaluation.ts',{'@/lib/prisma':{prisma:db},...require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()})
 const mocks={'next/server':{NextResponse:Response},'../turn/route':{POST:async()=>{throw Error('Unexpected turn request')}},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':{loadGuestSession:async()=>({...row})},'@/lib/aishodan/public':{toScenarioConfig:()=>({})},'@/lib/aishodan/finalize-evaluation':helper,'@/lib/aishodan/evaluate':{evaluateSession:async input=>{inputs.push(input);change?.({turns,row,attempt:inputs.length,setManual:value=>manual=value});return{fitScore:50,verdict:'warm',reason:input.turns.map(t=>t.text).join('|'),summary:{},conditions:[],nextAction:''}}},'@/lib/notifications':{postToSlackBlocks:async()=>{throw Error('Preview must not notify')}},'@/lib/aishodan/types':{VERDICT_LABELS:{warm:'Synthetic'}}};
 require('./aishodan-evaluation-mocks.cjs').attachEvaluationRunner(mocks);
 const route=load('src/app/api/aishodan/room/[token]/end/route.ts',mocks);
 return{row,inputs,saved:()=>saved,writes:()=>writes,run:async()=>{const r=await route.POST({json:async()=>({sessionId:'s'})},{params:Promise.resolve({token:'synthetic'})});return{status:r.status,body:await r.json()}}}
}
;(async()=>{
 await check('new speech during evaluation prevents stale outcome persistence',async()=>{const f=fixture(({turns,attempt})=>turns.push({id:`t3-${attempt}`,speaker:'guest',text:'Late answer'}));const r=await f.run();assert.equal(f.writes(),0);assert.equal(r.body.evaluated,false);assert.equal(f.row.status,'completed');assert.equal(f.inputs.length,3)})
 await check('session revision changed during evaluation prevents persistence',async()=>{const f=fixture(({row})=>row.updatedAt=new Date(row.updatedAt.getTime()+1));await f.run();assert.equal(f.writes(),0)})
 await check('manual outcome entered during evaluation is not overwritten',async()=>{const f=fixture(({setManual})=>setManual({overriddenAt:new Date()}));await f.run();assert.equal(f.writes(),0)})
 await check('consent revoked during evaluation prevents persistence',async()=>{const f=fixture(({row})=>row.consentedAt=null);await f.run();assert.equal(f.writes(),0)})
 await check('expired retention during evaluation prevents persistence',async()=>{const f=fixture(({row})=>row.purgeAfter=new Date(Date.now()-1));await f.run();assert.equal(f.writes(),0)})
 await check('changed session status during evaluation prevents persistence',async()=>{const f=fixture(({row})=>row.status='expired');await f.run();assert.equal(f.writes(),0);assert.equal(f.row.status,'expired')})
 await check('unchanged transcript and revision persist result',async()=>{const f=fixture();const before=f.row.updatedAt;const r=await f.run();assert.equal(f.writes(),1);assert.equal(r.body.evaluated,true);assert.equal(f.row.status,'evaluated');assert.ok(f.row.updatedAt>before)})
 await check('one late answer triggers reevaluation using latest full transcript',async()=>{const f=fixture(({turns,attempt})=>{if(attempt===1)turns.push({id:'late',speaker:'guest',text:'Late answer'})});const r=await f.run();assert.equal(r.body.evaluated,true);assert.equal(f.writes(),1);assert.equal(f.inputs.length,2);assert.equal(f.inputs[0].turns.length,2);assert.equal(f.inputs[1].turns.length,3);assert.equal(f.saved().reason,'First|Second|Late answer')})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
