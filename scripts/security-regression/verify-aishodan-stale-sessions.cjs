const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
const tasks=()=>load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')})
function fixture({count=1,guestTurns=2,mutate,failTask=false}={}){
 const rows=new Map(),settings=new Map();let tail=Promise.resolve()
 for(let i=0;i<count;i++){const id='s-'+String(i).padStart(3,'0');rows.set(id,{id,organizationId:'o',status:'live',startedAt:new Date(Date.now()-7200000),updatedAt:new Date(Date.now()-3600000),endedAt:null,consentedAt:new Date(),purgeAfter:new Date('2100-01-01'),room:{scenario:{durationMin:10}}})}
 const db={
  systemSetting:{findUnique:async({where})=>settings.has(where.key)?{key:where.key,value:settings.get(where.key)}:null,upsert:async({where,create,update})=>{if(failTask&&where.key.startsWith('aishodan-evaluation-task:'))throw Error('PRIVATE_DB_DETAIL');settings.set(where.key,settings.has(where.key)?update.value:create.value);return{}}},
  aishodanSession:{findMany:async({where,take})=>Array.from(rows.values()).filter(r=>r.status==='live'&&!r.endedAt&&r.startedAt&&r.startedAt<where.startedAt.lt&&r.updatedAt<where.updatedAt.lt&&(!where.id||r.id>where.id.gt)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,take).map(r=>({id:r.id})),findUnique:async({where})=>rows.get(where.id)||null,update:async({where,data})=>Object.assign(rows.get(where.id),data)},
  aishodanTurn:{count:async({where})=>{assert.equal(where.speaker,'guest');assert.ok(rows.has(where.sessionId));return guestTurns}},
  $queryRaw:async(strings,id)=>{assert.match(strings.join('?'),/aishodan_sessions.*FOR NO KEY UPDATE/);mutate?.(rows.get(id))},
  $transaction:fn=>{const run=tail.then(async()=>{const oldRows=structuredClone(rows),oldSettings=new Map(settings);try{return await fn(db)}catch(error){rows.clear();for(const [k,v]of oldRows)rows.set(k,v);settings.clear();for(const [k,v]of oldSettings)settings.set(k,v);throw error}});tail=run.catch(()=>{});return run},
 }
 const recovery=load('src/lib/aishodan/recover-stale-sessions.ts',{'@/lib/prisma':{prisma:db},'./evaluation-task':tasks()})
 return{rows,settings,run:recovery.recoverStaleAishodanSessions,row:()=>rows.get('s-000')}
}
;(async()=>{
 await check('abandoned conversation with two answers closes and queues evaluation atomically',async()=>{const f=fixture(),result=await f.run();assert.equal(result.completed,1);assert.equal(f.row().status,'completed');assert.ok(f.row().endedAt);assert.ok(f.settings.has('aishodan-evaluation-task:v1:s-000'))})
 for(const guestTurns of [0,1])await check('insufficient answered conversation becomes aborted '+guestTurns,async()=>{const f=fixture({guestTurns}),result=await f.run();assert.equal(result.aborted,1);assert.equal(f.row().status,'aborted');assert.ok(!f.settings.has('aishodan-evaluation-task:v1:s-000'))})
 for(const [label,mutate] of [
  ['recent answer',r=>r.updatedAt=new Date()],
  ['reconnect time window',r=>{r.startedAt=new Date(Date.now()-1200000);r.room.scenario.durationMin=45}],
  ['ended',r=>{r.status='evaluated';r.endedAt=new Date()}],
  ['consent revoked',r=>r.consentedAt=null],
  ['retention expired',r=>r.purgeAfter=new Date(0)],
  ['unstarted',r=>r.startedAt=null],
 ])await check('fresh lock preserves '+label,async()=>{const f=fixture({mutate}),result=await f.run();assert.equal(result.completed,0);assert.equal(result.aborted,0);assert.equal(result.skipped,1);assert.ok(!f.settings.has('aishodan-evaluation-task:v1:s-000'))})
 await check('queue failure rolls back closing and retains conversation for retry',async()=>{const f=fixture({failTask:true}),result=await f.run();assert.equal(result.failed,1);assert.equal(f.row().status,'live');assert.equal(f.row().endedAt,null);assert.ok(!f.settings.has('aishodan-evaluation-task:v1:s-000'))})
 await check('concurrent workers close once and create only one evaluation intent',async()=>{const f=fixture(),result=await Promise.all([f.run(),f.run()]);assert.equal(result.reduce((n,s)=>n+s.completed,0),1);assert.equal(Array.from(f.settings.keys()).filter(k=>k.startsWith('aishodan-evaluation-task:')).length,1)})
 await check('cursor passes old ineligible rows to recover beyond 25 items',async()=>{const f=fixture({count:30,mutate:r=>{if(r.id<'s-025')r.consentedAt=null}});assert.equal((await f.run()).checked,25);assert.equal((await f.run()).completed,5);assert.equal(f.rows.size,30)})
 await check('recent normal activity is excluded before processing',async()=>{const f=fixture();f.row().updatedAt=new Date();assert.equal((await f.run()).checked,0);assert.equal(f.row().status,'live')})
 console.log(JSON.stringify({passed:results.length}))
})().catch(error=>{console.error(error);process.exitCode=1})
