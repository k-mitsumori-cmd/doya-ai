const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
const tasks=load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')})
const view=load('src/lib/aishodan/evaluation-view.ts',{'./evaluation-task':tasks})
const base=()=>({id:'s',organizationId:'o',status:'completed',startedAt:new Date(),endedAt:new Date(),outcome:{fitScore:50,verdict:'warm',overriddenAt:null}})
const queued=(failures=0,organizationId='o')=>({key:'aishodan-evaluation-task:v1:s',value:tasks.evaluationTaskValue({sessionId:'s',organizationId,revision:new Date(),readyAt:new Date(),failures,token:'synthetic'})})
;(async()=>{
 await check('stale AI result is hidden while original report remains intact',async()=>{const s=base();const result=view.evaluationView(s,queued());assert.equal(result.outcome,null);assert.equal(result.evaluationStatus,'pending');assert.equal(result.hasPreviousOutcome,true);assert.equal(s.outcome.fitScore,50)})
 await check('failed task is shown as retrying',async()=>{assert.equal(view.evaluationView(base(),queued(1)).evaluationStatus,'retrying')})
 await check('exhausted task is shown as stopped instead of processing forever',async()=>{assert.equal(view.evaluationView(base(),queued(3)).evaluationStatus,'stopped')})
 await check('missing task does not imply automatic processing',async()=>{assert.equal(view.evaluationView(base(),null).evaluationStatus,'unavailable')})
 await check('current AI report is displayed',async()=>{const s=base();s.status='evaluated';const result=view.evaluationView(s,null);assert.equal(result.outcome.fitScore,50);assert.equal(result.evaluationStatus,'ready')})
 await check('manual decision remains visible despite queued transcript changes',async()=>{const s=base();s.outcome.overriddenAt=new Date();const result=view.evaluationView(s,queued(3));assert.equal(result.outcome.fitScore,50);assert.equal(result.evaluationStatus,'manual')})
 await check('foreign task metadata cannot affect displayed status',async()=>{assert.equal(view.evaluationView(base(),queued(3,'foreign')).evaluationStatus,'unavailable')})
 await check('unstarted session does not promise evaluation',async()=>{const s=base();s.startedAt=null;s.endedAt=null;s.outcome=null;assert.equal(view.evaluationView(s,queued()).evaluationStatus,null)})
 await check('actual detail API scopes task lookup and hides stale report',async()=>{
  const session={...base(),turns:[],slotValues:[],questions:[],room:{name:'Synthetic',isPreview:false,scenario:{product:{name:'Synthetic'}}}}
  let taskReads=0
  const route=load('src/app/api/aishodan/sessions/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{aishodanSession:{findFirst:async({where})=>{assert.equal(where.organizationId,'o');assert.equal(where.id,'s');return session}},systemSetting:{findUnique:async({where})=>{taskReads++;assert.equal(where.key,'aishodan-evaluation-task:v1:s');return queued(3)}}}},'@/lib/aishodan/access':{getAishodanContext:async()=>({organizationId:'o'}),orgSlugFrom:()=> 'o',hasMinRole:()=>false},'@/lib/aishodan/public':{toScenarioConfig:()=>({slots:[],phases:[]})},'@/lib/aishodan/evaluation-view':view})
  const response=await route.GET({}, {params:Promise.resolve({id:'s'})});const body=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(body.session.outcome,null);assert.equal(body.session.evaluationStatus,'stopped');assert.equal(taskReads,1);assert.ok(!JSON.stringify(body).includes('synthetic'));assert.equal(session.outcome.fitScore,50)
 })
 await check('actual list suppresses stale scores and filters by current or manual verdict',async()=>{
  const rows=[{id:'stale',status:'completed',outcome:{fitScore:10,verdict:'cold',overriddenAt:null}},{id:'current',status:'evaluated',outcome:{fitScore:10,verdict:'cold',overriddenAt:null}},{id:'manual',status:'completed',outcome:{fitScore:10,verdict:'cold',overriddenAt:new Date()}}]
  const eligible=where=>{assert.equal(where.organizationId,'o');return rows.filter(row=>!where.outcome||row.outcome.verdict===where.outcome.verdict&&where.OR.some(clause=>clause.status===row.status||clause.outcome?.overriddenAt&&row.outcome.overriddenAt))}
  const route=load('src/app/api/aishodan/sessions/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{aishodanSession:{findMany:async({where})=>eligible(where),count:async({where})=>eligible(where).length}}},'@/lib/aishodan/access':{getAishodanContext:async()=>({organizationId:'o'}),orgSlugFrom:()=> 'o'}})
  let body=await(await route.GET(new Request('https://synthetic.invalid/api/aishodan/sessions'))).json();assert.equal(body.sessions[0].outcome,null);assert.equal(body.sessions[1].outcome.fitScore,10);assert.equal(body.sessions[2].outcome.fitScore,10)
  body=await(await route.GET(new Request('https://synthetic.invalid/api/aishodan/sessions?verdict=cold'))).json();assert.deepEqual(body.sessions.map(s=>s.id),['current','manual']);assert.equal(body.total,2)
 })
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
