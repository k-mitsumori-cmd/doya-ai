const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
function fixture(action,identity,kind,fail){
 const article={id:'a',userId:kind==='user'?'u':null,guestId:'g'},job={id:'j',articleId:'a',status:'queued',updatedAt:new Date('2026-01-01')},calls=[];
 const matches=w=>Object.entries(w).every(([k,v])=>article[k]===v);
 const owner=load('src/lib/seoArticleOwner.ts',{'next-auth':{getServerSession:async()=>['owner','other'].includes(identity)?{user:{id:identity==='owner'?'u':'x'}}:null},'@/lib/auth':{},'@/lib/seoAccess':{getGuestIdFromRequest:()=>identity==='guest'?'g':identity==='other-guest'?'x':null}});
 const prisma={seoJob:{findFirst:async({where})=>matches(where.article)?job:null,update:async({where})=>{assert.ok(matches(where.article));calls.push('job');if(fail)throw Object.assign(new Error('changed'),{code:'P2025'});return job}},seoArticle:{update:async({where})=>{assert.ok(matches(where));calls.push('article');return article}},seoSection:{deleteMany:async()=>{assert.equal(calls[0],'article');calls.push('sections');return{count:1}}}};
 prisma.$transaction=async fn=>{try{const value=await fn(prisma);calls.push('commit');return value}catch(e){calls.push('rollback');throw e}};
 const api=load('src/app/api/seo/jobs/[id]/'+action+'/route.ts',{'@seo/lib/job-response':load('seo/lib/job-response.ts'),'next/server':{NextResponse:Response},'@/lib/seoArticleOwner':owner,'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},'@/lib/prisma':{prisma},'@seo/lib/pipeline':{advanceSeoJob:async()=>calls.push('advance')}});return{api,calls};
}
(async()=>{
 for(const action of ['advance','pause','resume','cancel','reset'])for(const identity of ['owner','other','guest','other-guest','anonymous'])for(const kind of ['user','guest'])await check(action+' '+identity+' '+kind,async()=>{const f=fixture(action,identity,kind),r=await f.api.POST({},{params:Promise.resolve({id:'j'})});const allowed=identity==='owner'&&kind==='user'||identity==='guest'&&kind==='guest';assert.equal(r.status,allowed?200:identity==='anonymous'?401:404);assert.equal(f.calls.length>0,allowed)});
 for(const action of ['pause','resume','cancel','reset'])await check(action+' changed job rejects operation',async()=>{const f=fixture(action,'owner','user',true),r=await f.api.POST({},{params:Promise.resolve({id:'j'})});assert.equal(r.status,409);assert.ok(!f.calls.includes('commit'));if(['cancel','reset'].includes(action))assert.ok(f.calls.includes('rollback'))});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
