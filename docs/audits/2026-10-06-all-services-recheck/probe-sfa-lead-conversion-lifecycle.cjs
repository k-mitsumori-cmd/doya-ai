const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const file='src/app/api/sfa/leads/[id]/convert/route.ts';
function fixture({changeName=false,won=false,contactName=null}={}){
 let active=true;let current={id:'lead',organizationId:'org',isActive:true,status:'new',convertedAccountId:null,name:'Initial lead',contactName,raw:{},note:null};const writes=[];
 const db={
  sfaMember:{findFirst:async()=>({userId:'owner'}),count:async()=>2},user:{findUnique:async()=>({plan:'FREE'})},
  sfaLead:{findUnique:async()=>({...current}),updateMany:async({where,data})=>{if(changeName)current.name='Edited before conversion';if(current.status==='converted'||!current.isActive||current.convertedAccountId)return{count:0};current={...current,...data};return{count:1}},update:async({data})=>{current={...current,...data};return current}},
  sfaPipeline:{findFirst:async()=>({id:'pipeline'})},sfaStage:{findFirst:async()=>({id:'stage',probability:won?100:50,isWon:won,isLost:false})},
  sfaAccount:{count:async()=>0,create:async({data})=>{writes.push({kind:'account',active,data});return{id:'account',...data}}},
  sfaContact:{create:async({data})=>{writes.push({kind:'contact',active,data});return{id:'contact',...data}}},
  sfaDeal:{count:async()=>0,create:async({data})=>{writes.push({kind:'deal',active,data});return{id:'deal',...data}}},
  $transaction:async fn=>fn(db),
 };
 const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
 const route=load(file,{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>{active=false;return{organizationId:'org',userId:'actor',memberId:'member'}},orgSlugFrom:()=> 'alpha'},'@/lib/sfa/limits':limits,'@/lib/sfa/amount':load('src/lib/sfa/amount.ts'),'@/lib/sfa/format':load('src/lib/sfa/format.ts')});
 return{writes,current:()=>current,post:body=>route.POST({json:async()=>body},{params:Promise.resolve({id:'lead'})})};
}
(async()=>{const results=[];
 {const f=fixture();assert.equal((await f.post({})).status,200);assert.ok(f.writes.length>=2&&f.writes.every(w=>w.active===false));results.push('Conversion creates account/deal after synthetic membership revocation following context resolution');}
 {const f=fixture({changeName:true});assert.equal((await f.post({})).status,200);assert.equal(f.current().name,'Edited before conversion');assert.equal(f.writes.find(w=>w.kind==='account').data.name,'Initial lead');results.push('Conversion copies stale lead snapshot even after source name changes before claim');}
 {const f=fixture({won:true});assert.equal((await f.post({})).status,200);const deal=f.writes.find(w=>w.kind==='deal').data;assert.equal(deal.stageId,'stage');assert.equal(deal.probability,100);assert.equal(deal.status,'open');assert.equal(deal.wonAt,undefined);results.push('Won default stage yields open deal without wonAt');}
 {const f=fixture();assert.equal((await f.post({dealName:'x'.repeat(201)})).status,200);assert.equal(f.writes.find(w=>w.kind==='deal').data.name.length,200);results.push('Submitted 201-character deal name silently truncates to200');}
 {const f=fixture({contactName:'x'.repeat(100)});assert.equal((await f.post({})).status,200);assert.equal(f.writes.find(w=>w.kind==='contact').data.name.length,80);results.push('100-character lead contact name silently truncates to80 during conversion');}
 const report={checkedAt:new Date().toISOString(),findings:results.length,results,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),scope:'Actual conversion API and actual quota admission/amount/format helpers, synthetic Prisma and context. Existing conditional claim protects same-lead duplicate conversion; this probe does not claim a duplicate-write race. No real PostgreSQL scheduling/customer/provider writes.'};fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-lead-conversion-lifecycle-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({confirmedFindings:results.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
