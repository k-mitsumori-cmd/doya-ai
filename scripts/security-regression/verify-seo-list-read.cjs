const assert = require('node:assert/strict');
const {load, check, results} = require('./load-typescript.cjs');
function fixture(userId, guestId, fail=false) {
  const rows=[
    {id:'own-old',userId:'u',guestId:'g',createdAt:new Date('2020-01-01'),jobs:[{id:'j',executionToken:'PRIVATE',executionExpiresAt:new Date()}]},
    {id:'guest',userId:null,guestId:'g',createdAt:new Date(),jobs:[]},
    {id:'other',userId:'other',guestId:null,createdAt:new Date(),jobs:[]},
  ];
  let writes=0, where, cookie=0;
  const api=load('src/app/api/seo/articles/route.ts', {
    '@/lib/admin-guard':{requireAdmin:async()=>{throw Error('list must not call admin guard')}},'@prisma/client':{Prisma:{TransactionIsolationLevel:{RepeatableRead:'RepeatableRead'}}},
    '@/lib/seo-article-list':{parseSeoListQuery:()=>({}),readSeoArticleList:async(tx,owner)=>{const rows=await tx.seoArticle.findMany({where:owner});return{articles:rows.map(row=>({...row,jobs:row.jobs.map(load('seo/lib/job-response.ts').publicSeoJob)})),nextCursor:null,counts:{total:rows.length},matched:rows.length}}},
    'next/server':{NextResponse:Response},
    'next-auth':{getServerSession:async()=>userId?{user:{id:userId}}:null},
    '@/lib/auth':{}, '@seo/lib/types':{},
    '@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},
    '@/lib/seoAccess':{getGuestIdFromRequest:()=>guestId,ensureGuestId:()=> 'new-guest',setGuestCookie:()=>cookie++},
    '@/lib/pricing':{}, '@/lib/service-usage':{},
    '@/lib/prisma':{prisma:{$transaction:async function(fn){return fn(this)},seoArticle:{
      deleteMany:async()=>{writes++;throw Error('GET must never delete')},
      findMany:async args=>{where=args.where;if(fail)throw Error('synthetic outage');return rows.filter(row=>Object.entries(where).every(([k,v])=>row[k]===v))},
    }}},
  });
  return {api,get writes(){return writes},get where(){return where},get cookie(){return cookie}};
}
(async()=>{
  await check('search cursor validates query binding, dates and user input limits',()=>{
    const {parseSeoListQuery}=load('src/lib/seo-article-list.ts',{'@prisma/client':{Prisma:{}}});
    const valid={v:1,id:'row',at:'2026-09-20T00:00:00.123Z',q:'日本語',status:'DONE'};
    const encoded=data=>Buffer.from(JSON.stringify(data)).toString('base64url');
    const parsed=parseSeoListQuery(new URLSearchParams({q:' 日本語 ',status:'DONE',cursor:encoded(valid)}));
    assert.equal(parsed.cursor.id,'row');assert.equal(parsed.cursor.at.toISOString(),valid.at);
    for(const params of [{q:'x'.repeat(201)},{status:'unknown'},{cursor:''},{cursor:'!'}, {q:'different',status:'DONE',cursor:encoded(valid)}, {q:'日本語',status:'DONE',cursor:encoded({...valid,at:'2026-09-20'})}])assert.throws(()=>parseSeoListQuery(new URLSearchParams(params)));
  });
  for(const [name,userId,guestId,expected] of [
    ['signed-in owner','u','g',['own-old']],
    ['guest cannot see transferred article',null,'g',['guest']],
    ['other user','other','g',['other']],
    ['unknown user','x','g',[]],
    ['other guest',null,'x',[]],
    ['anonymous',null,null,[]],
  ]) await check(name,async()=>{
    const f=fixture(userId,guestId),res=await f.api.GET({url:'http://local/api/seo/articles'}),body=await res.json();
    assert.equal(res.status,200);assert.deepEqual(body.articles.map(x=>x.id),expected);
    assert.equal(f.writes,0);assert.equal(JSON.stringify(body).includes('PRIVATE'),false);
    assert.equal(f.cookie,!userId&&!guestId?1:0);
    if(f.where)assert.equal('createdAt' in f.where,false);
  });
  await check('database failure is not an empty successful list',async()=>{
    const f=fixture('u',null,true),res=await f.api.GET({url:'http://local/api/seo/articles'});assert.equal(res.status,500);assert.equal((await res.json()).success,false);assert.equal(f.writes,0);
  });
  console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
