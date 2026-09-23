const assert=require('node:assert/strict');const {load,check,results}=require('./verify-data-integrity.cjs');
const Resp={json:(body,opts)=>({body,status:opts?.status??200})};const req=body=>new Request('https://local.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const ctx={params:Promise.resolve({id:'own'})};
const match=(r,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'?match(r[k]||{},v):r[k]===v);
const finder=rows=>async q=>rows.find(r=>match(r,q.where))||null;
const auth={'next-auth':{getServerSession:async()=>({user:{id:'u1'}})},'@/lib/auth':{authOptions:{}}};
async function departments(){
 const helper=load('src/lib/department-integrity.ts');
 for(const service of ['hr','kintai'])for(const tail of ['','[id]/']){
  const method=tail?'PATCH':'POST';let writes=0;
  const departments=[{id:'own',organizationId:'org1',parentId:null},{id:'ok',organizationId:'org1',parentId:null},{id:'child',organizationId:'org1',parentId:'own'},{id:'foreign',organizationId:'org2',parentId:null},{id:'loop',organizationId:'org1',parentId:'loop'}];
  const prisma={[service+'Department']:{findFirst:finder(departments),create:async()=>{writes++;return{id:'new'}},update:async()=>{writes++;return{id:'own'}}},[service+'Employee']:{findFirst:finder([{id:'manager',organizationId:'org1'},{id:'foreign-manager',organizationId:'org2'}])}};
  const mocks={...auth,'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma},'@/lib/department-integrity':helper,[`@/lib/${service}/access`]:{[service==='hr'?'getHrContext':'getKintaiContext']:async()=>({organizationId:'org1',role:'owner'}),hasMinRole:()=>true}};
  const api=load(`src/app/api/${service}/departments/${tail}route.ts`,mocks);
  for(const data of [{parentId:'foreign'},{managerId:'foreign-manager'},{parentId:'loop'},...(tail?[{parentId:'child'},{parentId:'own'}]:[])])await check(service+' '+method+' rejects '+JSON.stringify(data),async()=>{let before=writes;const r=await api[method](req({name:'Test',...data}),ctx);assert.equal(r.status,400);assert.equal(writes,before)});
  await check(service+' '+method+' accepts same-organization links and clears nullable links',async()=>{assert([200,201].includes((await api[method](req({name:'Test',parentId:'ok',managerId:'manager'}),ctx)).status));assert([200,201].includes((await api[method](req({name:'Test',parentId:null,managerId:null}),ctx)).status))});
 }
}
async function evaluations(){for(const tail of ['','[id]/']){
 let writes=0;const method=tail?'PATCH':'POST';
 const prisma={hrEmployee:{findFirst:finder([{id:'employee',organizationId:'org1'},{id:'manager',organizationId:'org1'},{id:'foreign',organizationId:'org2'}])},hrEvaluationPeriod:{findFirst:finder([{id:'period',organizationId:'org1'}])},hrEvaluation:{findFirst:async()=>tail?{id:'own',period:{organizationId:'org1'}}:null,create:async()=>{writes++;return{}},update:async()=>{writes++;return{}}}};
 const api=load('src/app/api/hr/evaluations/'+tail+'route.ts',{...auth,'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'org1'})},'@/lib/hr/evaluation-access':{canReadEvaluation:async()=>true,getEvaluationRatingField:async()=> 'finalRating',getEvaluationReader:async()=>({employeeId:null})},'@/lib/hr/constants':{DEFAULT_PAGE_SIZE:20,MAX_PAGE_SIZE:100}});
 await check('HR evaluation '+method+' rejects foreign evaluator without writes',async()=>{let r=await api[method](req({periodId:'period',employeeId:'employee',evaluatorId:'foreign'}),ctx);assert.equal(r.status,400);assert.equal(writes,0)});
 await check('HR evaluation '+method+' retains valid and unassigned evaluator',async()=>{for(const evaluatorId of ['manager',null])assert.equal((await api[method](req({periodId:'period',employeeId:'employee',evaluatorId}),ctx)).status,200)});
}}
async function promane(){
 let writes=0;const prisma={$transaction:async function(fn){const tx={...this,promaneMember:{findFirst:async()=>({id:'m1'})}};return fn(tx)},promaneMember:{findFirst:finder([{id:'m1',workspaceId:'ws1',isActive:true},{id:'foreign',workspaceId:'ws2',isActive:true},{id:'inactive',workspaceId:'ws1',isActive:false}])},promaneClient:{findFirst:finder([{id:'client',workspaceId:'ws1'},{id:'foreign',workspaceId:'ws2'}])},promaneTask:{findFirst:finder([{id:'task',projectId:'proj1',project:{workspaceId:'ws1'},startDate:null,dueDate:null},{id:'foreign',projectId:'proj2',project:{workspaceId:'ws2'}}]),aggregate:async()=>({_max:{order:0}}),create:async()=>{writes++;return{projectId:'proj1'}},update:async()=>{writes++;return{projectId:'proj1'}}},promaneProject:{findFirst:finder([{id:'proj1',workspaceId:'ws1',startDate:null,endDate:null}]),create:async()=>{writes++;return{}},update:async()=>{writes++;return{}}}};
 const mocks={'@/lib/prisma':{prisma},'@/lib/promane/auth':{requirePromaneAuthAction:async()=>({userId:'u1'}),requireWritableWorkspace:async()=>({id:'ws1'})},'next/cache':{revalidatePath(){}},'@/lib/promane/limits':{getUserPromaneLimits:async()=>({maxProjects:-1}),countUserProjects:async()=>0}};
 const tasks=load('src/lib/promane/actions-tasks.ts',mocks),projects=load('src/lib/promane/actions-projects.ts',{...mocks,'./time-input':load('src/lib/promane/time-input.ts')});
 for(const [name,fn] of [
 ['task create foreign assignee',()=>tasks.createTask('ws',{title:'Test',projectId:'proj1',assigneeId:'foreign'})],
 ['task create inactive assignee',()=>tasks.createTask('ws',{title:'Test',projectId:'proj1',assigneeId:'inactive'})],
 ['task create foreign parent',()=>tasks.createTask('ws',{title:'Test',projectId:'proj1',parentId:'foreign'})],
 ['task update foreign assignee',()=>tasks.updateTask('ws','task',{assigneeId:'foreign'})],
 ['project create foreign client',()=>projects.createProject('ws',{name:'Test',clientId:'foreign'})],
 ['project update foreign client',()=>projects.updateProject('ws','proj1',{clientId:'foreign'})],
 ])await check('Promane rejects '+name,async()=>{let before=writes;await assert.rejects(fn);assert.equal(writes,before)});
 await check('Promane preserves valid task/project creation, assignment and nullable clearing',async()=>{await tasks.createTask('ws',{title:'Test',projectId:'proj1',assigneeId:'m1',parentId:'task'});await tasks.updateTask('ws','task',{assigneeId:null});await projects.createProject('ws',{name:'Test',clientId:'client'});await projects.updateProject('ws','proj1',{clientId:null});assert.equal(writes,4)});
}
async function creative(){let downloads=0,ai=0,writes=0;const concept={id:'c1',creatives:[{id:'image1',imagePath:'own.png',placementKey:'test'}],campaign:{brand:{name:'Own'}}};
 const api=load('src/app/api/adimage/concepts/[id]/feedback/route.ts',{'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma:{adImageConcept:{findFirst:async q=>{assert.equal(q.where.campaign.userId,'u1');return concept}},adImageFeedback:{create:async()=>{writes++;return{id:'feedback'}}}}},'@/lib/adimage/access':{getIdentity:async()=>({userId:'u1'}),requireUser:()=>({ok:true}),ownerWhere:()=>({userId:'u1'})},'@/lib/adimage/feedback':{REFINE_CHIPS:[],evaluateCreative:async()=>{ai++;return{scores:{},directives:{},advice:''}}},'@/lib/adimage/storage':{downloadBuffer:async()=>{downloads++;return Buffer.from('mock')}},'@/lib/adimage/placements':{findPlacement:()=>({name:'test'})}});
 await check('AdImage foreign creative rejected before storage, AI and writes',async()=>{assert.equal((await api.POST(req({creativeId:'foreign'}),ctx)).status,404);assert.equal(downloads+ai+writes,0)});
 await check('AdImage same-concept creative remains accepted',async()=>{assert.equal((await api.POST(req({creativeId:'image1'}),ctx)).status,200);assert.equal(downloads,1);assert.equal(ai,1);assert.equal(writes,1)});
}
(async()=>{await departments();await evaluations();await promane();await creative();console.log(JSON.stringify({passed:results.length,networkRequests:0,paidApiRequests:0,results},null,2))})().catch(e=>{console.error(e);process.exitCode=1});
