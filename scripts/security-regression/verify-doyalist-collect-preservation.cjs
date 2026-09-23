const assert = require('node:assert/strict');
const {load, check, results} = require('./load-typescript.cjs');

function fixture(initialCount, failure, denied) {
  let project = {id:'project',userId:'user',industry:'IT',region:'全国'};
  let companies = Array.from({length:initialCount},(_,i)=>({id:'old'+i,name:'Existing '+i}));
  let approaches = initialCount ? [{id:'approach',body:'Keep existing draft'}] : [];
  let mode = failure, calls = 0, writes = 0;
  const api = load('src/app/api/doyalist/collect/route.ts', {
    'next/server':{NextResponse:Response},
    'next-auth':{getServerSession:async()=>denied==='anonymous'?null:{user:{id:'user'}}},
    '@/lib/auth':{authOptions:{}},
    '@/lib/prisma':{prisma:{
      doyalistProject:{
        findUnique:async()=>project && {...project,userId:denied==='foreign'?'other':'user'},
        delete:async()=>{project=null;companies=[];approaches=[];writes++;},
      },
      doyalistCompany:{
        createMany:async({data})=>{if(mode==='save')throw Error('Synthetic write failure');writes++;companies.push(...data.map((r,i)=>({...r,id:'new'+i})));},
        findMany:async({take})=>companies.slice(-take),
      },
    }},
    '@/lib/doyalist/limits':{
      getUserDoyalistLimits:async()=>({maxCompaniesPerMonth:denied==='quota'?0:100}),
      countMonthlyCompanies:async()=>initialCount,
    },
    '@/lib/doyalist/collect':{collectCompaniesDetailed:async()=>{
      calls++;
      if(mode==='throw')throw Error('Synthetic upstream failure');
      return {apiOk:mode!=='unavailable',companies:['empty','unavailable'].includes(mode)?[]:[{companyName:'New company',source:'gbizinfo'}]};
    }},
  });
  return {
    state:()=>({project,companies,approaches,calls,writes}),
    retry:()=>{mode=null;},
    post:()=>api.POST({json:async()=>({projectId:'project',count:1})}),
  };
}
(async()=>{
  await check('empty projects remain visible for owner cleanup; foreign and archived stay excluded',async()=>{
    const rows=[
      {id:'empty',userId:'user',status:'active',name:'Empty',_count:{companies:0,approaches:0}},
      {id:'saved',userId:'user',status:'active',name:'Saved',_count:{companies:2,approaches:1}},
      {id:'foreign',userId:'other',status:'active',name:'Private',_count:{companies:0,approaches:0}},
      {id:'archived',userId:'user',status:'archived',name:'Archive',_count:{companies:0,approaches:0}},
    ];
    const api=load('src/app/api/doyalist/projects/route.ts',{
      'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'user'}})},
      '@/lib/auth':{authOptions:{}},'@/lib/doyalist/limits':{},
      '@/lib/prisma':{prisma:{doyalistProject:{findMany:async({where})=>rows.filter(r=>
        r.userId===where.userId&&r.status!==where.status.not&&(!where.companies?.some||r._count.companies>0))}}},
    });
    const response=await api.GET();assert.equal(response.status,200);
    const body=await response.json();assert.deepEqual(body.projects.map(p=>p.id),['empty','saved']);
    assert.equal(body.projects[0].companyCount,0);
  });
  for(const size of [0,2])for(const mode of ['throw','empty','unavailable','save']) {
    await check(`preserve ${size} existing companies on ${mode}, then retry`,async()=>{
      const f=fixture(size,mode), before=structuredClone(f.state());
      const response=await f.post();
      assert.equal(response.status,mode==='empty'?422:mode==='save'?500:502);
      const after=f.state();
      assert.deepEqual(after.project,before.project);
      assert.deepEqual(after.companies,before.companies);
      assert.deepEqual(after.approaches,before.approaches);
      assert.equal(after.writes,0);
      f.retry();
      const retry=await f.post();assert.equal(retry.status,200);
      assert.equal((await retry.json()).generated,1);
      assert.equal(f.state().companies.length,size+1);
      assert.deepEqual(f.state().companies.slice(0,size),before.companies);
      assert.deepEqual(f.state().approaches,before.approaches);
    });
  }
  for(const denied of ['anonymous','foreign','quota'])await check(`${denied} makes no provider or data changes`,async()=>{
    const f=fixture(2,null,denied), response=await f.post();
    assert.equal(response.status,denied==='anonymous'?401:403);
    assert.equal(f.state().calls,0);assert.equal(f.state().writes,0);
    assert.equal(f.state().companies.length,2);
  });
  console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
