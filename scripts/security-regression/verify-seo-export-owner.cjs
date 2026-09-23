const assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
(async()=>{
for(const format of ['html','json','markdown','note','txt'])for(const identity of ['owner','other','guest','other-guest','anonymous'])for(const kind of ['user','guest'])await check(format+' '+identity+' '+kind,async()=>{
 const row={id:'article',userId:kind==='user'?'u':null,guestId:'g',title:'Title',finalMarkdown:'SECRET_ARTICLE',outline:'outline'};let reads=0;
 const owner=load('src/lib/seoArticleOwner.ts',{'next-auth':{getServerSession:async()=>['owner','other'].includes(identity)?{user:{id:identity==='owner'?'u':'x'}}:null},'@/lib/auth':{},'@/lib/seoAccess':{getGuestIdFromRequest:()=>identity==='guest'?'g':identity==='other-guest'?'x':null}});
 const api=load('src/app/api/seo/articles/[id]/export/'+format+'/route.ts',{'next/server':{NextResponse:Response},'@/lib/seoArticleOwner':owner,'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}},'@seo/lib/markdown':{markdownToHtmlBasic:s=>'<p>'+s+'</p>'},'@/lib/prisma':{prisma:{seoArticle:{findFirst:async({where})=>{reads++;return Object.entries(where).every(([k,v])=>row[k]===v)?row:null}}}}});
 const res=await api.GET({},{params:Promise.resolve({id:'article'})});const allowed=identity==='owner'&&kind==='user'||identity==='guest'&&kind==='guest';assert.equal(res.status,allowed?200:identity==='anonymous'?401:404);assert.equal((await res.text()).includes('SECRET_ARTICLE'),allowed);if(identity==='anonymous')assert.equal(reads,0);if(allowed)assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
});console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
