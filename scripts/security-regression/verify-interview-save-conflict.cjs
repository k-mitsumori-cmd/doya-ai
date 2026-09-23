const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const version='2099-01-01T00:00:00.000Z';
function fixture(){
 let row={id:'draft',content:'Original',title:'Title',updatedAt:new Date(version),project:{userId:'user'},status:'DRAFT',wordCount:8},writes=0;
 const api=load('src/app/api/interview/articles/[id]/route.ts',{
  'next/server':{NextResponse:Response},
  '@/lib/interview/access':{requireDatabase:()=>null,getInterviewUser:async()=>({userId:'user'}),checkOwnership:()=>null},
  '@/lib/prisma':{prisma:{interviewDraft:{
   findUnique:async()=>structuredClone(row),
   update:async({where,data})=>{
    if(where.id!==row.id||where.updatedAt?.getTime()!==row.updatedAt.getTime())throw Object.assign(Error('Conflict'),{code:'P2025'});
    writes++;row={...row,...data};return structuredClone(row);
   },
  }}},
 });
 return {post:body=>api.PUT({json:async()=>body},{params:Promise.resolve({id:'draft'})}),state:()=>({row,writes})};
}
(async()=>{
 for(const [name,body,status]of [
  ['missing token',{content:'New'},428],['invalid token',{content:'New',expectedUpdatedAt:'invalid'},400],
  ['stale token',{content:'New',expectedUpdatedAt:'2098-01-01T00:00:00.000Z'},409],['null body',null,400],
 ])await check(name+' never writes',async()=>{const f=fixture();assert.equal((await f.post(body)).status,status);assert.equal(f.state().writes,0);assert.equal(f.state().row.content,'Original')});
 await check('sequential saves use returned version and empty content resets count',async()=>{
  const f=fixture();const first=await f.post({content:'New',expectedUpdatedAt:version});assert.equal(first.status,200);
  const next=(await first.json()).draft.updatedAt;assert.ok(new Date(next)>new Date(version));
  const second=await f.post({content:'',expectedUpdatedAt:next});assert.equal(second.status,200);assert.equal(f.state().row.wordCount,0);assert.equal(f.state().row.readingTime,0);
 });
 await check('two editors sharing a version cannot both overwrite',async()=>{
  const f=fixture();const responses=await Promise.all(['Tab A','Tab B'].map(content=>f.post({content,expectedUpdatedAt:version})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.state().writes,1);
  const winner=f.state().row.content;assert.equal((await f.post({content:'Stale retry',expectedUpdatedAt:version})).status,409);assert.equal(f.state().row.content,winner);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
