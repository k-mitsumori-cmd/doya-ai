const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function load(file,deps){const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,Date,console:{error(){}},require:n=>{if(n in deps)return deps[n];throw Error(n)}});return exported}
const types=load('src/lib/kintai/types.ts',{}),access=load('src/lib/kintai/access.ts',{'./types':types,'next-auth':{},'@/lib/auth':{},'@/lib/prisma':{}});
const cases=[
 {name:'unchanged-admin-role',actor:'hr_admin',old:'system_admin',role:'system_admin',http:200},
 {name:'reject-promotion',actor:'hr_admin',old:'employee',role:'system_admin',http:403},
 {name:'reject-superior-demotion',actor:'hr_admin',old:'system_admin',role:'employee',http:403},
 {name:'invalid-role',actor:'system_admin',old:'employee',role:'unknown',http:400},
 {name:'empty-role',actor:'system_admin',old:'employee',role:'',http:400},
 {name:'allowed-promotion',actor:'system_admin',old:'employee',role:'system_admin',http:200},
 {name:'role-write-failure',actor:'system_admin',old:'employee',role:'manager',fail:'member',http:500},
 {name:'employee-write-failure',actor:'system_admin',old:'employee',role:'manager',fail:'employee',http:500},
 {name:'foreign-employee',actor:'system_admin',old:'employee',role:'manager',foreign:true,http:404},
 {name:'unauthorized-role',actor:'employee',old:'employee',role:'employee',http:403},
];
(async()=>{const results=[];
for(const c of cases){
 let row={id:'target',organizationId:c.foreign?'other':'org',name:'before',member:{id:'member',role:c.old}},attempts=[],rollbacks=0;
 const before=JSON.stringify(row);
 const tx={kintaiEmployee:{findFirst:async({where})=>where.id===row.id&&where.organizationId===row.organizationId?structuredClone(row):null,update:async({data})=>{attempts.push('employee');if(c.fail==='employee')throw Error('synthetic failure');row={...row,...data};return structuredClone(row)}},kintaiMember:{update:async({data})=>{attempts.push('member');if(c.fail==='member')throw Error('synthetic failure');row.member={...row.member,...data};return structuredClone(row.member)}}};
 const prisma={$transaction:async fn=>{const saved=structuredClone(row);try{return await fn(tx)}catch(e){row=saved;rollbacks++;throw e}}};
 const api=load('src/app/api/kintai/employees/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/kintai/access':{getKintaiContext:async()=>({organizationId:'org',role:c.actor}),hasMinRole:access.hasMinRole}});
 const r=await api.PATCH({json:async()=>({name:'after',role:c.role})},{params:Promise.resolve({id:'target'})});
 const changed=JSON.stringify(row)!==before;
 const ok=r.status===c.http&&(c.http===200?row.name==='after'&&row.member.role===c.role:!changed)&&(c.http===400||c.http===403||c.http===404?attempts.length===0:true)&&(c.fail?rollbacks===1:true);
 results.push({name:c.name,outcome:ok?'PASS':'FAIL',http:r.status,changed,attempts,rollbacks});
}
console.log(JSON.stringify({cases:results.length,results},null,2));if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
