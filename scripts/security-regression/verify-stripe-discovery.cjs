const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
const sub=(id,status='active')=>({id,status,metadata:{userId:'u1',planId:'banner-pro'},items:{data:[{price:{id:'price'}}]}});
function fixture({customers=1,subscriptions=1,fail='',repeat=false,emptyStored=false}={}){
 const calls=[];
 const list=async(kind,q)=>{calls.push({kind,...q});if(fail===kind&&q.starting_after)throw Error('synthetic unavailable');const count=kind==='customers'?customers:emptyStored&&q.customer==='stale'?0:subscriptions;const prefix=kind==='customers'?'c':'s'+q.customer+'-';const start=q.starting_after?Number(q.starting_after.slice(prefix.length))+1:0;const data=Array.from({length:Math.max(0,Math.min(100,count-start))},(_,i)=>{if(kind==='customers')return{id:prefix+(start+i),email:q.email};const item=sub(prefix+(start+i),start+i===count-1?'trialing':'canceled');if(q.customer==='foreign')item.metadata.userId='other';return item});if(repeat)return{data:kind==='customers'?[{id:'same',email:q.email}]:[sub('same')],has_more:true};return{data,has_more:start+data.length<count}};
 const stripe={customers:{list:q=>list('customers',q),retrieve:async id=>({id,email:id==='foreign'?'other@example.invalid':'x@example.invalid'})},subscriptions:{list:q=>list('subscriptions',q)},invoices:{list:async()=>({data:[],has_more:false})}};
 const module=load('src/lib/stripe.ts',{stripe:function(){return stripe}});return{module,calls};
}
(async()=>{
for(const n of [0,1,100,101,205])await check('all '+n+' customers searched, no duplicate stored customer',async()=>{const f=fixture({customers:n});const rows=await f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid',stripeCustomerId:n?'c0':null});assert.equal(rows.length,n);assert.equal(f.calls.filter(c=>c.kind==='subscriptions').length,n)});
for(const n of [0,1,100,101,205])await check('active contract after '+n+' subscription records',async()=>{const f=fixture({subscriptions:n});const rows=await f.module.findActiveLikeSubscriptions({userId:'u1',stripeCustomerId:'c0'});assert.equal(rows.length,n?1:0);if(n)assert.equal(rows[0].id,'sc0-'+(n-1))});
await check('shared-account discovery ignores foreign active subscriptions',async()=>{
 const f=fixture({customers:0});f.module.stripe.subscriptions.list=async()=>({data:[
  {id:'foreign',status:'active',metadata:{userId:'u1',planId:'premium'},items:{data:[{price:{id:'price_other_app'}}]}},
  {id:'doya',status:'active',metadata:{userId:'u1',planId:'banner-pro'},items:{data:[{price:{id:'price_banner_pro_monthly'}}]}},
 ],has_more:false});
 const rows=await f.module.findActiveLikeSubscriptions({userId:'u1',stripeCustomerId:'c0'});
 assert.equal(rows.map(s=>s.id).join(','),'doya');
});
await check('stored foreign customer cannot contribute another user contract',async()=>{
 const f=fixture({customers:0});f.module.stripe.subscriptions.list=async()=>({data:[{...sub('foreign','active'),metadata:{userId:'other',planId:'banner-pro'}}],has_more:false});
 assert.equal((await f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid',stripeCustomerId:'foreign'})).length,0);
});
await check('legacy contract requires verified Stripe customer email',async()=>{
 const f=fixture({customers:0});f.module.stripe.subscriptions.list=async()=>({data:[{...sub('legacy','active'),metadata:{planId:'banner-pro'}}],has_more:false});
 assert.equal((await f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid',stripeCustomerId:'foreign'})).length,0);
 assert.equal((await f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'})).length,1);
});
await check('reloaded legacy contract rejects foreign customer email',async()=>{
 const f=fixture({customers:0});const legacy={...sub('legacy'),metadata:{planId:'banner-pro'},customer:'foreign'};
 assert.equal(await f.module.isDoyaSubscriptionOwnedByUser(legacy,{id:'u1',email:'x@example.invalid'}),false);
 assert.equal(await f.module.isDoyaSubscriptionOwnedByUser({...legacy,customer:'stored'},{id:'u1',email:'x@example.invalid'}),true);
});
for(const kind of ['customers','subscriptions'])await check(kind+' second page failure is not partial success',async()=>{const f=fixture({customers:101,subscriptions:101,fail:kind});await assert.rejects(f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid'}))});
for(const kind of ['customers','subscriptions'])await check('portal customer lookup propagates '+kind+' pagination failure',async()=>{const f=fixture({customers:101,subscriptions:101,fail:kind});await assert.rejects(f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'old-customer'}))});
await check('portal selects customer with a live contract',async()=>{const f=fixture({customers:2,subscriptions:1,emptyStored:true});assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stale'}),'c0')});
await check('portal retains stored customer only when discovery completed without a live contract',async()=>{const f=fixture({customers:0});assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),'stored')});
await check('portal rejects foreign stored customer without a live contract',async()=>{const f=fixture({customers:0});assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'foreign'}),null)});
await check('portal rejects stored customer without any proven Doya contract',async()=>{const f=fixture({customers:0,subscriptions:0});assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null)});
await check('portal rejects customer with another user subscription even when own contract is active',async()=>{
 const f=fixture({customers:0});f.module.stripe.subscriptions.list=async()=>({data:[sub('mine'),{...sub('other'),metadata:{userId:'other',planId:'banner-pro'}}],has_more:false});
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null);
});
await check('portal rejects customer with a foreign app subscription',async()=>{
 const f=fixture({customers:0});f.module.stripe.subscriptions.list=async()=>({data:[sub('mine'),{...sub('other-app'),metadata:{app:'other-app',userId:'u1'}}],has_more:false});
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null);
});
await check('portal rejects customer with a foreign or unlinked invoice',async()=>{
 const f=fixture({customers:0});f.module.stripe.invoices.list=async()=>({data:[{id:'invoice-other',subscription:'other-contract'}],has_more:false});
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null);
 f.module.stripe.invoices.list=async()=>({data:[{id:'one-off',subscription:null}],has_more:false});
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null);
});
await check('portal checks later invoice pages and propagates lookup failure',async()=>{
 const f=fixture({customers:0});let calls=0;
 f.module.stripe.invoices.list=async q=>{
  calls++;
  if(!q.starting_after)return{data:Array.from({length:100},(_,i)=>({id:'invoice-'+i,subscription:'sstored-0'})),has_more:true};
  return{data:[{id:'foreign-invoice',subscription:'another-contract'}],has_more:false};
 };
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}),null);assert.equal(calls,2);
 f.module.stripe.invoices.list=async q=>{if(q.starting_after)throw Error('invoice lookup unavailable');return{data:[{id:'invoice-0',subscription:'sstored-0'}],has_more:true}};
 await assert.rejects(f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'stored'}));
});
await check('portal selects a clean customer when the stored customer has a foreign contract',async()=>{
 const f=fixture({customers:2});f.module.stripe.subscriptions.list=async q=>({data:q.customer==='c0'?[sub('mine'),{...sub('other'),metadata:{userId:'other',planId:'banner-pro'}}]:[sub('mine-'+q.customer)],has_more:false});
 assert.equal(await f.module.resolveBillingCustomerId({userId:'u1',email:'x@example.invalid',stripeCustomerId:'c0'}),'c1');
});
for(const routePath of ['portal','portal/redirect'])for(const outcome of ['missing','error'])await check(routePath+' '+outcome+' shows retry page for the original service',async()=>{
 const f=fixture(outcome==='missing'?{customers:0}:{customers:101,fail:'customers'});let opened=0;
 const api=load(`src/app/api/stripe/${routePath}/route.ts`,{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{email:'x@example.invalid'}})},'@/lib/auth':{},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'user',stripeCustomerId:null})}}},'@/lib/stripe':{...f.module,createCustomerPortalSession:async()=>{opened++;return{url:'https://offline.invalid/portal'}}}});
 const url='https://doya.example/api/stripe/'+routePath+'?returnTo=%2Fpersona';const response=await api.GET({url,nextUrl:new URL(url)});
 assert.equal(response.status,302);const location=new URL(response.headers.get('location'));assert.equal(location.pathname,'/billing/portal-unavailable');assert.equal(location.searchParams.get('reason'),outcome);assert.equal(location.searchParams.get('returnTo'),'/persona');assert.equal(opened,0);
});
for(const routePath of ['portal','portal/redirect'])await check(routePath+' login returns to the requested billing flow',async()=>{
 const api=load(`src/app/api/stripe/${routePath}/route.ts`,{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>null},'@/lib/auth':{},'@/lib/prisma':{prisma:{user:{findUnique:async()=>{throw Error('unexpected DB read')}}}},'@/lib/stripe':{}});
 const url='https://doya.example/api/stripe/'+routePath+'?returnTo=%2Fpersona';const response=await api.GET({url,nextUrl:new URL(url)});
 assert.equal(response.status,302);const location=new URL(response.headers.get('location'));assert.equal(location.pathname,'/auth/signin');assert.equal(location.searchParams.get('callbackUrl'),`/api/stripe/${routePath}?returnTo=%2Fpersona`);
});
await check('repeating cursor rejected instead of infinite loop',async()=>{const f=fixture({repeat:true});await assert.rejects(f.module.findActiveLikeSubscriptions({userId:'u1',email:'x@example.invalid'}));assert.equal(f.calls.length,2)});
for(const outcome of ['failure','existing','none'])await check('checkout gate '+outcome,async()=>{
 const f=fixture();let created=0;const api=load('src/app/api/stripe/checkout/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{email:'x@example.invalid'}})},'@/lib/auth':{},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'user'})}}},'@/lib/unified-plan':{UNIFIED_TRIAL_DAYS:30},'@/lib/trial':{isTrialEligible:async()=>true},'@/lib/stripe':{...f.module,findActiveLikeSubscriptions:async()=>{if(outcome==='failure')throw Error('offline');return outcome==='none'?[]:[{id:'s',status:'active'}]},createCheckoutSession:async()=>{created++;return{id:'session',url:'https://offline.invalid/checkout'}}}});
 const res=await api.POST(new Request('https://offline.invalid/api/stripe/checkout',{method:'POST',body:JSON.stringify({planId:'banner-pro'})}));assert.equal(res.status,outcome==='failure'?503:outcome==='none'?200:409);assert.equal(created,outcome==='none'?1:0);
});
console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
