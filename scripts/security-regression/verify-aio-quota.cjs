const assert=require('node:assert/strict');
const {load,check}=require('./load-typescript.cjs');
const {scanQuota}=load('src/lib/aio/quota.ts',{'./types':load('src/lib/aio/types.ts'),'@/lib/unified-plan':load('src/lib/unified-plan.ts')});
(async()=>{
 await check('paid month resets exactly at JST midnight',()=>{
  assert.equal(scanQuota('PRO',new Date('2026-09-30T14:59:59Z')).since.toISOString(),'2026-08-31T15:00:00.000Z');
  assert.equal(scanQuota('PRO',new Date('2026-09-30T15:00:00Z')).since.toISOString(),'2026-09-30T15:00:00.000Z');
 });
 await check('free window is seven rolling days',()=>{
  const q=scanQuota('FREE',new Date('2026-09-20T01:23:45Z'));assert.equal(q.since.toISOString(),'2026-09-13T01:23:45.000Z');assert.equal(q.limit,1);assert.equal(q.paid,false);
 });
 await check('plan limits use actual shared definitions',()=>{
  assert.equal(scanQuota('PRO').limit,30);assert.equal(scanQuota('ENTERPRISE').limit,200);assert.equal(scanQuota('GUEST').limit,1);assert.equal(scanQuota(null).limit,1);
 });
 await check('paid cap messaging does not sell the same PRO plan',()=>{assert(!scanQuota('PRO').error.includes('アップグレード'));assert(scanQuota('FREE').error.includes('組織オーナー'));});
 for(const plan of ['FREE','PRO'])for(const role of ['owner','member'])await check(`${plan} ${role} scan cap returns the correct action without calling the provider`,async()=>{
  let providerCalls=0;
  const prisma={aioBrandProfile:{findUnique:async()=>({brandName:'Synthetic'})},aioPrompt:{findMany:async()=>[{id:'p',text:'Question',isActive:true}]},$transaction:async fn=>fn({$queryRaw:async()=>[{id:'org'}],aioScan:{findFirst:async()=>null,updateMany:async()=>({count:0}),count:async()=>scanQuota(plan).limit}})};
  const runner=load('src/lib/aio/run.ts',{'@/lib/prisma':{prisma},'@/lib/aio/types':{availableEngines:()=>['gemini'],SCAN_STALE_MS:360000,AIO_MAX_PROMPTS_PER_SCAN:20},'@/lib/aio/scan':{executeScan:async()=>{providerCalls++;throw Error('should not run')}},'@/lib/aio/billing':{getAioBilling:async()=>({plan})},'@/lib/aio/quota':{scanQuota}});
  const result=await runner.runAndPersistScan('org');assert.equal(result.code,'LIMIT');assert.equal(result.upgradeAvailable,plan==='FREE');assert.equal(providerCalls,0);
  const route=load('src/app/api/aio/scans/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'@/lib/prisma':{prisma:{aioBrandProfile:{findUnique:async()=>({brandName:'Synthetic'})},aioPrompt:{findMany:async()=>[{id:'p'}]}}},'@/lib/aio/access':{getAioContext:async()=>({organizationId:'org',userId:'user',role}),orgSlugFrom:()=>undefined},'@/lib/aio/types':{availableEngines:()=>['gemini']},'@/lib/aio/run':{runAndPersistScan:async()=>result},'@/lib/aio/scan-cursor':{},'@/lib/service-usage':{recordServiceUsage:async()=>{throw Error('quota must not log success')}}});
  const response=await route.POST({json:async()=>({})});assert.equal(response.status,402);assert.equal(response.body.canManageBilling,role==='owner');assert.equal(response.body.upgradeUrl,plan==='FREE'&&role==='owner'?'/aio/pricing':undefined);
 });
 for(const role of ['owner','manager'])await check(`${role} prompt cap directs the contract manager`,async()=>{
  const tx={$queryRaw:async()=>[{id:'org'}],aioPrompt:{count:async()=>3},aioMember:{},user:{}};
  const route=load('src/app/api/aio/prompts/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'@/lib/prisma':{prisma:{$transaction:async fn=>fn(tx)}},'@/lib/aio/access':{getAioContext:async()=>({organizationId:'org',role}),hasMinRole:()=>true,orgSlugFrom:()=>undefined},'@/lib/aio/billing':{getAioBilling:async()=>({plan:'FREE'})},'@/lib/unified-plan':load('src/lib/unified-plan.ts')});
  const response=await route.POST({json:async()=>({text:'Question'})});assert.equal(response.status,402);assert.equal(response.body.canManageBilling,role==='owner');assert.equal(response.body.upgradeUrl,role==='owner'?'/aio/pricing':undefined);
 });
})().catch(e=>{console.error(e);process.exitCode=1});
