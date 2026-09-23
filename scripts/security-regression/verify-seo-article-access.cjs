const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
function fixture(identity,kind,failChild=false){
 const row={id:'article',userId:kind==='user'?'u':null,guestId:'g',finalMarkdown:'SECRET_ARTICLE',jobs:[{id:'j',executionToken:'PRIVATE_EXECUTION'}]},calls=[];
 const owner=load('src/lib/seoArticleOwner.ts',{'next-auth':{getServerSession:async()=>['owner','other'].includes(identity)?{user:{id:identity==='owner'?'u':'x'}}:null},'@/lib/auth':{},'@/lib/seoAccess':{getGuestIdFromRequest:()=>identity==='guest'?'g':identity==='other-guest'?'x':null}});
 const matches=w=>Object.entries(w).every(([k,v])=>row[k]===v);
 const tx={seoArticle:{update:async({where})=>{calls.push('lock');if(!matches(where))throw Object.assign(new Error('missing'),{code:'P2025'});return row},delete:async({where})=>{assert.ok(matches(where));calls.push('delete');return row}}};
 for(const name of ['seoJob','seoSection','seoReference','seoAuditReport','seoUserMemo','seoImage','seoLinkCheckResult','seoKnowledgeItem'])tx[name]={deleteMany:async()=>{assert.equal(calls[0],'lock');calls.push(name);if(failChild&&name==='seoImage')throw new Error('storage failure');return{count:1}}};
 const api=load('src/app/api/seo/articles/[id]/route.ts',{'@seo/lib/job-response':load('seo/lib/job-response.ts'),'next/server':{NextResponse:Response},'@/lib/seoArticleOwner':owner,'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},'@/lib/prisma':{prisma:{seoArticle:{findFirst:async({where})=>matches(where)?row:null},$transaction:async fn=>fn(tx)}}});return{api,calls};
}
(async()=>{
 for(const method of ['GET','DELETE'])for(const identity of ['owner','other','guest','other-guest','anonymous'])for(const kind of ['user','guest'])await check(method+' '+identity+' '+kind,async()=>{const f=fixture(identity,kind),res=await f.api[method]({},{params:Promise.resolve({id:'article'})});const allowed=identity==='owner'&&kind==='user'||identity==='guest'&&kind==='guest';assert.equal(res.status,allowed?200:identity==='anonymous'?401:404);const body=await res.text();assert.equal(body.includes('PRIVATE_EXECUTION'),false);if(method==='GET')assert.equal(body.includes('SECRET_ARTICLE'),allowed);else assert.equal(f.calls.includes('delete'),allowed);if(!allowed)assert.ok(!f.calls.includes('seoJob'));});
 await check('child failure stops deletion and returns failure',async()=>{const f=fixture('owner','user',true),res=await f.api.DELETE({},{params:Promise.resolve({id:'article'})});assert.equal(res.status,500);assert.ok(!f.calls.includes('delete'));assert.equal((await res.json()).success,false)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
