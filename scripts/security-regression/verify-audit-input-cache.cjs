const assert=require('node:assert/strict');
const {load,check}=require('./load-typescript.cjs');
(async()=>{
 const next={'next/server':{NextResponse:Response}};
 const json=load('src/lib/private-api-response.ts',next).privateApiJson;
 await check('private JSON overrides browser cache and preserves Vary, status and payload',async()=>{
  const r=json({ok:true},{status:201,headers:{'Cache-Control':'public,max-age=60',Vary:'RSC'}});
  assert.equal(r.status,201);assert.deepEqual(await r.json(),{ok:true});assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/RSC/);assert.match(r.headers.get('vary'),/Cookie/);
 });
 let actor='a';const db={generation:{findMany:async({where})=>where.userId==='a'?[{id:'private-a'}]:[]}};
 const history=load('src/app/api/banner/history/route.ts',{...next,'next-auth':{getServerSession:async()=>actor?{user:{id:actor}}:null},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},sharp:()=>{throw Error('No image decoding in metadata fixture')},'@/lib/banner/history-cursor':{},'@/lib/banner/history-access':{bannerHistoryCutoff:async()=>new Date(0)},'@/lib/banner/legacy-history':{}});
 for(const who of ['a','b',null])await check('banner batch response is uncached for actor '+who,async()=>{
  actor=who;const r=await history.GET({url:'https://example.invalid/api/banner/history?batchId=batch'});
  assert.equal(r.status,who?200:401);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/);
  if(who)assert.equal((await r.json()).bannerIds.length,who==='a'?1:0);
 });
 let writes=0;
 const fix=load('src/app/api/seo/articles/[id]/autofix/route.ts',{...next,zod:require('zod'),'@/lib/prisma':{prisma:{seoArticle:{findFirst:async()=>({finalMarkdown:'# Synthetic\n\nbody'}),update:async()=>{writes++}}}},'@/lib/seoArticleOwner':{getSeoArticleOwner:async()=>({userId:'a'})},'@seo/lib/bootstrap':{ensureSeoSchema:async()=>{}}});
 for(const [name,body]of [['empty',{}],['null',null],['enum',{fix:'INVALID'}]])await check('autofix client input '+name+' returns 400 without write',async()=>{
  const r=await fix.POST({json:async()=>body},{params:Promise.resolve({id:'x'})});assert.equal(r.status,400);assert.equal(writes,0);
 });
 await check('autofix malformed JSON returns 400',async()=>{const r=await fix.POST({json:async()=>{throw SyntaxError()}},{params:Promise.resolve({id:'x'})});assert.equal(r.status,400);assert.equal(writes,0)});
 await check('autofix valid owner request saves once',async()=>{const r=await fix.POST({json:async()=>({fix:'ADD_TLDR'})},{params:Promise.resolve({id:'x'})});assert.equal(r.status,200);assert.equal(writes,1)});
 const logo=load('src/app/api/doyaslide/assets/logo/route.ts',{...next,'@/lib/prisma':{prisma:{}},'@/lib/doyaslide/project-lock':{},'@/lib/doyaslide/access':{getUserId:async()=>'a'},'@/lib/doyaslide/storage':{uploadLogo:()=>{throw Error('Unexpected upload')}},sharp:()=>{throw Error('Unexpected image')}},{File:globalThis.File});
 await check('logo malformed form returns 400 without storage',async()=>{const r=await logo.POST({formData:async()=>{throw TypeError('Invalid form')}});assert.equal(r.status,400)});
 const access=load('src/lib/income/access.ts', {...next,crypto:require('node:crypto'),'next-auth':{getServerSession:async()=>null},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{}},'./roles':load('src/lib/income/roles.ts')});
 const cases=[['unauthorized',()=>access.unauthorized(),401],['forbidden',()=>access.forbidden(),403],['bad request',()=>access.badRequest('bad input'),400],['not found',()=>access.notFound(),404],['domain error',()=>access.errorResponse(new access.IncomeError('bad input')),400],['write conflict',()=>access.errorResponse({code:'P2034'}),409],['duplicate',()=>access.errorResponse({code:'P2002'}),409],['exception',()=>access.errorResponse(Error('SYNTHETIC_PRIVATE_MARKER')),500]];
 for(const [label,make,status]of cases)await check('income '+label+' keeps status and private headers',async()=>{const r=make();assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/);assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER'))});
 let session=null;
 const income=load('src/lib/income/route.ts',{'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'./access':{...access,getIncomeContext:async()=>null}});
 for(const who of ['guest','missing-org'])await check('withIncome '+who+' early exit is private',async()=>{session=who==='guest'?null:{user:{id:'a'}};const r=await income.withIncome({},'member',async()=>{throw Error('Handler must not run')});assert.equal(r.status,who==='guest'?401:403);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/)});
 console.log('Audit input/cache regression passed');
})().catch(e=>{console.error(e);process.exitCode=1});
