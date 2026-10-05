const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture(){
 const values=new Map();let tail=Promise.resolve(),writes=0
 const row={id:'s',organizationId:'o',status:'completed',startedAt:new Date(),endedAt:new Date(),consentedAt:new Date(),purgeAfter:null,updatedAt:new Date()}
 const db={$transaction:async fn=>{const prev=tail;let release;tail=new Promise(r=>release=r);await prev;try{return await fn(db)}finally{release()}},$queryRaw:async strings=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);return[]},
  aishodanSession:{findUnique:async()=>({...row}),update:async({data})=>Object.assign(row,data)},
  aishodanTurn:{findMany:async()=>[{id:'t1'}]},aishodanOutcome:{findUnique:async()=>null,upsert:async()=>{writes++;return{}}},
  systemSetting:{findUnique:async({where})=>values.has(where.key)?{key:where.key,value:values.get(where.key)}:null,upsert:async({where,create,update})=>{values.set(where.key,values.has(where.key)?update.value:create.value);return{}},deleteMany:async({where})=>{if(values.get(where.key)!==where.value)return{count:0};values.delete(where.key);return{count:1}}}}
 const leases=load('src/lib/aishodan/evaluation-lease.ts',{'@/lib/prisma':{prisma:db},'node:crypto':require('node:crypto')})
 const finalize=load('src/lib/aishodan/finalize-evaluation.ts',{'@/lib/prisma':{prisma:db},...require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()})
 return{row,values,writes:()=>writes,claim:(org='o')=>leases.claimEvaluationLease('s',org),release:leases.releaseEvaluationLease,commit:(lease,expectedUpdatedAt=row.updatedAt)=>finalize.finalizeEvaluation({sessionId:'s',organizationId:'o',expectedUpdatedAt,turnIds:['t1'],lease,result:{fitScore:50,verdict:'warm',reason:'Synthetic',summary:{},conditions:[],nextAction:''}})}
}
;(async()=>{
 await check('20 concurrent acquisitions grant exactly one execution right',async()=>{const f=fixture();const claims=await Promise.all(Array.from({length:20},()=>f.claim()));assert.equal(claims.filter(Boolean).length,1);assert.equal(f.values.size,1)})
 await check('active lease blocks a second worker',async()=>{const f=fixture();assert.ok(await f.claim());assert.equal(await f.claim(),null)})
 await check('normal release permits new acquisition',async()=>{const f=fixture();const first=await f.claim();await f.release(first);const second=await f.claim();assert.ok(second);assert.notEqual(second.value,first.value)})
 await check('expired worker can be replaced but cannot delete its replacement',async()=>{const f=fixture();const first=await f.claim();f.values.set(first.key,`${new Date(0).toISOString()}|old-owner`);const replacement=await f.claim();assert.ok(replacement);await f.release(first);assert.equal(f.values.get(first.key),replacement.value)})
 await check('replaced worker cannot commit an outcome',async()=>{const f=fixture();const first=await f.claim();f.values.set(first.key,`${new Date(0).toISOString()}|old-owner`);await f.claim();const result=await f.commit(first);assert.equal(result.ok,false);assert.equal(result.reason,'lease_lost');assert.equal(f.writes(),0)})
 await check('expired lease cannot commit even if value still matches',async()=>{const f=fixture();const lease=await f.claim();lease.expiresAt=new Date(0);const result=await f.commit(lease);assert.equal(result.ok,false);assert.equal(f.writes(),0)})
 await check('active owning worker commits once',async()=>{const f=fixture();const lease=await f.claim();const revision=f.row.updatedAt;assert.equal((await f.commit(lease,revision)).ok,true);assert.equal((await f.commit(lease,revision)).ok,false);assert.equal(f.writes(),1)})
 await check('malformed lease is not silently replaced',async()=>{const f=fixture();f.values.set('aishodan-evaluation-lease:v1:s','bad-value');assert.equal(await f.claim(),null);assert.equal(f.values.get('aishodan-evaluation-lease:v1:s'),'bad-value')})
 await check('foreign organization cannot claim',async()=>{const f=fixture();assert.equal(await f.claim('foreign'),null);assert.equal(f.values.size,0)})
 for(const status of ['live','pending','aborted','expired'])await check('unusable status '+status+' cannot claim',async()=>{const f=fixture();f.row.status=status;assert.equal(await f.claim(),null);assert.equal(f.values.size,0)})
 await check('revoked consent cannot claim',async()=>{const f=fixture();f.row.consentedAt=null;assert.equal(await f.claim(),null)})
 await check('expired retention cannot claim',async()=>{const f=fixture();f.row.purgeAfter=new Date(Date.now()-1);assert.equal(await f.claim(),null)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
