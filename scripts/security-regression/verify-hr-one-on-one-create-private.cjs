const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
function fixture(role,active=true){
 let writes=0;const ctx={role,userId:'u',memberId:'m',organizationId:'o'};
 const prisma={hrOrganizationMember:{findFirst:async()=>active?{role,employeeId:'self'}:null},hrEmployee:{findFirst:async({where})=>where.organizationId==='o'?{id:where.id}:null},hrOneOnOne:{create:async({data})=>{writes++;return{id:'one',...data}},findFirst:async()=>({id:'one',managerId:'manager',employeeId:'self',status:'SCHEDULED'}),update:async({data})=>{writes++;return{id:'one',managerId:'manager',...data}}}};
 const evaluation=load('src/lib/hr/evaluation-access.ts',{'@/lib/prisma':{prisma}}),access=load('src/lib/hr/one-on-one-access.ts',{'./evaluation-access':evaluation});
 const deps={'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/hr/access':{getHrContext:async()=>ctx},'@/lib/prisma':{prisma},'@/lib/hr/one-on-one-access':access,'@/lib/hr/constants':{DEFAULT_PAGE_SIZE:20,MAX_PAGE_SIZE:100}};
 return{create:load('src/app/api/hr/one-on-one/route.ts',deps).POST,patch:load('src/app/api/hr/one-on-one/[id]/route.ts',deps).PATCH,writes:()=>writes};
}
(async()=>{
 for(const role of ['OWNER','ADMIN','MANAGER','MEMBER','UNKNOWN'])for(const active of [true,false])for(const managerId of ['self','other'])await check(`create ${role} active=${active} manager=${managerId}`,async()=>{
  const f=fixture(role,active),allowed=active&&(['OWNER','ADMIN'].includes(role)||role==='MANAGER'&&managerId==='self');
  const response=await f.create({json:async()=>({employeeId:'subject',managerId,duration:45})});assert.equal(response.status,allowed?200:403);assert.equal(f.writes(),allowed?1:0);if(allowed)assert.equal((await response.json()).oneOnOne.duration,45);
 });
 for(const field of ['managerNotes','managerNote','privateNotes'])for(const value of ['Overwrite',null])await check(`subject cannot update ${field}=${value}`,async()=>{
  const f=fixture('MEMBER');const response=await f.patch({json:async()=>({[field]:value})},{params:Promise.resolve({id:'one'})});assert.equal(response.status,403);assert.equal(f.writes(),0);
 });
 for(const body of [{employeeId:'self',managerId:'self'},{employeeId:'subject',managerId:'self',duration:0},{employeeId:'subject',managerId:'self',duration:1.5}])await check('invalid creation '+JSON.stringify(body),async()=>{const f=fixture('ADMIN');assert.equal((await f.create({json:async()=>body})).status,400);assert.equal(f.writes(),0)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
