const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const rows=new Map(),locks=new Map();let failWrite=false;
async function findUnique({where}){return rows.has(where.key)?{value:rows.get(where.key)}:null}
const prisma={systemSetting:{findUnique},$transaction:async fn=>{
 let unlock;
 const tx={systemSetting:{findUnique,upsert:async({where,create,update})=>{if(failWrite)throw Error('Synthetic write failure');await new Promise(setImmediate);rows.set(where.key,rows.has(where.key)?update.value:create.value)}},$executeRaw:async(_sql,key)=>{
  const previous=locks.get(key)||Promise.resolve();const held=new Promise(resolve=>{unlock=resolve});locks.set(key,previous.then(()=>held));await previous;
 }};
 try{return await fn(tx)}finally{unlock?.()}
}};
const budget=load('src/lib/system-watch/budget.ts',{'@/lib/prisma':{prisma}});
const forbidden=()=>{throw Error('No providers or agents')};
const paid=load('src/lib/system-watch/paid-run.ts',{'@/lib/prisma':{prisma},'./budget':budget,'./paid-checks':{paidChecks:forbidden,PAID_ENABLED_KEY:'unused'},'./agent-checks':{paidAgentChecks:forbidden,PAID_AGENT_ENABLED_KEY:'unused'}});
const day='2026-10-28',key='watch:v1:paid-spend:'+day;let callbacks=0,passed=0;
const deps={reserveSpend:(id,fee)=>budget.reserveSpend(id,fee,day),addSpend:budget.addSpend};
const wrap=(id,run=async()=>{callbacks++;return{ok:true}})=>paid.wrapWithDailyCap([{id,area:'外部サービス',label:'Synthetic',severity:'action',threshold:1,hints:[],costYen:1.8,run}],deps).checks[0];
function setup(value){rows.clear();locks.clear();callbacks=0;failWrite=false;if(value!==undefined)rows.set(key,typeof value==='string'?value:JSON.stringify(value))}
(async()=>{
 setup({yen:7,runs:[]});await Promise.all([wrap('request-a').run(),wrap('request-b').run()]);assert.equal(callbacks,1);assert.equal((await budget.readSpend(day)).yen,8.8);passed++;
 setup();await Promise.all(Array.from({length:10},(_,i)=>wrap('independent-'+i).run()));assert.equal(callbacks,5);assert.equal((await budget.readSpend(day)).yen,9);assert.equal((await budget.readSpend(day)).runs.length,5);passed++;
 setup({yen:0,runs:[]});await wrap('skipped',async()=>({ok:true,skipped:true})).run();assert.equal((await budget.readSpend(day)).yen,0);assert.equal(rows.size,1);passed++;
 setup({yen:0,runs:[]});await wrap('failed',async()=>({ok:false})).run();assert.equal((await budget.readSpend(day)).yen,1.8);passed++;
 setup({yen:0,runs:[]});failWrite=true;const out=await wrap('no-write').run();assert.equal(out.skipped,true);assert.equal(callbacks,0);assert.equal((await budget.readSpend(day)).yen,0);passed++;
 for(const raw of ['not-json',JSON.stringify({yen:'7',runs:[]}),JSON.stringify({yen:-1,runs:[]}),JSON.stringify({yen:7,runs:[null]})]){
  setup(raw);const result=await wrap('invalid-state').run();assert.equal(result.skipped,true);assert.equal(callbacks,0);assert.equal(rows.get(key),raw);passed++;
 }
 setup({yen:0,runs:[]});for(const fee of [0,-1,NaN,Infinity])await assert.rejects(budget.reserveSpend('invalid-cost',fee,day));assert.equal((await budget.readSpend(day)).yen,0);passed++;
 console.log(JSON.stringify({passed,scope:'Actual budget/paid-run modules with synthetic transactional DB and lock scheduling. Independent request wrappers, failed writes, refunds and malformed state. Native PostgreSQL proof is separate. No external calls.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
