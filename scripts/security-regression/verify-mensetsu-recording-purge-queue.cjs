const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
const PREFIX='mensetsu-recording-purge:v1:'
function fixture(){
 const now=new Date(),tasks=new Map();let objects=true,deletes=0,failDelete=false,failTrack=false,afterSign,duringLock
 let clock=+now
 class FakeDate extends Date {constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}}
 const row={id:'session',status:'live',consentedAt:now,startedAt:now,endedAt:null,purgeAfter:new Date(+now+1000),expiresAt:new Date(+now+86400000),updatedAt:now,recordingPath:null,organization:{recordAudio:true}}
 let mutex=Promise.resolve()
 const setting={
  findUnique:async({where})=>tasks.has(where.key)?{key:where.key,value:tasks.get(where.key)}:null,
  upsert:async({where,create,update})=>{if(failTrack)throw Error('synthetic queue failure');tasks.set(where.key,tasks.has(where.key)?update.value:create.value);return {key:where.key,value:tasks.get(where.key)}},
  findMany:async({where,orderBy,take})=>[...tasks].map(([key,value])=>({key,value})).filter(r=>r.key.startsWith(where.key.startsWith)&&r.value<=where.value.lte).sort((a,b)=>a.value.localeCompare(b.value)).slice(0,take),
  updateMany:async({where,data})=>{if(tasks.get(where.key)!==where.value)return{count:0};tasks.set(where.key,data.value);return{count:1}},
  deleteMany:async({where})=>{if(tasks.get(where.key)!==where.value)return{count:0};tasks.delete(where.key);return{count:1}},
  count:async()=>tasks.size,
 }
 const db={systemSetting:setting,$queryRaw:async(strings,...values)=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);assert.deepEqual(values,['session']);duringLock?.();return[{id:'session'}]},mensetsuSession:{findUnique:async()=>row.deleted?null:({...row})},$executeRaw:async()=>{if(row.purgeAfter<=new Date())return 0;row.recordingPath='sessions/session/interview.webm';return 1},$transaction:async(fn)=>{let release;const old=mutex;mutex=new Promise(r=>release=r);await old;const snapshot=new Map(tasks);try{return await fn(db)}catch(e){tasks.clear();snapshot.forEach((v,k)=>tasks.set(k,v));throw e}finally{release()}}}
 const storage={createSignedUploadUrl:async path=>{afterSign?.();return {signedUrl:'https://synthetic.invalid/upload',token:'synthetic-token-not-valid',path}},recordingExists:async()=>objects,deleteRecording:async path=>{assert.equal(path,'sessions/session/interview.webm');deletes++;if(failDelete)throw Error('synthetic storage error');objects=false}}
 const helper=load('src/lib/mensetsu/recording-purge-queue.ts',{'./storage':storage},{Date:FakeDate})
 const api=load('src/app/api/mensetsu/live/[token]/recording/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/mensetsu/recording-purge-queue':helper,'@/lib/mensetsu/storage':storage,'@/lib/mensetsu/public':{loadSessionByToken:async()=>({...row}),assertUsable:()=>({ok:true})}})
 return {now,row,tasks,db,helper,Date:FakeDate,get deletes(){return deletes},get objects(){return objects},set objects(v){objects=v},set failDelete(v){failDelete=v},set failTrack(v){failTrack=v},set afterSign(fn){afterSign=fn},set duringLock(fn){duringLock=fn},advance:ms=>clock+=ms,issue:()=>api.POST({}, {params:Promise.resolve({token:'synthetic'})}),ack:()=>api.PATCH({}, {params:Promise.resolve({token:'synthetic'})}),track:(time=now)=>helper.trackMensetsuRecordingUpload(db,'session',time),purge:time=>helper.purgeQueuedMensetsuRecordings(db,time),final:()=>new Date(+now+3*3600000+1)}
}
;(async()=>{
 await check('URL issuance records trace before response without marking audio saved or changing lease',async()=>{const f=fixture(),time=f.row.updatedAt;const r=await f.issue();assert.equal(r.status,200);assert.equal(f.tasks.size,1);assert.equal(f.row.recordingPath,null);assert.equal(f.row.updatedAt,time)})
 await check('DB tracking failure does not expose signed URL',async()=>{const f=fixture();f.failTrack=true;const r=await f.issue();assert.equal(r.status,502);assert.equal((await r.json()).signedUrl,undefined);assert.equal(f.tasks.size,0)})
 for(const [name,change]of [['revoked consent',f=>f.row.consentedAt=null],['unstarted',f=>f.row.startedAt=null],['ended',f=>f.row.status='completed'],['audio disabled',f=>f.row.organization.recordAudio=false],['expired link',f=>f.row.expiresAt=new Date(0)],['expired retention',f=>f.row.purgeAfter=new Date(0)],['missing retention',f=>f.row.purgeAfter=null]])await check('state change during signing prevents URL exposure: '+name,async()=>{const f=fixture();f.afterSign=()=>change(f);const r=await f.issue();assert.equal(r.status,409);assert.equal(f.tasks.size,0)})
 await check('expiry during row-lock wait cannot expose an upload URL',async()=>{const f=fixture();f.duringLock=()=>f.advance(5000);const response=await f.issue();assert.equal(response.status,409);assert.equal(f.tasks.size,0)})
 await check('repeat issuance keeps one task and the longest final-check window',async()=>{const f=fixture();f.row.purgeAfter=new Date(+f.now+3600000);await f.track(new Date(+f.now+5000));const later=f.tasks.get(PREFIX+'session');await f.track(f.now);assert.equal(f.tasks.size,1);assert.equal(f.tasks.get(PREFIX+'session'),later)})
 await check('concurrent issuance is serialized and remains one durable task',async()=>{const f=fixture();await Promise.all([f.track(),f.track()]);assert.equal(f.tasks.size,1)})
 await check('expired registration keeps unlinked audio trace and deletes it after signing window',async()=>{const f=fixture();await f.track();f.row.purgeAfter=new Date(0);assert.equal((await f.ack()).status,409);assert.equal(f.row.recordingPath,null);const result=await f.purge(f.final());assert.equal(result.finalized,1);assert.equal(result.queued,0);assert.equal(f.objects,false)})
 await check('early deletion retains trace and final pass removes a late upload',async()=>{const f=fixture();await f.track();const early=await f.purge(new Date(+f.now+2000));assert.equal(early.deferred,1);assert.equal(early.queued,1);assert.equal(f.objects,false);f.objects=true;const final=await f.purge(f.final());assert.equal(final.finalized,1);assert.equal(f.objects,false);assert.equal(f.deletes,2)})
 await check('storage error remains durable and succeeds on retry',async()=>{const f=fixture();await f.track();f.failDelete=true;const result=await f.purge(f.final());assert.equal(result.failed,1);assert.equal(result.queued,1);f.failDelete=false;const retry=await f.purge(new Date(+f.final()+5*60000+1));assert.equal(retry.finalized,1)})
 await check('actual cron reports an unregistered deferred recording and finalizes late upload',async()=>{
  const f=fixture();await f.track();f.advance(2000)
  Object.assign(f.db.mensetsuSession,{updateMany:async()=>({count:0}),findMany:async()=>[],count:async()=>0})
  const api=load('src/app/api/cron/mensetsu-purge/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:f.db},'@/lib/mensetsu/types':{EVALUATION_STALE_MS:360000},'@/lib/mensetsu/recording-purge-queue':f.helper},{Date:f.Date,process:{env:{CRON_SECRET:'synthetic-secret'}}})
  const req={headers:new Headers({authorization:'Bearer synthetic-secret'})}
  const early=await (await api.GET(req)).json();assert.equal(early.recordingPurge.queued,1);assert.equal(early.recordingPurge.deferred,1);assert.equal(f.objects,false)
  f.objects=true;f.advance(3*3600000);const final=await (await api.GET(req)).json();assert.equal(final.recordingPurge.finalized,1);assert.equal(final.recordingPurge.queued,0);assert.equal(f.objects,false)
 })
 await check('nonexistent upload still completes cleanup without false saved status',async()=>{const f=fixture();await f.track();f.objects=false;const result=await f.purge(f.final());assert.equal(result.finalized,1);assert.equal(f.row.recordingPath,null)})
 await check('live retention is not eligible for deletion',async()=>{const f=fixture();await f.track();const result=await f.purge(f.now);assert.equal(result.processed,0);assert.equal(f.deletes,0)})
 await check('extended retention reschedules without deleting audio',async()=>{const f=fixture();await f.track();f.row.purgeAfter=new Date(+f.final()+86400000);const r=await f.purge(f.final());assert.equal(r.deferred,1);assert.equal(f.deletes,0);assert.ok(f.tasks.get(PREFIX+'session').startsWith(f.row.purgeAfter.toISOString()))})
 await check('unknown current retention defers deletion rather than guessing policy',async()=>{const f=fixture();await f.track();f.row.purgeAfter=null;const r=await f.purge(f.final());assert.equal(r.deferred,1);assert.equal(f.deletes,0)})
 await check('deleted session still permits exact previously tracked file cleanup',async()=>{const f=fixture();await f.track();f.row.deleted=true;const r=await f.purge(f.final());assert.equal(r.finalized,1);assert.equal(f.objects,false)})
 await check('concurrent purge workers cannot delete the same claimed task twice',async()=>{const f=fixture();await f.track();const r=await Promise.all([f.purge(f.final()),f.purge(f.final())]);assert.equal(f.deletes,1);assert.equal(r.reduce((s,x)=>s+x.finalized,0),1)})
 for(const path of ['other/session/interview.webm','sessions/other/interview.webm','sessions/session/other.webm','sessions/../interview.webm'])await check('invalid or cross-session target is never deleted: '+path,async()=>{const f=fixture();f.tasks.set(PREFIX+'session',`1970-01-01T00:00:00.000Z|1970-01-01T00:00:00.000Z|${path}`);const r=await f.purge(f.now);assert.equal(r.failed,1);assert.equal(f.deletes,0);assert.equal(r.queued,1)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
