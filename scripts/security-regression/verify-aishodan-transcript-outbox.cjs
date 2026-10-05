const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture(responder, data=new Map()) {
 const storage={get length(){return data.size},key:i=>Array.from(data.keys())[i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
 const calls=[]
 const outbox=load('src/lib/aishodan/transcript-outbox.ts',{}, {window:{localStorage:storage},AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{const call={url,body:JSON.parse(options.body)};calls.push(call);return responder?responder(call):Response.json(url.endsWith('/end')?{status:'completed'}:{saved:call.body.turns.length})}})
 return{outbox,data,calls}
}
const line=id=>({id,speaker:'guest',text:'Synthetic answer',startMs:100,phase:'hearing'})
const entry=n=>({roomToken:'room',sessionId:'session',expiresAt:Date.now()+60000,finishRequested:false,turns:Array.from({length:n},(_,i)=>line('id-'+i))})
;(async()=>{
 await check('new page instance recovers all 51 unacknowledged turns in stable batches',async()=>{
  const first=fixture();const original=entry(51);assert.equal(first.outbox.storeTranscriptOutbox(original),true)
  const next=fixture(undefined,first.data);assert.equal(await next.outbox.recoverTranscriptOutboxes('room'),true)
  assert.deepEqual(next.calls.map(c=>c.body.turns.length),[50,1]);assert.equal(next.calls[0].body.turns[0].id,original.turns[0].id);assert.equal(first.data.size,0)
 })
 for(const status of [429,500,503])await check('nonterminal failure '+status+' preserves all pending answers',async()=>{
  const f=fixture(()=>Response.json({error:'Synthetic'},{status}));f.outbox.storeTranscriptOutbox(entry(2));assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),false);assert.equal(f.outbox.pendingTranscriptOutboxes('room')[0].turns.length,2)
 })
 await check('partial acknowledgment retains the full batch for idempotent retry',async()=>{
  const f=fixture(()=>Response.json({saved:1}));f.outbox.storeTranscriptOutbox(entry(2));assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),false);assert.equal(f.outbox.pendingTranscriptOutboxes('room')[0].turns.length,2)
 })
 await check('end request waits for every saved answer and keeps end intent on failure',async()=>{
  const f=fixture(c=>c.url.endsWith('/end')?Response.json({error:'Synthetic'},{status:503}):Response.json({saved:c.body.turns.length}));f.outbox.storeTranscriptOutbox({...entry(51),finishRequested:true});assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),false);assert.deepEqual(f.calls.map(c=>c.url.split('/').at(-1)),['turn','turn','end']);const left=f.outbox.pendingTranscriptOutboxes('room')[0];assert.equal(left.turns.length,0);assert.equal(left.finishRequested,true)
 })
 await check('successful end removes the completed intent',async()=>{
  const f=fixture();f.outbox.storeTranscriptOutbox({...entry(1),finishRequested:true});assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),true);assert.equal(f.data.size,0)
 })
 for(const status of [403,404,410])await check('authoritative unavailable response '+status+' clears private pending text',async()=>{
  const f=fixture(()=>Response.json({},{status}));f.outbox.storeTranscriptOutbox(entry(2));assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),true);assert.equal(f.data.size,0)
 })
 await check('retention expiry clears stored text without sending it',async()=>{
  const f=fixture();const old=entry(1);old.expiresAt=Date.now()-1;f.data.set('aishodan-transcript-outbox:v1:room:session',JSON.stringify(old));assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),true);assert.equal(f.data.size,0);assert.equal(f.calls.length,0)
 })
 await check('other rooms and unrelated storage are not transmitted or removed',async()=>{
  const f=fixture();f.outbox.storeTranscriptOutbox({...entry(1),roomToken:'other'});f.data.set('unrelated','private');assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),true);assert.equal(f.calls.length,0);assert.equal(f.data.size,2)
 })
 await check('new answers arriving during acknowledgment survive and are sent next',async()=>{
  let f,first=true;f=fixture(c=>{if(first){first=false;const latest=f.outbox.pendingTranscriptOutboxes('room')[0];latest.turns.push(line('new'));f.outbox.storeTranscriptOutbox(latest)}return Response.json({saved:c.body.turns.length})});f.outbox.storeTranscriptOutbox(entry(1));assert.equal(await f.outbox.recoverTranscriptOutboxes('room'),true);assert.deepEqual(f.calls.map(c=>c.body.turns[0].id),['id-0','new'])
 })
 await check('storage quota failure reports failure without overwriting retained data',async()=>{
  const f=fixture();f.outbox.storeTranscriptOutbox(entry(1));const huge=entry(200);huge.turns.forEach(t=>t.text='x'.repeat(8000));assert.equal(f.outbox.storeTranscriptOutbox(huge),false);assert.equal(f.outbox.pendingTranscriptOutboxes('room')[0].turns.length,1)
 })
 await check('storage excludes contact information and provider credentials',async()=>{
  const f=fixture();f.outbox.storeTranscriptOutbox({...entry(1),guestEmail:'PRIVATE_EMAIL',providerToken:'PRIVATE_SECRET'});const raw=Array.from(f.data.values())[0];assert.ok(!raw.includes('PRIVATE_EMAIL'));assert.ok(!raw.includes('PRIVATE_SECRET'))
 })
 for(const operation of ['access','length','getItem'])await check('storage '+operation+' failure is not treated as an empty recovered queue',async()=>{
  let deletes=0,requests=0
  const db={get length(){if(operation==='length')throw Error('PRIVATE_STORAGE_FAILURE');return 1},key:()=> 'aishodan-transcript-outbox:v1:room:session',getItem:()=>{if(operation==='getItem')throw Error('PRIVATE_STORAGE_FAILURE');return JSON.stringify(entry(1))},removeItem:()=>deletes++}
  const window={get localStorage(){if(operation==='access')throw Error('PRIVATE_STORAGE_FAILURE');return db}}
  const outbox=load('src/lib/aishodan/transcript-outbox.ts',{}, {window,AbortController,setTimeout,clearTimeout,fetch:async()=>{requests++;return Response.json({saved:1})}})
  assert.equal(await outbox.recoverTranscriptOutboxes('room'),false);assert.equal(deletes,0);assert.equal(requests,0)
 })
 console.log(JSON.stringify({passed:results.length}))
})().catch(error=>{console.error(error);process.exitCode=1})
