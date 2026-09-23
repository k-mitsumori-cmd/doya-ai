const assert=require('node:assert/strict'),{z}=require('zod');const {load,check,results}=require('./load-typescript.cjs');
(async()=>{
for(const identity of ['owner','other','guest','other-guest','anonymous'])for(const kind of ['user','guest'])await check(identity+' saves '+kind,async()=>{
const row={id:'article',userId:kind==='user'?'u':null,guestId:'g'};let writes=0;const matches=w=>Object.entries(w).every(([k,v])=>row[k]===v);
const api=load('src/app/api/seo/articles/[id]/content/route.ts',{'next/server':{NextResponse:Response},zod:{z},'next-auth':{getServerSession:async()=>['owner','other'].includes(identity)?{user:{id:identity==='owner'?'u':'x'}}:null},'@/lib/auth':{},'@/lib/seoAccess':{getGuestIdFromRequest:()=>identity==='guest'?'g':identity==='other-guest'?'x':null},'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},'@/lib/prisma':{prisma:{seoArticle:{findFirst:async({where})=>matches(where)?row:null,update:async({where,data})=>{assert.ok(matches(where));writes++;return{...row,...data}}}}}});
const res=await api.POST({json:async()=>({finalMarkdown:'Updated',normalize:true})},{params:Promise.resolve({id:'article'})});const allowed=identity==='owner'&&kind==='user'||identity==='guest'&&kind==='guest';assert.equal(res.status,allowed?200:identity==='anonymous'?401:404);assert.equal(writes,allowed?1:0);if(allowed)assert.equal((await res.json()).article.finalMarkdown,'Updated\n');
});console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
