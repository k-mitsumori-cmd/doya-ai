const assert=require('node:assert/strict')
const{load,check,results}=require('./load-typescript.cjs')
const mocks=require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()
const tasks=mocks['./completion-notification-task']
function fixture({preview=false,failQueue=false}={}){
 const row={id:'s',organizationId:'o',status:'completed',startedAt:new Date(),endedAt:new Date(),consentedAt:new Date(),purgeAfter:null,updatedAt:new Date(),room:{isPreview:preview}}
 const values=new Map();let outcome=null
 const db={$queryRaw:async()=>[],
  $transaction:async fn=>{const before={...row},old=outcome,previous=new Map(values);try{return await fn(db)}catch(e){Object.assign(row,before);outcome=old;values.clear();for(const[k,v]of previous)values.set(k,v);throw e}},
  aishodanSession:{findUnique:async()=>({...row}),update:async({data})=>Object.assign(row,data)},
  aishodanTurn:{findMany:async()=>[{id:'t'}]},
  aishodanOutcome:{findUnique:async()=>outcome,upsert:async({create,update})=>outcome=outcome?{...outcome,...update}:{id:'outcome',...create}},
  systemSetting:{findUnique:async({where})=>values.has(where.key)?{key:where.key,value:values.get(where.key)}:null,deleteMany:async({where})=>{const found=values.has(where.key);values.delete(where.key);return{count:Number(found)}},upsert:async({where,create,update})=>{if(failQueue)throw Error('Synthetic DB failure');values.set(where.key,values.has(where.key)?update.value:create.value);return{}}},
 }
 const finalizer=load('src/lib/aishodan/finalize-evaluation.ts',{'@/lib/prisma':{prisma:db},...mocks})
 return{row,values,outcome:()=>outcome,run:(notifyOnCompletion=true)=>finalizer.finalizeEvaluation({sessionId:'s',organizationId:'o',expectedUpdatedAt:row.updatedAt,turnIds:['t'],notifyOnCompletion,result:{fitScore:50,verdict:'warm',reason:'PRIVATE_TRANSCRIPT',summary:{},conditions:[],nextAction:'PRIVATE_NEXT_ACTION'}})}
}
;(async()=>{
 await check('automatic result commits notification intent at persisted session revision',async()=>{const f=fixture();assert.equal((await f.run()).ok,true);const[[key,value]]=f.values;const task=tasks.parseCompletionNotification(key,value);assert.equal(task.sessionId,'s');assert.equal(task.organizationId,'o');assert.equal(task.revision.getTime(),f.row.updatedAt.getTime());assert.equal(task.failures,0);assert.ok(!value.includes('PRIVATE'));assert.equal(f.row.status,'evaluated')})
 await check('preview result never queues host notification',async()=>{const f=fixture({preview:true});assert.equal((await f.run()).ok,true);assert.equal(f.values.size,0)})
 await check('manual reevaluation does not introduce automatic notification',async()=>{const f=fixture();assert.equal((await f.run(false)).ok,true);assert.equal(f.values.size,0)})
 await check('queue failure rolls back result and completion state together',async()=>{const f=fixture({failQueue:true});const before=f.row.updatedAt;await assert.rejects(f.run());assert.equal(f.outcome(),null);assert.equal(f.row.status,'completed');assert.equal(f.row.updatedAt,before);assert.equal(f.values.size,0)})
 await check('ineligible record cannot queue a notification',async()=>{const f=fixture();f.row.consentedAt=null;assert.equal((await f.run()).ok,false);assert.equal(f.values.size,0);assert.equal(f.outcome(),null)})
 await check('later automatic revision replaces intent with new token',async()=>{const f=fixture();await f.run();const[[key,old]]=f.values;const before=tasks.parseCompletionNotification(key,old);f.row.status='completed';await f.run();const next=tasks.parseCompletionNotification(key,f.values.get(key));assert.ok(next.revision>before.revision);assert.notEqual(next.token,before.token);assert.equal(f.values.size,1)})
 await check('notification parser refuses another task namespace',async()=>{assert.equal(tasks.parseCompletionNotification('aishodan-evaluation-task:v1:s','invalid'),null)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
