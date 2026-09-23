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
})().catch(e=>{console.error(e);process.exitCode=1});
