const assert=require('node:assert/strict'),{load,check}=require('./load-typescript.cjs');const lib=load('src/lib/sfa/summary.ts');
const valid={totalCount:501,openCount:501,staleCount:1,openTaskCount:204,openTotal:'50100',weighted:'25050',wonTotal:'0'};
(async()=>{
await check('valid server aggregate accepted',()=>assert(lib.isSfaSummary(valid)));
for(const value of [null,{}, {...valid,openTotal:50100},{...valid,weighted:'NaN'},{...valid,openCount:-1},{...valid,openTaskCount:1.2}])await check('invalid aggregate is not rendered as zero',()=>assert.equal(lib.isSfaSummary(value),false));
await check('large currency remains exact',()=>assert.equal(lib.summaryYen('9007199254740993'),'¥9,007,199,254,740,993'));
for(const mode of ['ok','denied','failure'])await check('summary API '+mode,async()=>{let queries=0;const api=load('src/app/api/sfa/summary/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:{$queryRaw:async(strings,...values)=>{queries++;assert(values.includes('scope'));if(mode==='failure')throw Error('private db detail');return[valid]}}},'@/lib/sfa/access':{getSfaContext:async()=>mode==='denied'?null:{organizationId:'scope'},orgSlugFrom:()=> 'slug'}});const r=await api.GET(new Request('http://localhost'));assert.equal(r.status,mode==='ok'?200:mode==='denied'?401:503);assert.equal(queries,mode==='denied'?0:1);assert(!(await r.text()).includes('private db detail'))});
})().catch(e=>{console.error(e);process.exitCode=1});
