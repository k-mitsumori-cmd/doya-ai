const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {load,check,results}=require('./load-typescript.cjs')
function fixture({secret='synthetic',failure=false,exhausted=0}={}){
 const calls=[],logs=[]
 const route=load('src/app/api/cron/aishodan-evaluations/route.ts',{'@/lib/aishodan/recover-evaluations':{recoverEvaluations:async limit=>{calls.push(limit);if(failure)throw Error('PRIVATE_PROVIDER_FAILURE');return{processed:1,completed:1,busy:0,retried:0,exhausted,skipped:0}}}},{process:{env:{CRON_SECRET:secret}},console:{error:(...args)=>logs.push(args)}})
 return{route,calls,logs,send:async auth=>{const r=await route.GET(new Request('https://synthetic.invalid/api/cron/aishodan-evaluations',{headers:auth?{authorization:auth}:{}}));return{status:r.status,body:await r.json()}}}
}
;(async()=>{
 for(const auth of [undefined,'wrong','Bearer other'])await check('unauthorized request cannot start recovery '+String(auth),async()=>{const f=fixture();assert.equal((await f.send(auth)).status,401);assert.equal(f.calls.length,0)})
 await check('missing configured secret fails closed',async()=>{const f=fixture({secret:''});assert.equal((await f.send('Bearer ')).status,401);assert.equal(f.calls.length,0)})
 await check('authenticated cron processes one session with aggregate counters',async()=>{const f=fixture();const r=await f.send('Bearer synthetic');assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.deepEqual(f.calls,[1]);assert.equal(r.body.completed,1);assert.equal(f.route.maxDuration,300)})
 await check('exhausted retry is visible to monitoring without exposing session data',async()=>{const f=fixture({exhausted:1});const r=await f.send('Bearer synthetic');assert.equal(r.status,503);assert.equal(r.body.ok,false);assert.equal(r.body.exhausted,1);assert.equal(f.logs.length,1);assert.ok(!JSON.stringify(r.body).includes('sessionId'))})
 await check('recovery failure returns sanitized failure instead of successful completion',async()=>{const f=fixture({failure:true});const r=await f.send('Bearer synthetic');assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes('PRIVATE_PROVIDER_FAILURE'));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_FAILURE'))})
 await check('production config schedules this authenticated endpoint exactly once',async()=>{const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../vercel.json'),'utf8'));const entries=config.crons.filter(c=>c.path==='/api/cron/aishodan-evaluations');assert.equal(entries.length,1);assert.equal(entries[0].schedule,'*/5 * * * *')})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
