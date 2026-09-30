const assert=require('node:assert/strict');const {load,check,results}=require('./verify-data-integrity.cjs');
const stripeModule=load('src/lib/stripe.ts',{stripe:class{}});const ids=Array.from(stripeModule.ALL_SERVICE_IDS);
const grants=load('src/lib/billing-manual-grants.ts',{'@/lib/prisma':{prisma:{}}});
const json=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 let state={user:{id:'u1',email:'owner@example.test',plan:'FREE',name:'Test'},services:{banner:{plan:'FREE',dailyUsage:7,monthlyUsage:29}},hr:'FREE'},fail=null,attempts=0,grant='';
 const prisma={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');attempts++;if(fail==='serialization'&&attempts<3)throw Object.assign(Error('conflict'),{code:'P2034'});const draft=structuredClone(state);const result=await fn({
 user:{findUniqueOrThrow:async()=>draft.user,update:async({data})=>Object.assign(draft.user,data)},
 systemSetting:{findUnique:async()=>{if(fail==='grants')throw Error('grant unavailable');return{value:grant}}},
 userServiceSubscription:{updateMany:async({data})=>{for(const s of Object.values(draft.services))Object.assign(s,data)},upsert:async({where,create,update})=>{const id=where.userId_serviceId.serviceId;if(fail===id)throw Error('write unavailable');draft.services[id]=draft.services[id]?{...draft.services[id],...update}:{...create,dailyUsage:0,monthlyUsage:0};}},
 hrOrganizationMember:{findMany:async()=>[{organizationId:'org1'}]},hrOrganization:{updateMany:async({data})=>{if(fail==='hr')throw Error('hr unavailable');draft.hr=data.plan}}
 });state=draft;return result}};
 const sync=load('src/lib/billing-sync.ts',{'@/lib/prisma':{prisma,withRetry:fn=>fn()},'@/lib/stripe':stripeModule,'@/lib/billing-manual-grants':grants}).syncUnifiedBilling;
 return {sync,get state(){return state},set fail(v){fail=v},set grant(v){grant=v},get attempts(){return attempts}};
}
async function atomic(){
 await check('malformed manual grants cannot silently become an empty exemption list',async()=>{
  assert.deepEqual(json(grants.parseManualGrantEmails('OWNER@example.test, other@example.test')),['OWNER@example.test',' other@example.test']);
  assert.deepEqual(json(grants.parseManualGrantEmails('["OWNER@example.test"]')),['OWNER@example.test']);
  for(const value of ['["owner@example.test"','[1]','{"email":"owner@example.test"}','"owner@example.test"','not-an-email',','])
   assert.throws(()=>grants.parseManualGrantEmails(value));
  const f=fixture();await f.sync({userId:'u1',plan:'ENTERPRISE',preserveManualGrant:false});
  const before=json(f.state);f.grant='["owner@example.test"';
  await assert.rejects(()=>f.sync({userId:'u1',plan:'PRO'}));
  assert.deepEqual(json(f.state),before);
 });
 await check('unified billing covers every service and retains usage',async()=>{let f=fixture();await f.sync({userId:'u1',plan:'PRO',stripeSubscriptionId:'sub1'});assert.equal(f.state.user.plan,'PRO');assert.equal(Object.keys(f.state.services).length,ids.length);assert(ids.every(id=>f.state.services[id].plan==='PRO'));assert.equal(f.state.services.banner.dailyUsage,7);assert.equal(f.state.services.banner.monthlyUsage,29);assert.equal(f.state.hr,'PRO');f.state.services.writing={plan:'PRO',dailyUsage:4};await f.sync({userId:'u1',plan:'FREE'});assert.equal(f.state.services.writing.plan,'FREE');assert.equal(f.state.services.writing.dailyUsage,4)});
 for(const fail of ['seo','hr','grants'])await check('billing '+fail+' failure rolls back all changes',async()=>{let f=fixture(),before=json(f.state);f.fail=fail;await assert.rejects(()=>f.sync({userId:'u1',plan:'PRO'}));assert.deepEqual(json(f.state),before)});
 await check('serialization conflict retries bounded transaction',async()=>{let f=fixture();f.fail='serialization';await f.sync({userId:'u1',plan:'PRO'});assert.equal(f.attempts,3)});
 await check('manual grant preserved for sync and cancellation; explicit admin may downgrade',async()=>{let f=fixture();await f.sync({userId:'u1',plan:'ENTERPRISE',preserveManualGrant:false});f.grant='owner@example.test';await f.sync({userId:'u1',plan:'PRO'});assert.equal(f.state.user.plan,'ENTERPRISE');await f.sync({userId:'u1',plan:'FREE',stripeSubscriptionId:null});assert.equal(f.state.user.plan,'ENTERPRISE');assert.equal(f.state.user.stripeSubscriptionId,null);await f.sync({userId:'u1',plan:'FREE',preserveManualGrant:false});assert.equal(f.state.user.plan,'FREE');assert(ids.every(id=>f.state.services[id].plan==='FREE'))});
 await check('BUNDLE retained globally and mapped to PRO for services',async()=>{let f=fixture();await f.sync({userId:'u1',plan:'BUNDLE'});assert.equal(f.state.user.plan,'BUNDLE');assert.equal(f.state.services.banner.plan,'PRO');f.grant='["OWNER@example.test"]';await f.sync({userId:'u1',plan:'PRO'});assert.equal(f.state.user.plan,'BUNDLE')});
 await check('LIGHT maps to HR STARTER and invalid tier rejects before transaction',async()=>{let f=fixture();await f.sync({userId:'u1',plan:'LIGHT'});assert.equal(f.state.hr,'STARTER');let n=f.attempts;await assert.rejects(()=>f.sync({userId:'u1',plan:'arbitrary'}));assert.equal(f.attempts,n)});
}
const Resp={json:(body,opts)=>({body,status:opts?.status??200})};
function routeFixture(){
 const f=fixture();let signed=true,writes=0,notices=0,queued=null,legacyEmail='owner@example.test';let checkout={id:'cs1',client_reference_id:'u1',customer_email:'owner@example.test',customer:'cus1',subscription:'sub1',status:'complete'};
 let sub={id:'sub1',customer:'cus1',status:'active',metadata:{userId:'u1',planId:'banner-pro'},current_period_end:1900000000,items:{data:[{price:{id:'price_banner_pro_monthly',unit_amount:9980}}]},trial_end:null};
 const stripe={checkout:{sessions:{retrieve:async()=>checkout}},customers:{retrieve:async()=>({id:'cus1',email:legacyEmail}),list:async()=>({data:[{id:'cus1'}]})},subscriptions:{retrieve:async()=>sub,list:async()=>({data:[sub]})}};
 const mocks={'next/server':{NextResponse:Resp},'next-auth':{getServerSession:async()=>signed?{user:{email:'owner@example.test'}}:null},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{user:{findUnique:async()=>f.state.user,update:async()=>{throw Error('Non-atomic user write')}}}},'@/lib/stripe':{...stripeModule,stripe,findActiveLikeSubscriptions:async()=>stripeModule.isDoyaSubscription(sub)?[{id:sub.id,status:sub.status,customerId:typeof sub.customer==='string'?sub.customer:sub.customer.id,priceId:sub.items.data[0]?.price.id||null,planId:stripeModule.resolvePlanIdFromSubscription(sub).planId}]:[]},'@/lib/billing-sync':{syncUnifiedBilling:async i=>{writes++;return f.sync(i)}},'@/lib/notifications':{sendEventNotification:async()=>{notices++}},'@/lib/stripe-webhook-receipts':{claimStripeWebhookEvent:async()=>({kind:'claimed',token:'test-claim'}),finishStripeWebhookEvent:async()=>{}},'@/lib/stripe-webhook-notifications':{enqueueStripeWebhookNotification:async(_id,_type,_token,payload)=>{queued=payload},deliverStripeWebhookNotification:async()=>{if(queued)notices++;return 'sent'}}};
 return {f,checkout,sub,mocks,get writes(){return writes},get notices(){return notices},set signed(x){signed=x},set legacyEmail(x){legacyEmail=x}};
}
const req=()=>new Request('https://local.test/api/stripe/sync',{method:'POST',body:JSON.stringify({sessionId:'cs1'})});
async function routes(){
 await check('shared Stripe classifier rejects foreign metadata and preserves legacy Doya prices',async()=>{
  const foreign={metadata:{userId:'u1',planId:'premium'},items:{data:[{price:{id:'price_other_app'}}]}};
  assert.equal(stripeModule.isDoyaSubscription(foreign),false);
  assert.equal(stripeModule.isDoyaPlanId('premium'),false);
  assert.equal(stripeModule.isDoyaSubscription({...foreign,metadata:{app:'another-app',planId:'banner-pro'},items:{data:[{price:{id:'price_banner_pro_monthly'}}]}}),false);
  assert.equal(stripeModule.isDoyaSubscription({...foreign,metadata:{planId:'banner-business'}}),true);
  assert.equal(stripeModule.getPlanIdFromStripePriceId('price_banner_business_monthly'),'banner-business');
  assert.equal(stripeModule.resolvePlanIdFromSubscription({...foreign,items:{data:[{price:{id:'price_banner_pro_monthly'}}]}}).planId,'seo-pro');
 });
 await check('checkout own active contract syncs all services',async()=>{let f=routeFixture(),api=load('src/app/api/stripe/sync/route.ts',f.mocks);let r=await api.POST(req());assert.equal(r.status,200);assert.equal(f.f.state.user.plan,'PRO');assert.equal(f.notices,1)});
 for(const status of ['canceled','unpaid','incomplete','incomplete_expired','paused'])await check('checkout '+status+' cannot regrant paid access',async()=>{let f=routeFixture();f.sub.status=status;const r=await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req());assert.equal(r.status,409);assert.equal(f.writes,0)});
 for(const status of ['trialing','past_due'])await check('checkout '+status+' keeps supported entitlement',async()=>{let f=routeFixture();f.sub.status=status;const r=await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req());assert.equal(r.status,200)});
 await check('incomplete checkout blocked before writes',async()=>{let f=routeFixture();f.checkout.status='open';assert.equal((await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req())).status,409);assert.equal(f.writes,0)});
 for(const field of ['client_reference_id','customer_email'])await check('foreign checkout '+field+' denied',async()=>{let f=routeFixture();f.checkout[field]='other';assert.equal((await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req())).status,403);assert.equal(f.writes,0)});
 await check('legacy checkout requires verified customer email',async()=>{let f=routeFixture();f.checkout.client_reference_id=null;f.checkout.customer_email=null;f.legacyEmail='foreign@example.test';const api=load('src/app/api/stripe/sync/route.ts',f.mocks);assert.equal((await api.POST(req())).status,403);assert.equal(f.writes,0);f.legacyEmail='owner@example.test';assert.equal((await api.POST(req())).status,200)});
 await check('foreign subscription customer denied',async()=>{let f=routeFixture();f.sub.customer='other';assert.equal((await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req())).status,403);assert.equal(f.writes,0)});
 await check('foreign subscription cannot grant access through checkout sync',async()=>{let f=routeFixture();f.sub.metadata={userId:'u1',planId:'premium'};f.sub.items.data[0].price.id='price_other_app';assert.equal((await load('src/app/api/stripe/sync/route.ts',f.mocks).POST(req())).status,403);assert.equal(f.writes,0)});
 await check('foreign subscription cannot grant access through latest sync',async()=>{let f=routeFixture();f.sub.metadata={userId:'u1',planId:'premium'};f.sub.items.data[0].price.id='price_other_app';assert.equal((await load('src/app/api/stripe/sync/latest/route.ts',f.mocks).POST(req())).status,404);assert.equal(f.writes,0)});
 for(const route of ['sync','sync/latest']){
 await check(route+' requires authentication',async()=>{let f=routeFixture();f.signed=false;assert.equal((await load('src/app/api/stripe/'+route+'/route.ts',f.mocks).POST(req())).status,401);assert.equal(f.writes,0)});
 await check(route+' failed service write returns error and retains prior plan',async()=>{let f=routeFixture();f.f.fail='seo';assert.equal((await load('src/app/api/stripe/'+route+'/route.ts',f.mocks).POST(req())).status,500);assert.equal(f.f.state.user.plan,'FREE');assert.equal(f.notices,0)});
 await check(route+' manual enterprise entitlement survives',async()=>{let f=routeFixture();await f.f.sync({userId:'u1',plan:'ENTERPRISE',preserveManualGrant:false});f.f.grant='owner@example.test';assert.equal((await load('src/app/api/stripe/'+route+'/route.ts',f.mocks).POST(req())).status,200);assert.equal(f.f.state.user.plan,'ENTERPRISE')});
 }
}
async function webhook(){
 for(const kind of ['processed','inflight'])await check('webhook '+kind+' receipt does not reprocess billing',async()=>{
  let f=routeFixture();f.mocks['@/lib/stripe-webhook-receipts'].claimStripeWebhookEvent=async()=>({kind});
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,kind==='processed'?200:503);assert.equal(f.writes,0);
 });
 for(const fail of [false,true])await check('deleted webhook '+(fail?'lookup failure preserves rights and requests retry':'confirmed cancellation clears every service'),async()=>{
 let f=routeFixture();await f.f.sync({userId:'u1',plan:'PRO'});const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},'@/lib/prisma':{prisma:{user:{findUnique:async()=>f.f.state.user}},withRetry:fn=>fn()},'@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'customer.subscription.deleted',data:{object:f.sub}}),findActiveLikeSubscriptions:async()=>{if(fail)throw Error('temporary stripe error');return[]}}};let r=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));assert.equal(r.status,fail?500:200);assert.equal(f.f.state.user.plan,fail?'PRO':'FREE');assert(ids.every(id=>f.f.state.services[id].plan===(fail?'PRO':'FREE')));
 });
 await check('webhook failed service sync returns 500 for retry',async()=>{let f=routeFixture();f.f.fail='seo';const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},'@/lib/prisma':{prisma:{user:{findUnique:async()=>f.f.state.user}},withRetry:fn=>fn()},'@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'customer.subscription.updated',data:{object:f.sub}})}};assert.equal((await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}))).status,500);assert.equal(f.f.state.user.plan,'FREE')});
 for(const type of ['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted']){
  await check(type+' unresolved Doya user requests Stripe retry',async()=>{
   let f=routeFixture();f.sub.metadata.userId='missing';f.legacyEmail='other@example.test';
   const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
    '@/lib/prisma':{prisma:{user:{findUnique:async()=>null,findFirst:async()=>null}},withRetry:fn=>fn()},
    '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type,data:{object:f.sub}})}};
   const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
   assert.equal(response.status,500);assert.equal(f.writes,0);
  });
 }
 await check('explicit missing userId cannot fall back to another customer or email owner',async()=>{
  let f=routeFixture();f.sub.metadata.userId='missing';
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findUnique:async()=>null,findFirst:async()=>f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt-missing',type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.writes,0);
 });
 await check('legacy subscription without userId can resolve verified customer email',async()=>{
  let f=routeFixture();f.sub.metadata={planId:'banner-pro'};let lookups=0;
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findFirst:async()=>++lookups===1?null:f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt-legacy',type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.writes,1);assert.equal(lookups,2);
 });
 await check('Stripe customer lookup outage requests retry',async()=>{
  let f=routeFixture();f.sub.metadata={planId:'banner-pro'};f.mocks['@/lib/stripe'].stripe.customers.retrieve=async()=>{throw Error('temporary Stripe failure')};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findUnique:async()=>null,findFirst:async()=>null}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.writes,0);
 });
 await check('known Doya price still requests retry when plan metadata is corrupt',async()=>{
  let f=routeFixture();f.sub.metadata={planId:'invalid-plan'};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findUnique:async()=>null,findFirst:async()=>null}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.writes,0);
 });
 await check('unrelated subscription is acknowledged without Doya changes',async()=>{
  let f=routeFixture();f.sub.metadata={};f.sub.items.data[0].price.id='price_other_app';
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.writes,0);
 });
 await check('foreign subscription with userId and arbitrary paid plan is ignored',async()=>{
  let f=routeFixture();f.sub.metadata={userId:'u1',planId:'premium'};f.sub.items.data[0].price.id='price_other_app';
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'customer.subscription.updated',data:{object:f.sub}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.writes,0);assert.equal(f.notices,0);
 });
 await check('foreign checkout with client reference cannot modify Doya user',async()=>{
  let f=routeFixture();f.checkout.metadata={userId:'u1',planId:'premium'};f.sub.metadata={userId:'u1',planId:'premium'};f.sub.items.data[0].price.id='price_other_app';
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'checkout.session.completed',data:{object:f.checkout}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.writes,0);assert.equal(f.notices,0);
 });
 await check('Doya checkout syncs after customer and user identity validation',async()=>{
  let f=routeFixture();f.checkout.metadata={app:'doya-ai',userId:'u1',planId:'banner-pro'};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findUnique:async()=>f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'checkout.session.completed',data:{object:f.checkout}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.writes,1);assert.equal(f.notices,1);
 });
 await check('Doya checkout identity mismatch requests retry without writes',async()=>{
  let f=routeFixture();f.checkout.metadata={app:'doya-ai',userId:'other',planId:'banner-pro'};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'checkout.session.completed',data:{object:f.checkout}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.writes,0);
 });
 await check('Doya checkout without user identity requests retry',async()=>{
  let f=routeFixture();f.checkout.client_reference_id=null;f.checkout.metadata={planId:'banner-pro'};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({type:'checkout.session.completed',data:{object:f.checkout}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.writes,0);
 });
 for(const type of ['invoice.payment_succeeded','invoice.payment_failed']){
  for(const own of [true,false])await check(type+' '+(own?'Doya invoice notifies':'other app invoice does not notify'),async()=>{
   let f=routeFixture();let invoice={id:'in1',customer:'cus1',customer_email:'owner@example.test',amount_paid:9980,
    subscription:null,billing_reason:'subscription_cycle',lines:{data:[{price:{id:own?'price_banner_pro_monthly':'price_other_app'},period:{end:1900000000}}]}};
   const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
    '@/lib/prisma':{prisma:{user:{findFirst:async()=>f.f.state.user}},withRetry:fn=>fn()},
    '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type,data:{object:invoice}})}};
   const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
   assert.equal(response.status,200);assert.equal(f.notices,own?1:0);
  });
 }
 await check('foreign invoice app marker overrides a shared Doya price',async()=>{
  let f=routeFixture();f.sub.metadata={app:'another-app',userId:'u1',planId:'banner-pro'};
  const invoice={id:'in-foreign',customer:'cus1',amount_paid:9980,subscription:'sub1',lines:{data:[{price:{id:'price_banner_pro_monthly'}}]}};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt-foreign',type:'invoice.payment_succeeded',data:{object:invoice}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.notices,0);assert.equal(f.writes,0);
 });
 await check('Doya invoice without line price resolves subscription metadata',async()=>{
  let f=routeFixture();let invoice={id:'in1',customer:'cus1',customer_email:'owner@example.test',amount_paid:9980,
   subscription:'sub1',lines:{data:[{price:null,period:{end:1900000000}}]}};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findFirst:async()=>f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'invoice.payment_succeeded',data:{object:invoice}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.equal(f.notices,1);
 });
 await check('invoice classification outage requests retry without false notification',async()=>{
  let f=routeFixture();f.mocks['@/lib/stripe'].stripe.subscriptions.retrieve=async()=>{throw Error('temporary Stripe failure')};
  let invoice={id:'in1',customer:'cus1',amount_paid:9980,subscription:'sub1',lines:{data:[{price:null}]}};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'invoice.payment_succeeded',data:{object:invoice}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.equal(f.notices,0);
 });
 await check('notification queue failure requests Stripe retry before receipt completion',async()=>{
  let f=routeFixture(),finishes=[];
  f.mocks['@/lib/stripe-webhook-notifications'].enqueueStripeWebhookNotification=async()=>{throw Error('queue unavailable')};
  f.mocks['@/lib/stripe-webhook-receipts'].finishStripeWebhookEvent=async(_id,_token,success)=>{finishes.push(success)};
  let invoice={id:'in1',customer:'cus1',amount_paid:9980,subscription:null,lines:{data:[{price:{id:'price_banner_pro_monthly'}}]}};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findFirst:async()=>f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'invoice.payment_succeeded',data:{object:invoice}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,500);assert.deepEqual(finishes,[false]);assert.equal(f.notices,0);
 });
 await check('queued notification delivery outage keeps Stripe receipt processed',async()=>{
  let f=routeFixture(),finishes=[];
  f.mocks['@/lib/stripe-webhook-notifications'].deliverStripeWebhookNotification=async()=>{throw Error('delivery unavailable')};
  f.mocks['@/lib/stripe-webhook-receipts'].finishStripeWebhookEvent=async(_id,_token,success)=>{finishes.push(success)};
  let invoice={id:'in1',customer:'cus1',amount_paid:9980,subscription:null,lines:{data:[{price:{id:'price_banner_pro_monthly'}}]}};
  const mocks={...f.mocks,'next/headers':{headers:async()=>new Headers({'stripe-signature':'mock'})},
   '@/lib/prisma':{prisma:{user:{findFirst:async()=>f.f.state.user}},withRetry:fn=>fn()},
   '@/lib/stripe':{...f.mocks['@/lib/stripe'],constructWebhookEvent:()=>({id:'evt1',type:'invoice.payment_succeeded',data:{object:invoice}})}};
  const response=await load('src/app/api/stripe/webhook/route.ts',mocks,{process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}}).POST(new Request('https://local.test',{method:'POST',body:'x'}));
  assert.equal(response.status,200);assert.deepEqual(finishes,[true]);assert.equal(f.notices,0);
 });
}
(async()=>{await atomic();await routes();await webhook();console.log(JSON.stringify({passed:results.length,allServices:ids.length,networkRequests:0,productionWrites:0,results},null,2))})().catch(e=>{console.error(e);process.exitCode=1});
