const assert=require('node:assert/strict');const {load,check,results}=require('./verify-data-integrity.cjs');const stripeModule=load('src/lib/stripe.ts',{stripe:class{}});
const Resp={json:(body,opts)=>({body,status:opts?.status??200})};
function fixture(){let valid=true,fail=false,deleted=0,synced=[],cancels=[],txCalls=0;const user={id:'u1',email:'owner@example.test',stripeSubscriptionId:'sub1'};
 const stripe={subscriptions:{cancel:async id=>{if(fail)throw Error('network failure');cancels.push(id)},retrieve:async()=>({id:'sub1',status:'active'})}};
 const prisma={user:{findUnique:async()=>user,update:async()=>{throw Error('Nonatomic update')}},userServiceSubscription:{findUnique:async()=>({id:'svc'}),update:async()=>({})},$transaction:async fn=>{txCalls++;return fn({user:{delete:async()=>{deleted++}},...Object.fromEntries(['userServiceSubscription','generation','session','account'].map(n=>[n,{deleteMany:async()=>({count:1})}]))})}};
 const api=load('src/app/api/admin/users/route.ts',{'next/server':{NextResponse:Resp},'next/headers':{cookies:async()=>({get:()=>({value:'mock'})})},'@/lib/admin-auth':{verifyAdminSession:async()=>({valid}),COOKIE_NAME:'admin'},'@/lib/prisma':{prisma},'@/lib/billing-sync':{syncUnifiedBilling:async input=>{synced.push(input);return{}}},'@/lib/stripe':{...stripeModule,findActiveLikeSubscriptions:async()=>[{id:'sub1'},{id:'sub2'}]},stripe:function(){return stripe}});
 return {api,synced,cancels,set valid(v){valid=v},set fail(v){fail=v},get deleted(){return deleted},get txCalls(){return txCalls}};
}
const req=body=>new Request('https://local.test/api/admin/users?userId=u1',{method:'PATCH',body:JSON.stringify(body)});
(async()=>{
 await check('admin plan update delegates to unified atomic sync',async()=>{let f=fixture();assert.equal((await f.api.PATCH(req({userId:'u1',plan:'PRO'}))).status,200);assert.equal(f.synced.length,1);assert.equal(f.synced[0].preserveManualGrant,false)});
 await check('legacy servicePlan admin request uses unified sync',async()=>{let f=fixture();assert.equal((await f.api.PATCH(req({userId:'u1',serviceId:'banner',servicePlan:'PRO'}))).status,200);assert.equal(f.synced[0].plan,'PRO')});
 await check('admin rejects invalid/conflicting plans and invalid roles without sync',async()=>{for(const patch of [{plan:'invented'},{plan:'PRO',servicePlan:'FREE'},{role:'superuser'}]){let f=fixture();assert.equal((await f.api.PATCH(req({userId:'u1',...patch}))).status,400);assert.equal(f.synced.length,0)}});
 await check('unauthorized admin cannot change plans',async()=>{let f=fixture();f.valid=false;assert.equal((await f.api.PATCH(req({userId:'u1',plan:'PRO'}))).status,401);assert.equal(f.synced.length,0)});
 await check('Stripe cancellation failure preserves user and all DB records',async()=>{let f=fixture();f.fail=true;let r=await f.api.DELETE(req({userId:'u1'}));assert.equal(r.status,500);assert.equal(f.deleted,0);assert.equal(f.txCalls,0)});
 await check('admin deletion stops every active subscription before DB transaction',async()=>{let f=fixture();assert.equal((await f.api.DELETE(req({userId:'u1'}))).status,200);assert.deepEqual(f.cancels,['sub1','sub2']);assert.equal(f.txCalls,1);assert.equal(f.deleted,1)});
 console.log(JSON.stringify({passed:results.length,networkRequests:0,productionWrites:0,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
