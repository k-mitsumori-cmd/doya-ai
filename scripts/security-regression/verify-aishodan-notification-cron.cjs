const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {load,check,results}=require('./load-typescript.cjs')
function fixture({secret='synthetic',failure=false,exhausted=0,failureNoticeExhausted=0}={}){
 const calls=[],logs=[],failureCalls=[]
 const route=load('src/app/api/cron/aishodan-notifications/route.ts',{'@/lib/aishodan/deliver-completion-notifications':{deliverPendingFailureNotifications:async limit=>{failureCalls.push(limit);return{sent:0,retried:0,exhausted:failureNoticeExhausted,skipped:0}},deliverPendingCompletionNotifications:async limit=>{calls.push(limit);if(failure)throw Error('PRIVATE_PROVIDER_FAILURE');return{processed:1,sent:1,busy:0,retried:0,exhausted,skipped:0}}}},{process:{env:{CRON_SECRET:secret}},console:{error:(...args)=>logs.push(args)}})
 return{route,calls,logs,failureCalls,send:async auth=>{const r=await route.GET(new Request('https://synthetic.invalid/api/cron/aishodan-notifications',{headers:auth?{authorization:auth}:{}}));return{status:r.status,body:await r.json()}}}
}
;(async()=>{
 for(const auth of [undefined,'wrong','Bearer other'])await check('unauthorized request cannot start recovery '+String(auth),async()=>{const f=fixture();assert.equal((await f.send(auth)).status,401);assert.equal(f.calls.length,0);assert.equal(f.failureCalls.length,0)})
 await check('missing configured secret fails closed',async()=>{const f=fixture({secret:''});assert.equal((await f.send('Bearer ')).status,401);assert.equal(f.calls.length,0);assert.equal(f.failureCalls.length,0)})
 await check('authenticated cron processes one session with aggregate counters',async()=>{const f=fixture();const r=await f.send('Bearer synthetic');assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.deepEqual(f.calls,[1]);assert.deepEqual(f.failureCalls,[1]);assert.equal(r.body.sent,1);assert.equal(f.route.maxDuration,60)})
 await check('exhausted retry is visible to monitoring without exposing session data',async()=>{const f=fixture({exhausted:1});const r=await f.send('Bearer synthetic');assert.equal(r.status,503);assert.equal(r.body.ok,false);assert.equal(r.body.exhausted,1);assert.equal(f.logs.length,1);assert.ok(!JSON.stringify(r.body).includes('sessionId'))})
 await check('recovery failure returns sanitized failure instead of successful completion',async()=>{const f=fixture({failure:true});const r=await f.send('Bearer synthetic');assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes('PRIVATE_PROVIDER_FAILURE'));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_FAILURE'))})
 await check('production config schedules this authenticated endpoint exactly once',async()=>{const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../vercel.json'),'utf8'));const entries=config.crons.filter(c=>c.path==='/api/cron/aishodan-notifications');assert.equal(entries.length,1);assert.equal(entries[0].schedule,'*/5 * * * *')})
 await check('failure notice retry exhaustion returns sanitized monitoring status',async()=>{const f=fixture({failureNoticeExhausted:1});const r=await f.send('Bearer synthetic');assert.equal(r.status,503);assert.equal(r.body.exhausted,1);assert.equal(r.body.failures.exhausted,1);assert.equal(f.logs.length,1)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
