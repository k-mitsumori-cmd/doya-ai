const operationModule = require('./load-typescript.cjs').load('src/lib/hr/department-operation.ts', {'node:crypto': require('node:crypto')});
const {projectDependencies,adaptProjectPrisma,businessActions}=require('./promane-project-operation-fixture.cjs');
const {adaptTimePrisma,operationId}=require('./promane-time-creation-fixture.cjs');
const assert=require('node:assert/strict');const {load,check,results}=require('./verify-data-integrity.cjs');
const privateApiResponse=require('./load-typescript.cjs').load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}});
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
  if(service==='kintai')prisma.$transaction=async fn=>fn(prisma);
  if(service==='hr'){prisma.$transaction=async fn=>fn(prisma);prisma.$queryRaw=async(parts,...values)=>{const sql=parts.join('');if(sql.includes('hr_organizations')){assert.deepEqual(values,['org1']);return[{id:'org1'}]}if(sql.includes('hr_organization_members')){assert.deepEqual(values,['m1','org1','u1']);return[{role:'ADMIN',status:'ACTIVE'}]}throw Error('Unexpected HR fixture SQL')}}
  const mocks={...auth,'@/lib/private-api-response':privateApiResponse,'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma},'@/lib/department-integrity':helper,[`@/lib/${service}/access`]:{[service==='hr'?'getHrContext':'getKintaiContext']:async()=>({organizationId:'org1',role:service==='hr'?'ADMIN':'owner',memberId:'m1',userId:'u1'}),hasMinRole:()=>true}};
  if(service==='hr'){mocks['@/lib/hr/department-operation']=operationModule;mocks['@/lib/hr/department-input']=load('src/lib/hr/department-input.ts');mocks['@/lib/hr/department-mutation']=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma}})}
  if(service==='kintai'){
    mocks['@/lib/kintai/employee-admission']={lockKintaiEmployeeAdmission:async()=>{}};
    mocks['@/lib/kintai/manager-admission']={lockCurrentKintaiManager:async()=> 'hr_admin'};
  }
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
 let writes=0;const prisma={$transaction:async function(fn){const tx={...this,promaneMember:{findFirst:async q=>q.where.userId?{id:'m1'}:this.promaneMember.findFirst(q)}};return fn(tx)},promaneMember:{findFirst:finder([{id:'m1',workspaceId:'ws1',isActive:true},{id:'foreign',workspaceId:'ws2',isActive:true},{id:'inactive',workspaceId:'ws1',isActive:false}])},promaneClient:{findFirst:finder([{id:'client',workspaceId:'ws1'},{id:'foreign',workspaceId:'ws2'}])},promaneTask:{findFirst:finder([{id:'task',projectId:'proj1',project:{workspaceId:'ws1'},startDate:null,dueDate:null},{id:'foreign',projectId:'proj2',project:{workspaceId:'ws2'}}]),aggregate:async()=>({_max:{order:0}}),create:async()=>{writes++;return{id:'synthetic-task',projectId:'proj1'}},update:async()=>{writes++;return{projectId:'proj1'}}},promaneProject:{findFirst:finder([{id:'proj1',workspaceId:'ws1',startDate:null,endDate:null,updatedAt:new Date('2026-09-01T01:00:00Z')}]),create:async()=>{writes++;return{}},update:async()=>{writes++;return{}}}};
 const mocks={'@/lib/prisma':{prisma:adaptTimePrisma(prisma)},'@/lib/promane/auth':{requirePromaneAuthAction:async()=>({userId:'u1'}),requireWritableWorkspace:async()=>({id:'ws1',userId:'u1'})},'next/cache':{revalidatePath(){}},'@/lib/promane/limits':{getUserPromaneLimits:async()=>({maxProjects:-1}),countUserProjects:async()=>0}};
 const tasks=load('src/lib/promane/actions-tasks.ts',{...mocks,'./task-creation':require('./load-typescript.cjs').load('src/lib/promane/task-creation.ts',{'node:crypto':require('node:crypto')}),'./task-input':require('./load-typescript.cjs').load('src/lib/promane/task-input.ts',{'./time-input':load('src/lib/promane/time-input.ts')}),'./time-input':load('src/lib/promane/time-input.ts')}),projects=businessActions(load('src/lib/promane/actions-projects.ts',{...mocks,...projectDependencies,'@/lib/prisma':{prisma:adaptProjectPrisma(prisma)}}),'u1');
 for(const [name,fn] of [
 ['task create foreign assignee',()=>tasks.createTask('ws',{operationId,expectedUserId:'u1',title:'Test',projectId:'proj1',assigneeId:'foreign'})],
 ['task create inactive assignee',()=>tasks.createTask('ws',{operationId,expectedUserId:'u1',title:'Test',projectId:'proj1',assigneeId:'inactive'})],
 ['task create foreign parent',()=>tasks.createTask('ws',{operationId,expectedUserId:'u1',title:'Test',projectId:'proj1',parentId:'foreign'})],
 ['task update foreign assignee',()=>tasks.updateTask('ws','task',{assigneeId:'foreign'})],
 ['project create foreign client',()=>projects.createProject('ws',{name:'Test',clientId:'foreign'})],
 ['project update foreign client',()=>projects.updateProject('ws','proj1',{clientId:'foreign',expectedUpdatedAt:'2026-09-01T01:00:00.000Z'})],
 ])await check('Promane rejects '+name,async()=>{let before=writes;await assert.rejects(fn,/担当者|親タスク|取引先/);assert.equal(writes,before)});
 await check('Promane preserves valid task/project creation, assignment and nullable clearing',async()=>{await tasks.createTask('ws',{operationId,expectedUserId:'u1',title:'Test',projectId:'proj1',assigneeId:'m1',parentId:'task'});await tasks.updateTask('ws','task',{assigneeId:null});await projects.createProject('ws',{name:'Test',clientId:'client'});await projects.updateProject('ws','proj1',{clientId:null,expectedUpdatedAt:'2026-09-01T01:00:00.000Z'});assert.equal(writes,4)});
}
async function creative(){let downloads=0,ai=0,writes=0;const concept={id:'c1',copy:{headline:'Synthetic',sub:'',cta:'View'},creatives:[{id:'image1',imagePath:'own.png',placementKey:'test'}],campaign:{brand:{name:'Own'}}};
 const feedback=load('src/lib/adimage/feedback.ts',{'./vision':{visionJson:async()=>{ai++;return{scores:{visibility:1,appeal:2,cta:3,fit:4,brand:5},directives:[],advice:'Synthetic feedback'}}}});
 const feedbackInput=load('src/lib/adimage/feedback-input.ts',{'./feedback':feedback},{TextDecoder,setTimeout,clearTimeout});
 const mocks={'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma:{adImageConcept:{findFirst:async q=>{assert.equal(q.where.campaign.userId,'u1');return concept}},adImageFeedback:{create:async()=>{writes++;return{id:'feedback'}}}}},'@/lib/adimage/access':{getIdentity:async()=>({userId:'u1'}),requireUser:()=>({ok:true}),ownerWhere:()=>({userId:'u1'})},'@/lib/adimage/feedback':feedback,'@/lib/adimage/feedback-input':feedbackInput,'@/lib/adimage/storage':{downloadBuffer:async()=>{downloads++;return Buffer.from('mock')}},'@/lib/adimage/placements':{findPlacement:()=>({name:'test'})}};
 require('./adimage-feedback-boundary-fixture.cjs').connect(mocks);
 const api=load('src/app/api/adimage/concepts/[id]/feedback/route.ts',mocks);
 await check('AdImage foreign creative rejected before storage, AI and writes',async()=>{assert.equal((await api.POST(req({creativeId:'foreign',operationId:require('./adimage-feedback-boundary-fixture.cjs').operationId}),ctx)).status,404);assert.equal(downloads+ai+writes,0)});
 await check('AdImage same-concept creative remains accepted',async()=>{assert.equal((await api.POST(req({creativeId:'image1',operationId:require('./adimage-feedback-boundary-fixture.cjs').operationId}),ctx)).status,200);assert.equal(downloads,1);assert.equal(ai,1);assert.equal(writes,1)});
}
(async()=>{await departments();await evaluations();await promane();await creative();console.log(JSON.stringify({passed:results.length,networkRequests:0,paidApiRequests:0,results},null,2))})().catch(e=>{console.error(e);process.exitCode=1});
