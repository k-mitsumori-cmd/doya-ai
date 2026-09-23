const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs')
const p='11111111-1111-1111-1111-111111111111',j='22222222-2222-2222-2222-222222222222',t='33333333-3333-3333-3333-333333333333'
let mode='',removed=[],calls=[]
const bucket={list:async(prefix,options)=>{calls.push({prefix,options});if(mode==='list-error')return {error:{}};if(prefix===p)return {data:mode==='empty'?[]:[{name:mode==='bad-folder'?'../foreign':j,id:null}]};return {data:[{name:mode==='bad-file'?'../../foreign.png':t+'.png',id:'file'}]}},remove:async(paths)=>{removed.push(...paths);return mode==='remove-error'?{error:{}}:{}}}
const storage=load('src/lib/persona/image-storage.ts',{'@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:mode==='public'}}),from:()=>bucket}})},sharp:()=>{}},{process:{env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'mock'}}})
;(async()=>{
for(const bad of ['../x','',p+'/x'])await assert.rejects(()=>storage.purgeDeletedPersonaImageBatch(bad));assert.equal(calls.length,0)
for(mode of ['public','list-error','bad-folder','bad-file']){removed=[];await assert.rejects(()=>storage.purgeDeletedPersonaImageBatch(p));assert.equal(removed.length,0)}
mode='empty';assert.equal(await storage.purgeDeletedPersonaImageBatch(p),true)
mode='';calls=[];assert.equal(await storage.purgeDeletedPersonaImageBatch(p),false);assert.deepEqual(removed,[`${p}/${j}/${t}.png`]);assert.equal(calls[1].options.offset,0);assert.equal(calls[1].options.limit,100)
mode='remove-error';await assert.rejects(()=>storage.purgeDeletedPersonaImageBatch(p));console.log('PASS namespace validation, private bucket, empty confirmation, bounded batch and retryable storage errors')
const foreign='44444444-4444-4444-4444-444444444444',otherJob='55555555-5555-5555-5555-555555555555',objects=new Set([`${foreign}/${j}/${t}.png`,`${p}/${otherJob}/${t}.png`]);for(let i=0;i<205;i++)objects.add(`${p}/${j}/00000000-0000-0000-0000-${String(i).padStart(12,'0')}.png`)
let batchSizes=[]
const tree={list:async(prefix,{limit,offset})=>{assert.equal(offset,0);const names=[...new Set([...objects].filter(x=>x.startsWith(prefix+'/')).map(x=>x.slice(prefix.length+1).split('/')[0]))].sort().slice(0,limit);return {data:names.map(name=>({name,id:name.endsWith('.png')?'object':null}))}},remove:async paths=>{batchSizes.push(paths.length);paths.forEach(x=>objects.delete(x));return {}}}
const treeStorage=load('src/lib/persona/image-storage.ts',{'@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>tree}})},sharp:()=>{}},{process:{env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'mock'}}})
let iterations=0;while(!await treeStorage.purgeDeletedPersonaImageBatch(p)){assert.ok(++iterations<10)}assert.equal(iterations,4);assert.deepEqual(batchSizes,[100,100,5,1]);assert.deepEqual([...objects],[`${foreign}/${j}/${t}.png`]);console.log('PASS 206 files including unrecorded attempts drained without offset skips or foreign project deletion')
let invoked=0;const resultLogs=[];const globals={process:{env:{CRON_SECRET:'synthetic'}},console:{warn:(label,result)=>resultLogs.push({label,result})}};const route=load('src/app/api/cron/persona-purge/route.ts',{'@/lib/prisma':{prisma:{}},'@/lib/persona/image-purge':{purgeDeletedPersonaImages:async()=>{invoked++;return {processed:1,completed:0,failed:mode==='fail'?1:0}}}},globals)
for(const auth of ['', 'Bearer undefined','Bearer wrong'])assert.equal((await route.GET(new Request('https://test',{headers:{authorization:auth}}))).status,401)
assert.equal(invoked,0);mode='';assert.equal((await route.GET(new Request('https://test',{headers:{authorization:'Bearer synthetic'}}))).status,200);mode='fail';assert.equal((await route.GET(new Request('https://test',{headers:{authorization:'Bearer synthetic'}}))).status,503)
assert.deepEqual(resultLogs.map(x=>[x.label,x.result.processed,x.result.completed,x.result.failed]),[['[persona-purge] result',1,0,0],['[persona-purge] result',1,0,1]])
globals.process.env.CRON_SECRET='';assert.equal((await route.GET(new Request('https://test',{headers:{authorization:'Bearer '}}))).status,401);console.log('PASS cron rejects missing/wrong secret and surfaces cleanup failure')
})().catch(e=>{console.error(e);process.exitCode=1})
