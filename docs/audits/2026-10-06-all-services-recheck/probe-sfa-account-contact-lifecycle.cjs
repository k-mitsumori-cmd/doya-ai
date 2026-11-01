const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
function fixture(kind){let writes=0,active=true,accountActive=true,revoke=false,race=false;
 const db={$transaction:async fn=>fn(db),sfaMember:{findFirst:async()=>({userId:'owner'})},user:{findUnique:async()=>({plan:'FREE'})},sfaAccount:{count:async()=>0,create:async({data})=>({id:'account-'+ ++writes,...data}),findFirst:async()=>{const found=accountActive?{id:'account'}:null;if(race)accountActive=false;return found;}},sfaContact:{create:async({data})=>({id:'contact-'+ ++writes,...data})}};
 const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
 const route=load('src/app/api/sfa/'+kind+'/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>{const c={organizationId:'org',userId:'actor',memberId:'member'};if(revoke)active=false;return c;},orgSlugFrom:()=> 'alpha'},'@/lib/sfa/format':{bigIntToNumber:x=>x},'@/lib/sfa/limits':limits});
 return {post:()=>route.POST({json:async()=>({name:'Synthetic',operationId:'10000000-0000-4000-8000-000000000001',...(kind==='contacts'?{accountId:'account'}:{})})}),writes:()=>writes,revoke:()=>revoke=true,active:()=>active,race:()=>race=true,accountActive:()=>accountActive};
}
(async()=>{const findings=[];
 for(const kind of ['accounts','contacts']){
  let f=fixture(kind);assert.equal((await f.post()).status,200);assert.equal((await f.post()).status,200);assert.equal(f.writes(),2);findings.push(kind+': same operationId is ignored; two requests create two rows.');
  f=fixture(kind);f.revoke();assert.equal((await f.post()).status,200);assert.equal(f.active(),false);assert.equal(f.writes(),1);findings.push(kind+': actor is not revalidated after context snapshot before creation.');
 }
 const f=fixture('contacts');f.race();assert.equal((await f.post()).status,200);assert.equal(f.accountActive(),false);assert.equal(f.writes(),1);findings.push('contacts: account can become inactive between ownership lookup and contact creation; no relation lock/revalidation.');
 const paths=['src/app/api/sfa/accounts/route.ts','src/app/api/sfa/contacts/route.ts'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-account-contact-lifecycle-baseline.json',JSON.stringify({checkedAt:new Date().toISOString(),status:'confirmed-handler-gaps-not-repaired',findings,sourceHashes:Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual handlers and account quota helper with synthetic context/Prisma schedules. No real database concurrency, customer writes or authenticated browser proof.'},null,2)+'\n');console.log('Confirmed account/contact lifecycle findings:'+findings.length);
})().catch(error=>{console.error(error);process.exitCode=1});
