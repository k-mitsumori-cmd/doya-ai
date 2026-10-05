const assert=require('node:assert/strict'),fs=require('node:fs')
const{load,check,results}=require('./load-typescript.cjs')
function fixture({secret='synthetic',fail=false,sessionFailure=false}={}){
 let calls=0,recoveryCalls=0;const logs=[]
 const route=load('src/app/api/cron/aishodan-work-cleanup/route.ts',{'@/lib/aishodan/recover-stale-sessions':{recoverStaleAishodanSessions:async()=>{recoveryCalls++;return{checked:1,completed:sessionFailure?0:1,aborted:0,skipped:0,failed:sessionFailure?1:0}}},'@/lib/aishodan/cleanup-work-tasks':{cleanupAishodanWorkTasks:async()=>{calls++;if(fail)throw Error('PRIVATE_DB_DETAIL');return{checked:25,removed:2,retained:23}}}},{process:{env:{CRON_SECRET:secret}},console:{error:(...args)=>logs.push(args)}})
 return{calls:()=>calls,recoveryCalls:()=>recoveryCalls,logs,run:async auth=>{const r=await route.GET(new Request('https://synthetic.invalid',{headers:auth?{authorization:auth}:{}}));return{status:r.status,body:await r.json()}}}
}
;(async()=>{
 for(const auth of [undefined,'wrong','Bearer other'])await check('cleanup unauthorized '+auth+' does no work',async()=>{const f=fixture();assert.equal((await f.run(auth)).status,401);assert.equal(f.calls(),0);assert.equal(f.recoveryCalls(),0)})
 await check('cleanup missing secret fails closed',async()=>{const f=fixture({secret:''});assert.equal((await f.run('Bearer ')).status,401);assert.equal(f.calls(),0);assert.equal(f.recoveryCalls(),0)})
 await check('authorized cleanup returns only aggregate counts',async()=>{const f=fixture();const r=await f.run('Bearer synthetic');assert.equal(r.status,200);assert.equal(r.body.removed,2);assert.equal(f.calls(),1);assert.ok(!JSON.stringify(r.body).includes('sessionId'))})
 await check('cleanup failure returns sanitized unavailable status',async()=>{const f=fixture({fail:true});const r=await f.run('Bearer synthetic');assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes('PRIVATE'));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE'))})
 await check('cleanup is scheduled exactly once at bounded frequency',async()=>{const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));const schedules=config.crons.filter(c=>c.path==='/api/cron/aishodan-work-cleanup');assert.equal(schedules.length,1);assert.equal(schedules[0].schedule,'*/15 * * * *')})
 await check('partial conversation recovery failure returns unavailable while metadata cleanup continues',async()=>{const f=fixture({sessionFailure:true});const r=await f.run('Bearer synthetic');assert.equal(r.status,503);assert.equal(r.body.ok,false);assert.equal(r.body.sessions.failed,1);assert.equal(f.calls(),1);assert.equal(f.recoveryCalls(),1)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
