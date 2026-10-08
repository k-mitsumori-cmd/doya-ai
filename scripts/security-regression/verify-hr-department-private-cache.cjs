const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {load}=require('./load-typescript.cjs');
const privateApiResponse=load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}});
const file='src/app/api/hr/departments/route.ts',cases=[];
(async()=>{
 for(const mode of ['allowed','denied','failure']){
  let reads=0;const queries=[];
  const context=async()=>{if(mode==='failure')throw Error('SYNTHETIC_PRIVATE_ERROR');return mode==='denied'?null:{organizationId:'synthetic-org',userId:'synthetic-user',role:'MEMBER'}};
  const api=load(file,{'@/lib/private-api-response':privateApiResponse,'next/server':{NextResponse:Response},'next-auth':{},'@/lib/auth':{},'@/lib/department-integrity':{},'@/lib/hr/access':{getHrContext:context,hasMinRole:()=>false},'@/lib/prisma':{prisma:{hrDepartment:{findMany:async q=>{reads++;queries.push(q);return [{id:'synthetic-dept',name:'SYNTHETIC_PRIVATE_DEPARTMENT',parentId:null,managerId:null,code:null,sortOrder:0,isActive:true,_count:{employees:2}}]}}}}});
  const r=await api.GET(),body=await r.json();assert.equal(r.status,mode==='allowed'?200:mode==='denied'?401:500);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_PRIVATE_ERROR'));
  if(mode==='allowed'){assert.equal(reads,1);assert.equal(queries[0].where.organizationId,'synthetic-org');assert.equal(body.departments[0].name,'SYNTHETIC_PRIVATE_DEPARTMENT');assert.equal(body.flat[0].employeeCount,2)}else assert.equal(reads,0);
  const cache=r.headers.get('cache-control')||'',vary=r.headers.get('vary')||'';
  cases.push({mode,behaviorPassed:true,cacheControl:cache,vary,privateNoStore:cache.split(',').some(v=>v.trim().toLowerCase()==='private')&&cache.split(',').some(v=>v.trim().toLowerCase()==='no-store')&&vary.split(',').some(v=>v.trim().toLowerCase()==='cookie')});
 }
 const report={checkedAt:new Date().toISOString(),source:file,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE?require('node:path').join(process.env.DOYA_TEST_BASELINE,file):file)).digest('hex'),expected:3,behaviorPassed:cases.length,passed:cases.filter(c=>c.privateNoStore).length,cases,scope:'Actual HR department GET with synthetic auth/DB reads. Organization-scoped read and generic errors verified. Header policy only; no real customer cache hit or exposure demonstrated. Root mandatory regression; local source behavior only, not production deployment proof.'};console.log(JSON.stringify(report));process.exitCode=report.passed===3?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
