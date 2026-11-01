const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const file='src/app/api/hr/departments/route.ts',cases=[];
(async()=>{
for(const count of [50,5000]){
 const departments=Array.from({length:count},(_,i)=>({id:'synthetic-deep-'+i,name:'Synthetic department '+i,code:null,parentId:i?'synthetic-deep-'+(i-1):null,managerId:null,sortOrder:i,isActive:true,_count:{employees:0}}));
 const api=load(file,{'next/server':{NextResponse:Response},'next-auth':{},'@/lib/auth':{},'@/lib/prisma':{prisma:{hrDepartment:{findMany:async args=>{assert.deepEqual(JSON.parse(JSON.stringify(args.where)),{organizationId:'synthetic-org'});return departments}}}},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'synthetic-org',role:'ADMIN'}),hasMinRole:()=>true},'@/lib/department-integrity':{},'@/lib/hr/department-operation':load('src/lib/hr/department-operation.ts',{'node:crypto':crypto}),'@/lib/hr/department-input':{},'@/lib/hr/department-mutation':{},'@/lib/private-api-response':load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}})});
 const start=Date.now(),res=await api.GET();assert.equal(res.status,count===50?200:500);const data=await res.json();if(count===50)assert.equal(data.flat.length,50);
 cases.push({count,status:res.status,durationMs:Date.now()-start,defectReproduced:count===5000,privateNoStore:res.headers.get('cache-control')==='private, no-store'});
}
const report={checkedAt:new Date().toISOString(),defectsReproduced:1,cases,sourceHashes:Object.fromEntries([file,__filename].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual current HR departments GET and private-response helper with synthetic scoped Prisma rows. A valid5000-department acyclic chain produces500 before clients can read the flat list. Current settings/new/edit employee screens all call this GET. No DB write, production occurrence, realDB capacity or browser claim. Recursive buildTree/JSON serialization path requires repair; no arbitrary valid hierarchy depth cap should be introduced.'};fs.writeFileSync(__dirname+'/hr-department-deep-read-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
