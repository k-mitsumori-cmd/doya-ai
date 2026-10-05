const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture(id='session'){
 const tasks=new Map();let manualOutcome=null
 const turns=[];let tail=Promise.resolve(),fail=false
 const row={id,organizationId:'o',startedAt:new Date(),endedAt:null,status:'live',guestId:'guest',roomId:'room',consentedAt:new Date(),purgeAfter:null,currentPhase:'opening',updatedAt:new Date()}
 const db={
  aishodanOutcome:{findUnique:async()=>manualOutcome},systemSetting:{upsert:async({where,create,update})=>{tasks.set(where.key,tasks.has(where.key)?update.value:create.value);return{}}},
  $queryRaw:async strings=>{assert.match(strings.join('?'),/aishodan_sessions.*FOR NO KEY UPDATE/);return [{id}]},
  aishodanSession:{findUnique:async()=>({...row}),update:async({data})=>Object.assign(row,data)},
  aishodanTurn:{findMany:async({where})=>turns.filter(t=>where.id.in.includes(t.id)),findFirst:async()=>turns.length?{ord:Math.max(...turns.map(t=>t.ord))}:null,createMany:async({data})=>{if(fail)throw Error('synthetic write failure');for(const t of data){assert.ok(!t.id||!turns.some(old=>old.id===t.id));turns.push({...t,id:t.id||`legacy-${turns.length}`})}return{count:data.length}}},
  $transaction:async fn=>{const previous=tail;let release;tail=new Promise(r=>release=r);await previous;const before=turns.slice();try{return await fn(db)}catch(e){turns.splice(0,turns.length,...before);throw e}finally{release()}},
 }
 const route=load('src/app/api/aishodan/room/[token]/turn/route.ts',{'@/lib/aishodan/evaluation-task':load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')}),'node:crypto':require('node:crypto'),'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/aishodan/session':{loadGuestSession:async()=>({...row})}})
 return {row,turns,tasks,set manualOutcome(v){manualOutcome=v},set fail(v){fail=v},send:async turns=>{const r=await route.POST({json:async()=>({sessionId:id,turns})},{params:Promise.resolve({token:'synthetic'})});return{status:r.status,body:await r.json()}}}
}
const line=(id='one',text='Answer')=>({id,text,speaker:'guest',startMs:100,phase:'hearing'})
;(async()=>{
 await check('lost response retry acknowledges one stored answer',async()=>{const f=fixture();await f.send([line()]);assert.equal((await f.send([line()])).body.saved,1);assert.equal(f.turns.length,1)})
 await check('concurrent duplicate requests insert only once',async()=>{const f=fixture();const replies=await Promise.all([f.send([line()]),f.send([line()])]);assert.ok(replies.every(r=>r.status===200&&r.body.saved===1));assert.equal(f.turns.length,1)})
 await check('concurrent distinct requests have distinct ordinals',async()=>{const f=fixture();await Promise.all([f.send([line('one')]),f.send([line('two')])]);assert.deepEqual(f.turns.map(t=>t.ord),[0,1])})
 await check('mixed retry and new speech acknowledges both',async()=>{const f=fixture();await f.send([line()]);assert.equal((await f.send([line(),line('two')])).body.saved,2);assert.deepEqual(f.turns.map(t=>t.ord),[0,1])})
 await check('same words under different IDs remain separate',async()=>{const f=fixture();await f.send([line(),line('two')]);assert.equal(f.turns.length,2)})
 await check('repeated ID within a batch inserted once',async()=>{const f=fixture();assert.equal((await f.send([line(),line()])).body.saved,2);assert.equal(f.turns.length,1)})
 for(const key of ['text','speaker','startMs','phase'])await check('conflicting retry '+key+' rejected without partial writes',async()=>{const f=fixture();await f.send([line()]);const change={...line(),[key]:key==='startMs'?200:key==='speaker'?'ai':'Changed'};assert.equal((await f.send([line('new'),change])).status,409);assert.equal(f.turns.length,1)})
 await check('conflicting ID within first batch rejected atomically',async()=>{const f=fixture();assert.equal((await f.send([line(),line('one','Changed')])).status,409);assert.equal(f.turns.length,0)})
 for(const id of ['',123,'a'.repeat(129),'bad/id'])await check('invalid ID rejected '+String(id).slice(0,12),async()=>{const f=fixture();assert.equal((await f.send([line(id)])).status,400);assert.equal(f.turns.length,0)})
 await check('legacy clients retain append and phase fallback',async()=>{const f=fixture();const t={text:'Answer',speaker:'guest',startMs:100};await f.send([t]);await f.send([t]);assert.equal(f.turns.length,2);assert.equal(f.turns[0].phase,'opening')})
 await check('unknown phase remains stable for identified retry after advancement',async()=>{const f=fixture();const t={...line(),phase:null};await f.send([t]);f.row.currentPhase='closing';assert.equal((await f.send([t])).status,200);assert.equal(f.turns.length,1);assert.equal(f.turns[0].phase,null)})
 await check('IDs scoped to session',async()=>{const a=fixture('a'),b=fixture('b');await a.send([line()]);await b.send([line()]);assert.notEqual(a.turns[0].id,b.turns[0].id);assert.match(a.turns[0].id,/^ast_[a-f0-9]{64}$/)})
 await check('revoked consent blocks retry',async()=>{const f=fixture();await f.send([line()]);f.row.consentedAt=null;assert.equal((await f.send([line()])).status,403)})
 await check('expired retention blocks writes and retry',async()=>{const f=fixture();await f.send([line()]);f.row.purgeAfter=new Date(Date.now()-1);assert.equal((await f.send([line()])).status,410);assert.equal(f.turns.length,1)})
 await check('failed transaction preserves retryability',async()=>{const f=fixture();f.fail=true;await assert.rejects(f.send([line()]));assert.equal(f.turns.length,0);f.fail=false;assert.equal((await f.send([line()])).body.saved,1)})
 await check('50-item admission reports only accepted items',async()=>{const f=fixture();assert.equal((await f.send(Array.from({length:51},(_,i)=>line(`id-${i}`)))).body.saved,50);assert.equal(f.turns.length,50)})
 await check('late answer marks AI outcome stale and queues new revision',async()=>{const f=fixture();f.row.status='evaluated';f.row.endedAt=new Date();await f.send([line()]);assert.equal(f.row.status,'completed');assert.equal(f.tasks.size,1)})
 await check('late answer preserves manual decision while queuing record review',async()=>{const f=fixture();f.row.status='evaluated';f.row.endedAt=new Date();f.manualOutcome={overriddenAt:new Date()};await f.send([line()]);assert.equal(f.row.status,'evaluated');assert.equal(f.tasks.size,1)})
 for(const status of ['pending','expired','unknown'])await check('non-recordable status blocks writes '+status,async()=>{const f=fixture();f.row.status=status;assert.equal((await f.send([line()])).status,409);assert.equal(f.turns.length,0);assert.equal(f.tasks.size,0)})
 await check('unstarted session cannot acquire transcript records',async()=>{const f=fixture();f.row.startedAt=null;assert.equal((await f.send([line()])).status,409);assert.equal(f.turns.length,0)})
 for(const status of ['completed','evaluated','aborted'])await check('terminal state without end time blocks new records '+status,async()=>{const f=fixture();f.row.status=status;assert.equal((await f.send([line()])).status,409);assert.equal(f.turns.length,0)})
 await check('live state with end time blocks inconsistent writes',async()=>{const f=fixture();f.row.endedAt=new Date();assert.equal((await f.send([line()])).status,409);assert.equal(f.turns.length,0)})
 await check('ended session acknowledges already saved speech without another revision or task',async()=>{const f=fixture();await f.send([line()]);f.row.status='completed';f.row.endedAt=new Date();const revision=f.row.updatedAt.getTime();assert.equal((await f.send([line()])).body.saved,1);assert.equal(f.turns.length,1);assert.equal(f.row.updatedAt.getTime(),revision);assert.equal(f.tasks.size,0)})
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
