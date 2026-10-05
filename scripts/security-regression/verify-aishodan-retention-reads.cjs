const assert=require('node:assert/strict')
const{load,check,results}=require('./load-typescript.cjs')
const now=new Date()
const base={organizationId:'o',room:{isPreview:false,name:'Synthetic',scenario:{product:{name:'Synthetic'}}},guestName:'Synthetic',guestCompany:'Synthetic',turns:[],slotValues:[],questions:[],currentPhase:'closing',startedAt:now,endedAt:new Date(now.getTime()+60000),createdAt:now,schedulingClickedAt:null}
const rows=[
 {...base,id:'expired',purgeAfter:new Date(0),guestName:'PRIVATE_EXPIRED_GUEST',status:'evaluated',outcome:{fitScore:80,verdict:'hot',overriddenAt:null}},
 {...base,id:'current',purgeAfter:new Date('2100-01-01'),status:'evaluated',outcome:{fitScore:50,verdict:'warm',overriddenAt:null}},
 {...base,id:'legacy',purgeAfter:null,status:'evaluated',outcome:{fitScore:50,verdict:'warm',overriddenAt:null}},
 {...base,id:'stale',purgeAfter:null,status:'completed',outcome:{fitScore:80,verdict:'hot',overriddenAt:null}},
 {...base,id:'manual',purgeAfter:null,status:'completed',outcome:{fitScore:80,verdict:'hot',overriddenAt:now}},
]
function retained(row,where){assert.equal(where.organizationId,'o');assert.ok(where.AND?.[0].OR);const filter=where.AND[0].OR;assert.equal(filter[0].purgeAfter,null);assert.ok(filter[1].purgeAfter.gt instanceof Date);return row.purgeAfter===null||row.purgeAfter>filter[1].purgeAfter.gt}
function eligible(where){return rows.filter(row=>retained(row,where)&&(!where.status||where.status===row.status)&&(!where.schedulingClickedAt||row.schedulingClickedAt)&&(!where.outcome||row.outcome.verdict===where.outcome.verdict&&where.OR.some(c=>c.status===row.status||c.outcome?.overriddenAt&&row.outcome.overriddenAt)))}
const common={'next/server':{NextResponse:Response},'@/lib/aishodan/access':{getAishodanContext:async()=>({organizationId:'o'}),orgSlugFrom:()=> 'o'}}
;(async()=>{
 await check('expired detail is unavailable before reading task or returning guest data',async()=>{
  let taskReads=0;const route=load('src/app/api/aishodan/sessions/[id]/route.ts',{...common,'@/lib/prisma':{prisma:{aishodanSession:{findFirst:async({where})=>{assert.equal(where.organizationId,'o');return rows[0]}},systemSetting:{findUnique:async()=>{taskReads++;return null}}}},'@/lib/aishodan/public':{toScenarioConfig:()=>{throw Error('Expired config must not be rendered')}},'@/lib/aishodan/evaluation-view':{evaluationView:()=>{throw Error('Expired outcome must not be rendered')}}})
  const r=await route.GET({}, {params:Promise.resolve({id:'expired'})});const body=await r.json();assert.equal(r.status,410);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(!JSON.stringify(body).includes('PRIVATE_EXPIRED'));assert.equal(taskReads,0)
 })
 await check('list, totals and cursor validation all use the same retention filter',async()=>{
  const route=load('src/app/api/aishodan/sessions/route.ts',{...common,'@/lib/prisma':{prisma:{aishodanSession:{findMany:async({where})=>eligible(where),count:async({where})=>eligible(where).length,findFirst:async({where})=>eligible(where).find(row=>row.id===where.id)||null}}}})
  let r=await route.GET(new Request('https://synthetic.invalid'));let body=await r.json();assert.equal(body.total,4);assert.ok(body.sessions.every(s=>s.id!=='expired'));assert.ok(!JSON.stringify(body).includes('PRIVATE_EXPIRED'));assert.equal(body.sessions.find(s=>s.id==='stale').outcome,null)
  r=await route.GET(new Request('https://synthetic.invalid?cursor=expired'));assert.equal(r.status,400)
  body=await(await route.GET(new Request('https://synthetic.invalid?verdict=hot'))).json();assert.equal(body.total,1);assert.equal(body.sessions[0].id,'manual')
 })
 await check('stats exclude expired questions and stale AI verdicts while retaining legacy data',async()=>{
  const questions=rows.map(row=>({id:row.id+'-q',sessionId:row.id,text:row.id==='expired'?'PRIVATE_EXPIRED_QUESTION':'Question '+row.id,createdAt:now}))
  const route=load('src/app/api/aishodan/stats/route.ts',{...common,'@/lib/prisma':{prisma:{aishodanSession:{count:async({where})=>eligible(where).length,findMany:async({where})=>eligible(where)},aishodanOutcome:{groupBy:async({where})=>{assert.ok(where.OR);const all=eligible(where.session).filter(row=>where.OR.some(c=>c.session?.status===row.status||c.overriddenAt&&row.outcome.overriddenAt));return['hot','warm'].map(verdict=>({verdict,_count:{verdict:all.filter(row=>row.outcome.verdict===verdict).length}}))}},aishodanQuestion:{findMany:async({where})=>questions.filter(q=>eligible(where.session).some(s=>s.id===q.sessionId))}}}})
  const body=await(await route.GET(new Request('https://synthetic.invalid'))).json();assert.equal(body.total,4);assert.equal(body.evaluated,2);assert.equal(body.byVerdict.hot,1);assert.equal(body.byVerdict.warm,2);assert.ok(!JSON.stringify(body).includes('PRIVATE_EXPIRED'));assert.equal(body.unanswered.length,4)
 })
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
