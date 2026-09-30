// Offline regression: real pricing/month-reset code, mocked DB/auth only.
const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const unified=load('src/lib/unified-plan.ts');
const pricing=load('src/lib/pricing.ts',{'./unified-plan':unified});
let sub=null,user={id:'quota-user',plan:'FREE'},session={user:{id:'quota-user'}},fail=false,queries=[];
const prisma={user:{findFirst:async()=>user},userServiceSubscription:{findUnique:async q=>{queries.push(q);if(fail)throw Error('offline');return sub}}};
const {getUsageSummary}=load('src/lib/usage-summary.ts',{'@/lib/prisma':{prisma},'@/lib/persona/usage':{},'@/lib/pricing':pricing,'@/lib/plan-limit':{},'@/lib/unified-plan':unified,'@/lib/aio/types':{},'@/lib/shodan/types':{}});
const {GET}=load('src/app/api/usage/[service]/route.ts',{'next/server':{NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),{...init,headers:{'Content-Type':'application/json',...init?.headers}})}},'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/usage-summary':{getUsageSummary},'@/lib/aio/access':{getAioContext:()=>{throw Error('banner must not resolve AIO')}},'@/lib/aio/usage':{getAioUsage:()=>{throw Error('banner must not query AIO')}}});
const get=()=>GET(new Request('http://localhost/api/usage/banner'),{params:Promise.resolve({service:'banner'})});
(async()=>{
 await check('banner current-month usage comes from authenticated subscription',async()=>{sub={plan:'FREE',monthlyUsage:15,lastUsageReset:new Date()};let res=await get();let data=await res.json();assert.equal(data.summary.meters[0].used,15);assert.equal(data.summary.meters[0].limit,15);assert.equal(queries.at(-1).where.userId_serviceId.userId,'quota-user');assert.match(res.headers.get('Cache-Control'),/no-store/);});
 await check('banner contract plan overrides stale user-level plan',async()=>{for(const plan of ['FREE','LIGHT','PRO','ENTERPRISE']){sub={plan,monthlyUsage:1,lastUsageReset:new Date()};user.plan=plan==='FREE'?'PRO':'FREE';const summary=await getUsageSummary('banner',user.id,user.plan);assert.equal(summary.meters[0].limit,pricing.getBannerMonthlyLimitByUserPlan(plan));}});
 await check('banner expired month reports zero without a DB write',async()=>{sub={plan:'FREE',monthlyUsage:15,lastUsageReset:new Date('2000-01-01T00:00:00Z')};assert.equal((await getUsageSummary('banner',user.id,user.plan)).meters[0].used,0);assert.equal(sub.monthlyUsage,15);});
 await check('banner missing subscription shows zero with existing user plan',async()=>{sub=null;user.plan='PRO';const summary=await getUsageSummary('banner',user.id,user.plan);assert.equal(summary.meters[0].used,0);assert.equal(summary.meters[0].limit,150);});
 await check('banner DB failure is unknown usage rather than a fresh allowance',async()=>{fail=true;assert.equal((await (await get()).json()).summary,null);fail=false;});
 await check('banner unauthenticated request returns no account usage',async()=>{session=null;queries=[];assert.equal((await (await get()).json()).signedIn,false);assert.equal(queries.length,0);});
 await check('retired free-hour offer remains disabled',async()=>assert.equal(pricing.isWithinFreeHour(new Date()),false));
 console.log(JSON.stringify({passed:results.length,networkRequests:0,productionWrites:0,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
