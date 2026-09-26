const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
(async()=>{
 for(const role of ['OWNER','ADMIN','MANAGER','MEMBER','UNKNOWN'])for(const relation of ['subject','manager','unrelated','inactive'])for(const operation of ['GET','PATCH','AI'])await check([role,relation,operation].join(' / '),async()=>{
  const employeeId=relation==='subject'?'employee':relation==='manager'?'manager':'other';
  const context={role,userId:'u',memberId:'m',organizationId:'o'};let writes=0,calls=0;
  const record={id:'one',employeeId:'employee',managerId:'manager',status:'SCHEDULED',updatedAt:new Date(),managerNotes:'SECRET',privateNotes:'SECRET',aiSummary:'SECRET',aiInsights:['SECRET'],employeeNotes:'Shared',employee:{firstName:'E',lastName:'Test'},manager:{firstName:'M',lastName:'Test'}};
  const prisma={hrOrganizationMember:{findFirst:async({where})=>{
    assert.equal(where.id,'m');assert.equal(where.userId,'u');assert.equal(where.organizationId,'o');assert.equal(where.status,'ACTIVE');
    return relation==='inactive'?null:{role,employeeId};
  }},hrOneOnOne:{findFirst:async({where})=>{assert.equal(where.organizationId,'o');return record},update:async({data})=>{writes++;return{...record,...data}}}};
  const reader=load('src/lib/hr/evaluation-access.ts',{'@/lib/prisma':{prisma}});
  const access=load('src/lib/hr/one-on-one-access.ts',{'./evaluation-access':reader});
  const deps={'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/hr/access':{getHrContext:async()=>context},'@/lib/hr/one-on-one-access':access,'@/lib/prisma':{prisma},'@/lib/hr/prompts':{buildOneOnOneSummaryPrompt:()=>''},'@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'synthetic',geminiGenerateText:async()=>{calls++;return'Summary'}},'@/lib/hr/billing':{reserveAiUsage:async()=>({granted:true,reservation:{organizationId:'o',resetAt:new Date()}}),releaseAiUsage:async()=>{}}};
  const route=load('src/app/api/hr/one-on-one/[id]/'+(operation==='AI'?'ai-summary/':'')+'route.ts',deps);
  const response=await route[operation==='AI'?'POST':operation]({json:async()=>({employeeNotes:'Updated'})},{params:Promise.resolve({id:'one'})});
  const allowed=(operation!=='AI'||['OWNER','ADMIN'].includes(role)||relation==='manager')&&role!=='UNKNOWN'&&relation!=='inactive'&&(['OWNER','ADMIN'].includes(role)||['subject','manager'].includes(relation));
  assert.equal(response.status,allowed?200:403);if(operation==='GET'&&allowed){const serialized=JSON.stringify(await response.json());assert.equal(serialized.includes('SECRET'),['OWNER','ADMIN'].includes(role)||relation==='manager');}assert.equal(writes,allowed&&operation!=='GET'?1:0);assert.equal(calls,allowed&&operation==='AI'?1:0);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
