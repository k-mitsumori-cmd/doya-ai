const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
const sub=(id,status='active')=>({id,status,metadata:{planId:'banner-pro'},items:{data:[{price:{id:'price'}}]}});
function fixture({customers=1,subscriptions=1,fail='',repeat=false}={}){
 const calls=[];
 const list=async(kind,q)=>{calls.push({kind,...q});if(fail===kind&&q.starting_after)throw Error('synthetic unavailable');const count=kind==='customers'?customers:subscriptions;const prefix=kind==='customers'?'c':'s'+q.customer+'-';const start=q.starting_after?Number(q.starting_after.slice(prefix.length))+1:0;const data=Array.from({length:Math.max(0,Math.min(100,count-start))},(_,i)=>kind==='customers'?{id:prefix+(start+i)}:sub(prefix+(start+i),start+i===count-1?'trialing':'canceled'));if(repeat)return{data:kind==='customers'?[{id:'same'}]:[sub('same')],has_more:true};return{data,has_more:start+data.length<count}};
 const stripe={customers:{list:q=>list('customers',q)},subscriptions:{list:q=>list('subscriptions',q)}};
 const module=load('src/lib/stripe.ts',{stripe:function(){return stripe}});return{module,calls};
}
(async()=>{
for(const n of [0,1,100,101,205])await check('all '+n+' customers searched, no duplicate stored customer',async()=>{const f=fixture({customers:n});const rows=await f.module.findActiveLikeSubscriptions({email:'x@example.invalid',stripeCustomerId:n?'c0':null});assert.equal(rows.length,n);assert.equal(f.calls.filter(c=>c.kind==='subscriptions').length,n)});
for(const n of [0,1,100,101,205])await check('active contract after '+n+' subscription records',async()=>{const f=fixture({subscriptions:n});const rows=await f.module.findActiveLikeSubscriptions({stripeCustomerId:'c0'});assert.equal(rows.length,n?1:0);if(n)assert.equal(rows[0].id,'sc0-'+(n-1))});
for(const kind of ['customers','subscriptions'])await check(kind+' second page failure is not partial success',async()=>{const f=fixture({customers:101,subscriptions:101,fail:kind});await assert.rejects(f.module.findActiveLikeSubscriptions({email:'x@example.invalid'}))});
await check('repeating cursor rejected instead of infinite loop',async()=>{const f=fixture({repeat:true});await assert.rejects(f.module.findActiveLikeSubscriptions({email:'x@example.invalid'}));assert.equal(f.calls.length,2)});
for(const outcome of ['failure','existing','none'])await check('checkout gate '+outcome,async()=>{
 const f=fixture();let created=0;const api=load('src/app/api/stripe/checkout/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{email:'x@example.invalid'}})},'@/lib/auth':{},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'user'})}}},'@/lib/unified-plan':{UNIFIED_TRIAL_DAYS:30},'@/lib/trial':{isTrialEligible:async()=>true},'@/lib/stripe':{...f.module,findActiveLikeSubscriptions:async()=>{if(outcome==='failure')throw Error('offline');return outcome==='none'?[]:[{id:'s',status:'active'}]},createCheckoutSession:async()=>{created++;return{id:'session',url:'https://offline.invalid/checkout'}}}});
 const res=await api.POST(new Request('https://offline.invalid/api/stripe/checkout',{method:'POST',body:JSON.stringify({planId:'banner-pro'})}));assert.equal(res.status,outcome==='failure'?503:outcome==='none'?200:409);assert.equal(created,outcome==='none'?1:0);
});
console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
