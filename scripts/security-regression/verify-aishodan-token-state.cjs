const assert=require('node:assert/strict');const{load,check,results}=require('./load-typescript.cjs');
function fixture(options={}){
 const row={id:'s',organizationId:'o',roomId:'r',guestId:'g',status:'pending',startedAt:null,endedAt:null,consentedAt:new Date(),tokenIssueCount:0,room:{isActive:true,organization:{name:'Synthetic',retentionDays:30},scenario:{product:{id:'p',name:'Synthetic'}}},...options.row};
 let fetches=0,starts=0,reservations=0,reads=0;
 function matches(where){return Object.entries(where).every(([k,v])=>v&&typeof v==='object'?('in'in v?v.in.includes(row[k]):'not'in v?row[k]!==v.not:'lt'in v?row[k]<v.lt:false):row[k]===v)}
 const prisma={aishodanSession:{findFirst:async()=>{reads++;return options.missingAfter&&reads>1?null:{...row,room:{...row.room}}},updateMany:async({where,data})=>{if(options.beforeReserve&&data.tokenIssueCount)options.beforeReserve(row);if(!matches(where))return{count:0};if(data.tokenIssueCount){row.tokenIssueCount++;reservations++}else{Object.assign(row,data);starts++}return{count:1}}}};
 const session=load('src/lib/aishodan/session.ts',{'@/lib/prisma':{prisma}});
 const api=load('src/app/api/aishodan/room/[token]/token/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/aishodan/session':session,'@/lib/aishodan/public':{toScenarioConfig:()=>({durationMin:10})},'@/lib/aishodan/engine':{buildSalesInstructions:()=> 'Synthetic'},'@/lib/aishodan/knowledge':{retrieve:async()=>[]}}, {process:{env:{OPENAI_API_KEY:'synthetic-test-key'}},fetch:async()=>{fetches++;options.duringFetch?.(row);return Response.json({value:'SYNTHETIC_SECRET',expires_at:1})}});
 return{row,get stats(){return{fetches,starts,reservations}},run:()=>api.POST({json:async()=>({sessionId:'s'}),cookies:{get:()=>({value:'g'})}},{params:Promise.resolve({token:'t'})})};
}
(async()=>{
 await check('initial connection starts once',async()=>{const f=fixture();assert.equal((await f.run()).status,200);assert.equal(f.row.status,'live');assert.deepEqual(f.stats,{fetches:1,starts:1,reservations:1})});
 await check('reconnect preserves start time',async()=>{const startedAt=new Date();const f=fixture({row:{status:'live',startedAt}});assert.equal((await f.run()).status,200);assert.equal(f.row.startedAt,startedAt);assert.equal(f.stats.starts,0)});
 await check('late first connection preserves another connection start time',async()=>{const startedAt=new Date();const f=fixture({duringFetch:row=>Object.assign(row,{status:'live',startedAt})});assert.equal((await f.run()).status,200);assert.equal(f.row.startedAt,startedAt);assert.equal(f.stats.starts,0)});
 for(const status of ['completed','evaluated','aborted','expired'])await check('end while token pending '+status,async()=>{const f=fixture({duringFetch:row=>Object.assign(row,{status,startedAt:new Date(),endedAt:new Date()})});const res=await f.run();assert.equal(res.status,410);assert.equal((await res.text()).includes('SYNTHETIC_SECRET'),false);assert.equal(f.row.status,status);assert.equal(f.stats.starts,0)});
 await check('ended timestamp wins over stale live status',async()=>{const f=fixture({row:{status:'live',startedAt:new Date(),endedAt:new Date()}});assert.equal((await f.run()).status,410);assert.equal(f.stats.fetches,0)});
 await check('end before reservation avoids provider call',async()=>{const f=fixture({beforeReserve:row=>Object.assign(row,{status:'completed',endedAt:new Date()})});assert.equal((await f.run()).status,410);assert.equal(f.stats.fetches,0)});
 for(const [name,mutate,status] of [['consent revoked',r=>r.consentedAt=null,403],['room disabled',r=>r.room.isActive=false,410],['room expires',r=>r.room.expiresAt=new Date(0),410]])await check(name+' while pending suppresses secret',async()=>{const f=fixture({duringFetch:mutate});const res=await f.run();assert.equal(res.status,status);assert.equal((await res.text()).includes('SYNTHETIC_SECRET'),false)});
 await check('quota remains 429 for active session',async()=>{const f=fixture({row:{tokenIssueCount:12}});assert.equal((await f.run()).status,429);assert.equal(f.stats.fetches,0)});
 await check('removed session suppresses secret',async()=>{const f=fixture({missingAfter:true});assert.equal((await f.run()).status,404)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
