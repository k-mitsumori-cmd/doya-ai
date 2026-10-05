const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
function fixture(sessionId='session') {
 const turns=[];let tail=Promise.resolve(),failWrite=false,writes=0
 const row={id:sessionId,status:'live',consentedAt:new Date(),startedAt:new Date(),endedAt:null,evaluatedAt:null,purgeAfter:null,updatedAt:new Date()}
 const db={
  $queryRaw:async strings=>{assert.match(strings.join('?'),/FOR NO KEY UPDATE/);return [{id:sessionId}]},
  mensetsuSession:{findUnique:async()=>({...row}),update:async({data})=>{Object.assign(row,data);writes++;return {...row}}},
  mensetsuTurn:{
   findMany:async({where})=>turns.filter(t=>t.sessionId===where.sessionId&&where.id.in.includes(t.id)).map(t=>({...t})),
   findFirst:async()=>turns.length?{ord:Math.max(...turns.map(t=>t.ord))}:null,
   createMany:async({data})=>{if(failWrite)throw Error('synthetic failure');assert.equal(data.filter(t=>t.id&&turns.some(old=>old.id===t.id)).length,0);turns.push(...data.map(t=>({...t,id:t.id||`legacy-${turns.length}`})));return {count:data.length}}
  },
  $transaction:async fn=>{const previous=tail;let release;tail=new Promise(r=>release=r);await previous;const before=turns.slice(),state={...row};try{return await fn(db)}catch(e){turns.splice(0,turns.length,...before);Object.assign(row,state);throw e}finally{release()}},
 }
 const route=load('src/app/api/mensetsu/live/[token]/turn/route.ts',{
  'node:crypto':require('node:crypto'),'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},
  '@/lib/mensetsu/public':{loadSessionByToken:async()=>({...row})},'@vercel/functions':{waitUntil(){}},
  '@/lib/mensetsu/run-evaluation':{runEvaluation:async()=>({ok:true})},
 })
 return {row,turns,get writes(){return writes},set failWrite(v){failWrite=v},send:async turns=>{const r=await route.POST({json:async()=>({turns})},{params:Promise.resolve({token:'synthetic'})});return {status:r.status,body:await r.json()}}}
}
const line=(id='client-1',text='Answer')=>({id,text,speaker:'candidate',startMs:100,endMs:null,questionOrd:0})
;(async()=>{
 await check('lost response retry acknowledges one stored answer without advancing session timestamp',async()=>{const f=fixture();assert.equal((await f.send([line()])).body.saved,1);const time=f.row.updatedAt;assert.equal((await f.send([line()])).body.saved,1);assert.equal(f.turns.length,1);assert.equal(f.writes,1);assert.equal(f.row.updatedAt,time)})
 await check('concurrent retries allocate only one answer',async()=>{const f=fixture();const replies=await Promise.all([f.send([line()]),f.send([line()])]);assert.ok(replies.every(r=>r.status===200&&r.body.saved===1));assert.equal(f.turns.length,1)})
 await check('mixed retry and new answer append only the new ordinal',async()=>{const f=fixture();await f.send([line()]);assert.equal((await f.send([line(),line('client-2','New')])).body.saved,2);assert.deepEqual(f.turns.map(t=>t.ord),[0,1])})
 await check('repeated same ID in one batch is acknowledged but inserted once',async()=>{const f=fixture();assert.equal((await f.send([line(),line()])).body.saved,2);assert.equal(f.turns.length,1)})
 await check('same ID with different text is rejected without inserting other new answers',async()=>{const f=fixture();await f.send([line()]);const r=await f.send([line('new','New'),line('client-1','Changed')]);assert.equal(r.status,409);assert.equal(f.turns.length,1)})
 await check('conflicting same ID within first batch is rejected atomically',async()=>{const f=fixture();assert.equal((await f.send([line(),line('client-1','Changed')])).status,409);assert.equal(f.turns.length,0)})
 for(const key of ['speaker','startMs','endMs','questionOrd']) await check('reused ID cannot change '+key,async()=>{const f=fixture();await f.send([line()]);const change={...line(),[key]:key==='speaker'?'interviewer':500};assert.equal((await f.send([change])).status,409);assert.equal(f.turns.length,1)})
 await check('evaluated session acknowledges already saved retry but rejects new speech',async()=>{const f=fixture();await f.send([line()]);f.row.evaluatedAt=new Date();f.row.status='evaluated';assert.equal((await f.send([line()])).status,200);assert.equal((await f.send([line('new','New')])).status,409);assert.equal(f.turns.length,1)})
 await check('expired grace acknowledges old ID but does not add new answer',async()=>{const f=fixture();await f.send([line()]);f.row.endedAt=new Date(Date.now()-700000);f.row.status='completed';assert.equal((await f.send([line()])).status,200);assert.equal((await f.send([line('new','New')])).status,409)})
 await check('expired retention does not acknowledge or restore speech',async()=>{const f=fixture();await f.send([line()]);f.row.purgeAfter=new Date(Date.now()-1);assert.equal((await f.send([line()])).status,410)})
 await check('revoked consent does not acknowledge old transcript',async()=>{const f=fixture();await f.send([line()]);f.row.consentedAt=null;assert.equal((await f.send([line()])).status,403)})
 await check('same client ID in two sessions creates distinct storage IDs',async()=>{const a=fixture('session-a'),b=fixture('session-b');await a.send([line()]);await b.send([line()]);assert.notEqual(a.turns[0].id,b.turns[0].id);assert.match(a.turns[0].id,/^mt_[a-f0-9]{64}$/)})
 for(const id of ['',123,'a'.repeat(129),'bad/id']) await check('malformed client ID rejected '+String(id).slice(0,15),async()=>{const f=fixture();assert.equal((await f.send([line(id)])).status,400);assert.equal(f.turns.length,0)})
 await check('older clients without IDs retain append behavior',async()=>{const f=fixture();const t=line();delete t.id;await f.send([t]);await f.send([t]);assert.equal(f.turns.length,2)})
 await check('failed storage can retry same ID without losing the answer',async()=>{const f=fixture();f.failWrite=true;await assert.rejects(f.send([line()]),/synthetic failure/);f.failWrite=false;assert.equal((await f.send([line()])).body.saved,1);assert.equal(f.turns.length,1)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
