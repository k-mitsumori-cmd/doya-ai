const assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
function fixture(service,status,options={}){
 const stats={ai:0,writes:0,scoreWrites:0};
 const session={id:'s',status,startedAt:new Date(),endedAt:new Date(),updatedAt:new Date(Date.now()-1000),purgeAfter:new Date(Date.now()+86400000),turns:[{text:'Synthetic',speaker:'candidate'}],organization:{id:'o'},template:{criteria:[],questions:[]},room:{scenario:{product:{name:'Synthetic'}}},...options};
 const db={
  mensetsuSession:{findUnique:async()=>({...session}),updateMany:async({where,data})=>{if(where.status&&where.status!==session.status)return{count:0};if(where.updatedAt&&where.updatedAt.getTime()!==session.updatedAt.getTime())return{count:0};Object.assign(session,data,{updatedAt:data.updatedAt||new Date()});stats.writes++;return{count:1}}},
  mensetsuScore:{deleteMany:async()=>{stats.scoreWrites++},createMany:async()=>{stats.scoreWrites++}},
  mensetsuAnswerSample:{findMany:async()=>[]},
  mensetsuTurn:{findMany:async()=>session.turns.map(turn=>({...turn}))},
  aishodanSession:{findFirst:async()=>session,update:async()=>{stats.writes++}},
  aishodanTurn:{findMany:async()=>session.turns},aishodanSlotValue:{findMany:async()=>[]},aishodanQuestion:{findMany:async()=>[]},
  aishodanOutcome:{upsert:async()=>{stats.writes++;return{id:'outcome'}}},
  $transaction:async tasks=>typeof tasks==='function'?tasks(db):Promise.all(tasks),
 };
 const evaluateSession=async()=>{stats.ai++;if(options.aiFails)throw Error('synthetic provider failure');return{scores:[],verdict:'hold',summary:{}}};
 const mocks={'@/lib/prisma':{prisma:db},'./evaluate':{evaluateSession},'./types':{LEVEL_LABELS:{},EVALUATION_STALE_MS:360000},'next/server':{NextResponse:Response},'@/lib/aishodan/access':{getAishodanContext:async()=>({role:'manager',organizationId:'o'}),hasMinRole:()=>true,orgSlugFrom:()=> 'o'},'@/lib/aishodan/public':{toScenarioConfig:()=>({})},'@/lib/aishodan/evaluate':{evaluateSession}};
 const api=load(service==='mensetsu'?'src/lib/mensetsu/run-evaluation.ts':'src/app/api/aishodan/sessions/[id]/re-evaluate/route.ts',mocks);
 return {stats,session,run:async()=>service==='mensetsu'?api.runEvaluation('s'):api.POST({json:async()=>({})},{params:Promise.resolve({id:'s'})})};
}
(async()=>{
 for(const service of ['mensetsu','aishodan']){
  for(const status of ['pending','consented','live','aborted','expired','unknown'])await check(service+' rejects '+status,async()=>{const f=fixture(service,status);const r=await f.run();assert.equal(r.status,409);assert.equal(f.stats.ai,0);assert.equal(f.stats.writes,0)});
  for(const status of ['completed','evaluated'])for(const ended of [true,false])await check(service+' '+status+' ended='+ended,async()=>{const f=fixture(service,status,{endedAt:ended?new Date():null});const r=await f.run();if(ended){assert.equal(service==='mensetsu'?r.ok:r.status===200,true);assert.equal(f.stats.ai,1);assert.ok(f.stats.writes>0)}else{assert.equal(r.status,409);assert.equal(f.stats.ai,0);assert.equal(f.stats.writes,0)}});
  await check(service+' unstarted cannot evaluate',async()=>{const f=fixture(service,'completed',{startedAt:null});const r=await f.run();assert.ok(r.status>=400);assert.equal(f.stats.ai,0);assert.equal(f.stats.writes,0)});
  await check(service+' empty transcript cannot evaluate',async()=>{const f=fixture(service,'completed',{turns:[]});const r=await f.run();assert.equal(r.status,400);assert.equal(f.stats.ai,0);assert.equal(f.stats.writes,0)});
  await check(service+' provider failure preserves state',async()=>{const f=fixture(service,'completed',{aiFails:true});if(service==='mensetsu')await assert.rejects(f.run());else assert.equal((await f.run()).status,502);assert.equal(f.stats.ai,1);assert.equal(f.stats.scoreWrites,0);if(service==='mensetsu')assert.equal(f.session.status,'completed')});
 }
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
