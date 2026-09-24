const assert=require('node:assert/strict');const {load}=require('./load-typescript.cjs');let cases=0;
const ranks={employee:0,manager:1,hr_admin:2,system_admin:3};
function fixture(o={}){
 const context={employeeId:'viewer',organizationId:'org',role:o.role||'employee'};
 const request={id:'r',employeeId:o.self?'viewer':'subject',employee:{organizationId:o.foreign?'other':'org',departmentId:o.targetDept===undefined?'dep':o.targetDept},reason:'SYNTHETIC_PRIVATE_REASON',status:'pending',type:'leave',details:{}};
 let employeeFilter,claimed=0;
 const db={kintaiRequest:{findUnique:async()=>o.missing?null:request,findMany:async()=>[],count:async()=>0,groupBy:async()=>[],updateMany:async()=>{claimed++;return{count:1}}},kintaiEmployee:{findUnique:async({where})=>({organizationId:'org',departmentId:where.id==='viewer'?(o.viewerDept===undefined?'dep':o.viewerDept):(o.targetDept===undefined?'dep':o.targetDept)}),findMany:async({where})=>{employeeFilter=where;return[]}}};
 const prisma={...db,$transaction:fn=>fn(db)};
 const mocks={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/kintai/access':{getKintaiContext:async()=>o.anonymous?null:context,hasMinRole:(role,min)=>(ranks[role]??0)>=ranks[min]},'@/lib/kintai/shift-records':{openShiftStart:()=>null},'@/lib/kintai/recalculate':{recalculateDayForEmployee:async()=>{}}};
 const detail=load('src/app/api/kintai/requests/[id]/route.ts',mocks),list=load('src/app/api/kintai/requests/route.ts',mocks);
 return{get:()=>detail.GET(new Request('http://offline.invalid'),{params:Promise.resolve({id:'r'})}),approve:()=>detail.PATCH({json:async()=>({status:'approved'})},{params:Promise.resolve({id:'r'})}),list:()=>list.GET(new Request('http://offline.invalid')),filter:()=>employeeFilter,claimed:()=>claimed};
}
(async()=>{
 for(const [name,o,status] of [
 ['本人',{self:true},200],['一般社員から他人',{},404],['同部署管理者',{role:'manager'},200],['他部署管理者',{role:'manager',viewerDept:'else'},404],['部署なし管理者',{role:'manager',viewerDept:null,targetDept:null},404],['部署なし管理者本人',{role:'manager',viewerDept:null,targetDept:null,self:true},200],['人事',{role:'hr_admin',viewerDept:null},200],['システム管理者',{role:'system_admin'},200],['他組織の管理者',{role:'system_admin',foreign:true},404],['存在しない申請',{missing:true},404],['未認証',{anonymous:true},401]]){
  const r=await fixture(o).get();assert.equal(r.status,status,name);if(status!==200)assert.ok(!JSON.stringify(await r.json()).includes('SYNTHETIC_PRIVATE_REASON'));cases++;console.log('PASS',name);
 }
 const list=fixture({role:'manager'});await list.list();assert.equal(list.filter().organizationId,'org');assert.equal(list.filter().departmentId,'dep');cases++;console.log('PASS 部署一覧も組織を固定');
 for(const targetDept of [null,'dep']){const f=fixture({role:'manager',viewerDept:null,targetDept});assert.equal((await f.approve()).status,403);assert.equal(f.claimed(),0);cases++;console.log('PASS 部署なし管理者の承認拒否',targetDept)}
 console.log(cases+' cases passed');
})().catch(e=>{console.error(e);process.exitCode=1});
