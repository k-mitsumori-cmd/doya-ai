const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');
const epoch = Date.parse('2026-10-06T04:00:00Z'), ttl = 48*60*60*1000, token = 'synthetic-token-long-enough';
function fixture(service, { offset = -1, delayAt = '', existing = false, changed = {}, changedAfterRead = {}, full = false } = {}) {
 let now=epoch+offset, audits=0, writes=0, rollbacks=0;
 class Clock extends Date { constructor(...args){super(...(args.length?args:[now]))} static now(){return now} }
 const delay=stage=>{if(stage===delayAt)now=epoch};
 let member={id:'invite',organizationId:'org',organization:{id:'org',name:'Synthetic',slug:'team'},status:'PENDING',role:service==='hr'?'MEMBER':'member',token,inviteToken:token,email:'qa@example.invalid',inviteEmail:'qa@example.invalid',createdAt:new Date(epoch-ttl),expiresAt:new Date(epoch),acceptedAt:null};
 let created=0;
 const model={
  findUnique:async({where})=>{if(where.inviteToken||where.token)return structuredClone(member);delay('read');return structuredClone({...member,...changed})},
  findFirst:async()=>{delay('existing');Object.assign(member,changedAfterRead);return existing?{id:'existing'}:null},
  updateMany:async({where,data})=>{
   for(const key of ['organizationId','role','inviteEmail','email','inviteToken','token','status'])if(where[key]!==undefined&&where[key]!==({...member,...changed})[key])return {count:0};
   if(where.createdAt?.gt&&!(member.createdAt>where.createdAt.gt))return {count:0};
   if(where.expiresAt?.gt&&!(member.expiresAt>where.expiresAt.gt))return {count:0};
   writes++;Object.assign(member,data);delay('claim');return{count:1};
  },
  deleteMany:async()=>{writes++;member=null;delay('delete');return{count:1}},
 };
 const tx={
  $queryRaw:async()=>{delay('lock');return[{id:'org'}]},
  [`${service}Member`]:model,hrInvitation:model,
  hrOrganizationMember:{count:async()=>{delay('quota');return full?2:1},create:async()=>{writes++;created++;delay('create');return{id:'new-member'}}},
  user:{findUnique:async()=>{delay('account');return{email:'qa@example.invalid'}}},
 };
 const prisma={...tx,$transaction:async work=>{const before=structuredClone(member),beforeCreated=created;try{return await work(tx)}catch(error){member=before;created=beforeCreated;rollbacks++;throw error}}};
 const common={'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'user',email:'qa@example.invalid'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},[`@/lib/${service}/access`]:{resolveUserId:async()=>'user'},'@/lib/hr/audit':{logAudit:async()=>{audits++}},'@/lib/hr/billing':{getOrgPlan:async()=>'FREE',getOrgPlanLimits:()=>({maxMembers:2})}};
 if(service==='hr')prisma.hrOrganizationMember={findFirst:async()=>null};
 const api=load(service==='hr'?'src/app/api/hr/organization/invite/accept/route.ts':`src/app/api/${service}/invite/[token]/route.ts`,common,{Date:Clock});
 return{post:()=>api.POST({json:async()=>({token})},{params:Promise.resolve({token})}),get:()=>api.GET({}, {params:Promise.resolve({token})}),state:()=>structuredClone({member,created}),stats:()=>({writes,rollbacks,audits})};
}
(async()=>{
 for(const service of ['aio','shodan','quote','mensetsu','aishodan']){
  await check(`${service}: exact deadline expires in GET/POST without mutation`,async()=>{for(const method of ['get','post']){const f=fixture(service,{offset:0}),before=f.state();assert.equal((await f[method]()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().writes,0)}});
  await check(`${service}: 1ms before deadline remains valid`,async()=>{const f=fixture(service);assert.equal((await f.get()).status,200);assert.equal((await f.post()).status,200);assert.equal(f.state().member.status,'ACTIVE')});
  await check(`${service}: expiry during lock/account/existing read never grants membership`,async()=>{for(const delayAt of ['lock','account','existing']){const f=fixture(service,{delayAt}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().writes,0)}});
  await check(`${service}: delayed claim rolls back the consumed token and active membership`,async()=>{const f=fixture(service,{delayAt:'claim'}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().writes,1);assert.equal(f.stats().rollbacks,1)});
  await check(`${service}: delayed existing-member cleanup rolls back the invitation deletion`,async()=>{const f=fixture(service,{delayAt:'delete',existing:true}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().rollbacks,1)});
  await check(`${service}: changed role/email/organization between verification and claim never grants membership`,async()=>{for(const changedAfterRead of [{role:'admin'},{inviteEmail:'other@example.invalid'},{organizationId:'foreign'}]){const f=fixture(service,{changedAfterRead});assert.equal((await f.post()).status,409);assert.equal(f.stats().writes,0);assert.equal(f.state().member.status,'PENDING');assert.equal(f.state().member.inviteToken,token)}});
  await check(`${service}: a different organization after locking is rejected without claim`,async()=>{const f=fixture(service,{changed:{organizationId:'foreign'}}),before=f.state();assert.equal((await f.post()).status,409);assert.deepEqual(f.state(),before);assert.equal(f.stats().writes,0)});
 }
 await check('HR: expiry during seat count outranks capacity and cannot claim',async()=>{for(const full of [false,true]){const f=fixture('hr',{delayAt:'quota',full}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().writes,0);assert.equal(f.stats().audits,0)}});
 await check('HR: expiry during claim or member creation rolls back both rows and skips success audit',async()=>{for(const delayAt of ['claim','create']){const f=fixture('hr',{delayAt}),before=f.state();assert.equal((await f.post()).status,410);assert.deepEqual(f.state(),before);assert.equal(f.stats().rollbacks,1);assert.equal(f.stats().audits,0)}});
 await check('HR: valid invitation still claims, creates membership and records audit',async()=>{const f=fixture('hr');assert.equal((await f.post()).status,200);assert.equal(f.state().member.status,'ACCEPTED');assert.equal(f.state().created,1);assert.equal(f.stats().audits,1)});
 console.log(JSON.stringify({passed:results.length,scope:'Actual six APIs; synthetic clock, row lock and transactional rollback model; no production DB or email',results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
