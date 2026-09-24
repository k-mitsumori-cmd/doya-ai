const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const match=(row,where)=>Object.entries(where).every(([k,v])=>k==='OR'?v.some(w=>match(row,w)):v&&typeof v==='object'?'in'in v?v.in.includes(row[k]):'gte'in v?row[k]>=v.gte:match(row[k],v):row[k]===v);
(async()=>{
 for(const role of ['OWNER','ADMIN','MANAGER','MEMBER','UNKNOWN','INACTIVE'])for(const route of ['list','filtered-list','employee','dashboard'])await check(role+' / '+route,async()=>{
  const rows=[['a','e','other','o'],['b','other','e','o'],['c','other','other','o'],['foreign','e','e','x']].map(([id,employeeId,managerId,organizationId])=>({id,employeeId,managerId,organizationId,managerNotes:'SECRET',privateNotes:'SECRET',aiSummary:'SECRET',aiInsights:['SECRET'],conductedAt:new Date('2099-01-01'),scheduledAt:new Date('2099-01-01'),employee:{firstName:'E',lastName:'Test'}}));
  const ctx={role:role==='INACTIVE'?'MEMBER':role,userId:'u',memberId:'m',organizationId:'o'};
  const select=where=>rows.filter(r=>match(r,where));
  const prisma={hrOrganizationMember:{findFirst:async()=>role==='INACTIVE'?null:{role,employeeId:'e'}},hrOneOnOne:{findMany:async q=>select(q.where),count:async q=>select(q.where).length},hrOrganization:{findUnique:async()=>({name:'Org'})},hrEmployee:{count:async()=>1,findFirst:async q=>({id:'other',oneOnOnesAsEmployee:select(q.include.oneOnOnesAsEmployee.where).filter(r=>r.employeeId==='other')})},hrDepartment:{count:async()=>1},hrEvaluationPeriod:{findMany:async()=>[]}};
  const evaluation=load('src/lib/hr/evaluation-access.ts',{'@/lib/prisma':{prisma}}),one=load('src/lib/hr/one-on-one-access.ts',{'./evaluation-access':evaluation});
  const deps={'next/server':{NextResponse:Response},'next-auth':{},'@/lib/auth':{},'@/lib/prisma':{prisma},'@/lib/hr/access':{getHrContext:async()=>ctx,hasMinRole:r=>['OWNER','ADMIN'].includes(r)},'@/lib/hr/types':{HrMemberRole:{ADMIN:'ADMIN'}},'@/lib/hr/evaluation-access':evaluation,'@/lib/hr/one-on-one-access':one,'@/lib/hr/constants':{DEFAULT_PAGE_SIZE:20,MAX_PAGE_SIZE:100}};
  const file=route==='employee'?'employees/[id]':route==='dashboard'?'dashboard':'one-on-one';const api=load('src/app/api/hr/'+file+'/route.ts',deps);
  const res=await api.GET({nextUrl:new URL('http://offline.invalid/'+(route==='filtered-list'?'?employeeId=other':''))},{params:Promise.resolve({id:'other'})});assert.equal(res.status,200);const body=await res.json();
  let expected=['OWNER','ADMIN'].includes(role)?['a','b','c']:['MEMBER','MANAGER'].includes(role)?['a','b']:[];
  if(['filtered-list','employee'].includes(route))expected=expected.filter(id=>id!=='a');
  const records=route==='employee'?body.employee.oneOnOnesAsEmployee:route==='dashboard'?body.recentOneOnOnes:body.items;
  assert.deepEqual(records.map(r=>r.id),expected);if(route!=='dashboard')for(const record of records){assert.equal(JSON.stringify(record).includes('SECRET'),['OWNER','ADMIN'].includes(role)||record.managerId==='e');}
  if(route==='dashboard')assert.equal(body.monthlyOneOnOnes,expected.length);
  if(route.includes('list')){assert.equal(body.total,expected.length);assert.equal(body.totalPages,expected.length?1:0)}
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
