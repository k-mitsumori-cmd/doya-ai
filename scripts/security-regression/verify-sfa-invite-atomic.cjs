const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const epoch=Date.parse('2026-10-06T04:00:00Z'),ttl=48*60*60*1000;
function fixture({existing=false,full=false,change={},delayAt='',lost=false,failDelete=false,conflict=false}={}){
 let now=epoch-1,transactions=0,writes=0,quotaReads=0,rollbacks=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 let row={id:'invite',organizationId:'org',organization:{name:'Synthetic',slug:'team'},inviteToken:'token',inviteEmail:'qa@example.invalid',role:'member',status:'PENDING',createdAt:new Date(epoch-ttl)};
 const delay=stage=>{if(stage===delayAt)now=epoch};
 const membership={
  findUnique:async()=>structuredClone(row),
  findFirst:async({where})=>{if(where.role==='owner')return{userId:'owner'};delay('existing');return existing?{id:'active'}:null},
  count:async()=>{quotaReads++;delay('quota');return full?3:1},
  updateMany:async({where,data})=>{for(const k of ['id','organizationId','role','inviteEmail','inviteToken','status'])if(where[k]!==row[k])return{count:0};if(lost)return{count:0};writes++;Object.assign(row,data);delay('claim');return{count:1}},
  deleteMany:async({where})=>{assert.equal(where.role,'member');assert.equal(where.inviteEmail,'qa@example.invalid');assert.equal(where.organizationId,'org');if(failDelete)throw Error('PRIVATE_DELETE');if(lost)return{count:0};writes++;row=null;delay('delete');return{count:1}},
 };
 const tx={sfaMember:membership,user:{findUnique:async()=>({plan:'FREE'})}};
 const prisma={...tx,$transaction:async(fn,options)=>{transactions++;assert.equal(options.isolationLevel,'Serializable');if(conflict&&transactions===1)throw Object.assign(Error('retry'),{code:'P2034'});Object.assign(row,change);const before=structuredClone(row);try{return await fn(tx)}catch(e){row=before;rollbacks++;throw e}}};
 const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/plan-utils':load('src/lib/plan-utils.ts')},{Date:Clock});
 const route=load('src/app/api/sfa/invite/[token]/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'user',email:'qa@example.invalid'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/sfa/limits':limits},{Date:Clock});
 return{post:()=>route.POST({}, {params:Promise.resolve({token:'token'})}),state:()=>structuredClone(row),stats:()=>({transactions,writes,quotaReads,rollbacks})};
}
(async()=>{
 await check('SFA already-member cleanup is transactional and bypasses a full quota',async()=>{const f=fixture({existing:true,full:true}),r=await f.post();assert.equal(r.status,200);assert.equal((await r.json()).alreadyMember,true);assert.equal(f.stats().quotaReads,0);assert.equal(f.state(),null)});
 await check('SFA expiry during cleanup restores the pending invitation',async()=>{const f=fixture({existing:true,delayAt:'delete'}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().rollbacks,1)});
 await check('SFA cleanup failure or lost claim never reports success or exposes raw details',async()=>{for(const options of [{existing:true,failDelete:true},{existing:true,lost:true},{lost:true}]){const f=fixture(options),before=f.state(),r=await f.post();assert.equal(r.status,409);assert.deepEqual(f.state(),before);assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE'));assert.equal(f.stats().rollbacks,1)}});
 await check('SFA fresh transactional invitation rejects changed recipient, organization, status, token or owner role',async()=>{for(const [change,status] of [[{inviteEmail:'other@example.invalid'},403],[{organizationId:'foreign'},409],[{status:'ACTIVE'},409],[{inviteToken:'different'},409],[{role:'owner'},409],[{role:'unknown'},409]]){const f=fixture({change});assert.equal((await f.post()).status,status);assert.equal(f.stats().writes,0)}});
 await check('SFA pending invitation expires during lookup/quota/claim without retained changes',async()=>{for(const delayAt of ['existing','quota','claim']){const f=fixture({delayAt}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before)}});
 await check('SFA normal participant quota rejects before writes and successful admission consumes exactly one token',async()=>{const full=fixture({full:true}),before=full.state();assert.equal((await full.post()).status,402);assert.deepEqual(full.state(),before);assert.equal(full.stats().writes,0);const normal=fixture(),r=await normal.post();assert.equal(r.status,200);assert.equal(normal.state().status,'ACTIVE');assert.equal(normal.state().inviteToken,null);assert.equal(normal.stats().writes,1)});
 await check('SFA serialization conflict retries the entire fresh lookup and admission',async()=>{const f=fixture({conflict:true});assert.equal((await f.post()).status,200);assert.equal(f.stats().transactions,2);assert.equal(f.stats().writes,1)});
 await check('SFA pending-seat quota includes only invites strictly newer than expiry cutoff',async()=>{
  for(const offset of [-1,0,1]){
   const tx={sfaMember:{findFirst:async()=>({userId:'owner'}),count:async({where})=>{assert.equal(where.OR[1].createdAt.gte,undefined);return 2+(epoch-ttl+offset>where.OR[1].createdAt.gt.getTime()?1:0)}},user:{findUnique:async()=>({plan:'FREE'})}};
   class Clock extends Date{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}}
   const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{}},'@/lib/plan-utils':load('src/lib/plan-utils.ts')},{Date:Clock});
   const limit=await limits.checkSfaQuota(tx,'org',{members:1},{countPendingInvites:true});assert.equal(Boolean(limit),offset>0);
  }
 });
 await check('SFA exact-expiry reissue frees the old pending seat, replaces the invite and preserves active members',async()=>{
  for(const offset of [-1,0,1]){
   let pending={id:'old',inviteEmail:'qa@example.invalid',status:'PENDING',createdAt:new Date(epoch-ttl+offset)},deletes=0,creates=0,sends=0;
   class Clock extends Date{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}}
   const tx={sfaMember:{
    findFirst:async({where})=>where.role==='owner'?{userId:'owner'}:pending&&pending.createdAt>where.OR[1].createdAt.gt?pending:null,
    count:async({where})=>2+(pending&&pending.createdAt>where.OR[1].createdAt.gt?1:0),
    deleteMany:async({where})=>{if(pending&&pending.createdAt<=where.createdAt.lte){pending=null;deletes++;return{count:1}}return{count:0}},
    create:async({data})=>{creates++;pending={id:'new',createdAt:new Clock(),...data};return pending},
   },user:{findUnique:async()=>({plan:'FREE'})},sfaOrganization:{findUnique:async()=>({name:'Synthetic'})},$queryRaw:async()=>[{role:'owner'}]};
   const prisma={...tx,$transaction:async fn=>fn(tx)},limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/plan-utils':load('src/lib/plan-utils.ts')},{Date:Clock});
   const route=load('src/app/api/sfa/members/route.ts',{'next/server':{NextResponse:Response},crypto:{randomUUID:()=>'new-token'},'@/lib/prisma':{prisma},'@/lib/sfa/limits':limits,'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',memberId:'actor',userId:'owner',role:'owner'}),hasMinRole:()=>true,orgSlugFrom:()=>undefined},'@/lib/sfa/types':{ROLE_HIERARCHY:{owner:3,admin:2,manager:1,member:0}},'@/lib/html-escape':{escapeHtml:v=>v},'@/lib/email':{sendEmail:async()=>{sends++;return{success:false}}}},{Date:Clock});
   const r=await route.POST({json:async()=>({email:'qa@example.invalid',role:'member'})});assert.equal(r.status,offset<=0?200:409);assert.equal(creates,offset<=0?1:0);assert.equal(deletes,offset<=0?1:0);assert.equal(sends,offset<=0?1:0);assert.ok(pending);
  }
 });
 console.log(JSON.stringify({passed:results.length,scope:'Actual SFA route and quota; synthetic transactional rollback/auth/clock, no production writes or email',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
