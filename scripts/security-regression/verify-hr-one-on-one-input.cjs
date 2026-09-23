const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
(async()=>{
 for(const body of [null,[],{date:'invalid'},{date:'2026-09-20T10:00'},{duration:0},{duration:1.5},{duration:1441},{managerNote:123},{actionItems:'bad'},{managerNote:'a',managerNotes:'b'}])await check('reject invalid 1on1 payload '+JSON.stringify(body),async()=>{
  let writes=0;
  const api=load('src/app/api/hr/one-on-one/[id]/route.ts',{
   'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},
   '@/lib/hr/one-on-one-access':{canAccessOneOnOne:async()=>true,getOneOnOneViewer:async()=>({employeeId:null}),canViewManagerNotes:()=>true,filterOneOnOneFields:r=>({...r,canViewManagerNotes:true})},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'o'})},
   '@/lib/prisma':{prisma:{hrOneOnOne:{findFirst:async()=>({id:'one'}),update:async()=>{writes++;return{}}}}},
  });
  const response=await api.PATCH({json:async()=>body},{params:Promise.resolve({id:'one'})});assert.equal(response.status,400);assert.equal(writes,0);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
