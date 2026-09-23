const assert=require('node:assert/strict'),{z}=require('zod');const {load,check,results}=require('./load-typescript.cjs');
function fixture(identity='owner',kind='user',failure){
 const row={id:'a',userId:kind==='user'?'u':null,guestId:'g',updatedAt:new Date('2026-01-01'),comparisonCandidates:[{name:'Existing'}],mode:'comparison_research'},calls=[];
 const owner=load('src/lib/seoArticleOwner.ts',{'next-auth':{getServerSession:async()=>['owner','other'].includes(identity)?{user:{id:identity==='owner'?'u':'x'}}:null},'@/lib/auth':{},'@/lib/seoAccess':{getGuestIdFromRequest:()=>identity==='guest'?'g':identity==='other-guest'?'x':null}});
 const matches=w=>Object.entries(w).every(([k,v])=>row[k]===v);
 const model={findFirst:async({where})=>matches(where)?row:null,update:async({where,data})=>{calls.push('update');assert.ok(matches(where));assert.equal(where.updatedAt,row.updatedAt);assert.ok(data.updatedAt>row.updatedAt);if(failure==='conflict')throw Object.assign(new Error('stale'),{code:'P2025'});return{...row,...data}}};
 const prisma={seoArticle:model,seoJob:{updateMany:async()=>({count:0}),create:async()=>{calls.push('job');if(failure==='job')throw new Error('job failure');return{id:'j'}}}};
 prisma.$transaction=async fn=>{try{const result=await fn(prisma);calls.push('commit');return result}catch(e){calls.push('rollback');throw e}};
 const api=load('src/app/api/seo/articles/[id]/candidates/route.ts',{'next/server':{NextResponse:Response},zod:{z},'@/lib/seoArticleOwner':owner,'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},'@/lib/prisma':{prisma}});return{api,calls};
}
const ctx={params:Promise.resolve({id:'a'})},request=body=>({json:async()=>body});
(async()=>{
 for(const method of ['GET','POST','DELETE'])for(const identity of ['owner','other','guest','other-guest','anonymous'])for(const kind of ['user','guest'])await check(method+' '+identity+' '+kind,async()=>{const f=fixture(identity,kind),r=await f.api[method](request(method==='DELETE'?{candidateName:'Existing'}:{candidates:[{name:'New'}]}),ctx);const allowed=identity==='owner'&&kind==='user'||identity==='guest'&&kind==='guest';assert.equal(r.status,allowed?200:identity==='anonymous'?401:404);if(!allowed)assert.equal(f.calls.length,0);if(method==='GET')assert.equal((await r.text()).includes('Existing'),allowed)});
 for(const method of ['POST','DELETE'])await check(method+' concurrent change rejects stale write',async()=>{const f=fixture('owner','user','conflict'),r=await f.api[method](request(method==='DELETE'?{candidateName:'Existing'}:{candidates:[{name:'New'}],regenerate:true}),ctx);assert.equal(r.status,409);assert.ok(!f.calls.includes('job'));assert.ok(!f.calls.includes('commit'))});
 await check('job failure propagates out of shared transaction',async()=>{const f=fixture('owner','user','job'),r=await f.api.POST(request({candidates:[{name:'New'}],regenerate:true}),ctx);assert.equal(r.status,500);assert.ok(f.calls.includes('rollback'));assert.ok(!f.calls.includes('commit'))});
 await check('duplicate candidate count reflects actual additions',async()=>{const f=fixture(),r=await f.api.POST(request({candidates:[{name:' existing '},{name:'New'},{name:'new'}]}),ctx);assert.equal(r.status,200);const b=await r.json();assert.equal(b.addedCount,1);assert.equal(b.count,2)});
 for(const method of ['POST','DELETE'])await check(method+' blank name rejected',async()=>{const f=fixture(),r=await f.api[method](request(method==='DELETE'?{candidateName:'   '}:{candidates:[{name:'   '}]}),ctx);assert.equal(r.status,400);assert.equal(f.calls.length,0)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
