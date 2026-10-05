const assert=require('node:assert/strict')
const{load,check,results}=require('./load-typescript.cjs')
const evaluation=load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')})
const notification=require('./aishodan-evaluation-mocks.cjs').completionNotificationMocks()['./completion-notification-task']
const cursorKey='aishodan-work-cleanup-cursor:v1'
const prefixes=[evaluation.EVALUATION_TASK_PREFIX,'aishodan-evaluation-lease:v1:',notification.COMPLETION_NOTIFICATION_PREFIX,notification.FAILURE_NOTIFICATION_PREFIX]
function fixture(){
 const rows=new Map(),sessions=new Map();let onRead
 const db={$queryRaw:async strings=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);return[]},$transaction:async fn=>fn(db),
 aishodanSession:{findUnique:async({where})=>{await onRead?.(where.id);return sessions.get(where.id)||null}},
 systemSetting:{findUnique:async({where})=>rows.has(where.key)?{key:where.key,value:rows.get(where.key)}:null,
 findMany:async({where,take})=>{assert.equal(take,25);return[...rows].filter(([key])=>where.OR.some(c=>key.startsWith(c.key.startsWith))&&(!where.key||key>where.key.gt)).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,take).map(([key,value])=>({key,value}))},
 deleteMany:async({where})=>{if(rows.get(where.key)!==where.value)return{count:0};rows.delete(where.key);return{count:1}},
 upsert:async({where,create,update})=>{rows.set(where.key,rows.has(where.key)?update.value:create.value);return{}},
 }}
 const worker=load('src/lib/aishodan/cleanup-work-tasks.ts',{'@/lib/prisma':{prisma:db},'./evaluation-task':evaluation,'./completion-notification-task':notification})
 return{rows,sessions,run:worker.cleanupAishodanWorkTasks,set onRead(fn){onRead=fn},add:(id,prefix=prefixes[0],value='metadata')=>{rows.set(prefix+id,value);return prefix+id}}
}
;(async()=>{
 for(const prefix of prefixes)await check('expired session cleans only metadata '+prefix,async()=>{const f=fixture();f.sessions.set('s',{consentedAt:new Date(),purgeAfter:new Date(0)});const key=f.add('s',prefix);assert.equal((await f.run()).removed,1);assert.ok(!f.rows.has(key));assert.equal(f.sessions.size,1)})
 await check('missing session metadata is removed',async()=>{const f=fixture();f.add('s');assert.equal((await f.run()).removed,1)})
 await check('revoked consent metadata is removed',async()=>{const f=fixture();f.sessions.set('s',{consentedAt:null,purgeAfter:null});f.add('s');assert.equal((await f.run()).removed,1)})
 await check('active and stopped tasks are retained until owner retention expires',async()=>{const f=fixture();f.sessions.set('s',{consentedAt:new Date(),purgeAfter:new Date(Date.now()+100000)});for(const prefix of prefixes)f.add('s',prefix,'9999-01-01T00:00:00.000Z|synthetic');assert.equal((await f.run()).removed,0);assert.equal(f.rows.size,5)})
 await check('expired lease is removed without removing active transcript tasks',async()=>{const f=fixture();f.sessions.set('s',{consentedAt:new Date(),purgeAfter:null});f.add('s',prefixes[1],'1970-01-01T00:00:00.000Z|owner');f.add('s');assert.equal((await f.run()).removed,1);assert.ok(f.rows.has(prefixes[0]+'s'))})
 await check('malformed live lease is retained for investigation',async()=>{const f=fixture();f.sessions.set('s',{consentedAt:new Date(),purgeAfter:null});f.add('s',prefixes[1],'broken');assert.equal((await f.run()).removed,0)})
 await check('sweep cannot remove replacement task',async()=>{const f=fixture();const key=f.add('s');f.onRead=async()=>{f.rows.set(key,'replacement')};assert.equal((await f.run()).removed,0);assert.equal(f.rows.get(key),'replacement')})
 await check('fresh retention inside lock prevents deletion',async()=>{const f=fixture();f.sessions.set('s',{consentedAt:new Date(),purgeAfter:new Date(0)});f.add('s');f.onRead=async()=>f.sessions.set('s',{consentedAt:new Date(),purgeAfter:new Date(Date.now()+100000)});assert.equal((await f.run()).removed,0)})
 await check('cursor passes live oldest rows and wraps after a bounded cycle',async()=>{const f=fixture();for(let i=0;i<30;i++){const id='s'+String(i).padStart(2,'0');f.add(id);if(i<25)f.sessions.set(id,{consentedAt:new Date(),purgeAfter:null})}const first=await f.run();assert.equal(first.checked,25);assert.equal(first.removed,0);assert.ok(f.rows.get(cursorKey));const second=await f.run();assert.equal(second.checked,5);assert.equal(second.removed,5);assert.equal(f.rows.get(cursorKey),'');assert.equal((await f.run()).checked,25)})
 await check('unrelated settings and malformed session keys are untouched',async()=>{const f=fixture();f.rows.set('slack_webhook','PRIVATE_SETTING');const key=f.add('bad/id');await f.run();assert.equal(f.rows.get('slack_webhook'),'PRIVATE_SETTING');assert.ok(f.rows.has(key))})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
