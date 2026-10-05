const assert=require('node:assert/strict')
const {load,check,results}=require('./load-typescript.cjs')
function fixture({responder,expires=Date.now()+60000,denied=false}={}){
 const data=new Map(),refs=[],callbacks=[],states=[],effects=[],events={},calls=[];let completed=0
 const storage={get length(){return data.size},key:i=>Array.from(data.keys())[i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(denied)throw Error('Denied');data.set(k,v)},removeItem:k=>data.delete(k)}
 const globals={window:{localStorage:storage,addEventListener:(k,fn)=>events[k]=fn,removeEventListener(){}},AbortController,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,Blob,navigator:{sendBeacon:()=>false},fetch:async(url,options)=>{const call={url,body:typeof options.body==='string'?JSON.parse(options.body):JSON.parse(await options.body.text())};calls.push(call);return responder?responder(call):Response.json(url.endsWith('/end')?{status:'completed'}:{saved:call.body.turns.length})}}
 const outbox=load('src/lib/aishodan/transcript-outbox.ts',{},globals)
 const hook=load('src/lib/aishodan/useRealtimeMeeting.ts',{
  react:{useRef:v=>{const r={current:v};refs.push(r);return r},useState:v=>{const i=states.length;states.push(v);return[v,next=>states[i]=typeof next==='function'?next(states[i]):next]},useCallback:fn=>{callbacks.push(fn);return fn},useEffect:fn=>effects.push(fn)},
  '@/lib/aishodan/transcript-outbox':outbox,'@/lib/realtime/transcript-source':load('src/lib/realtime/transcript-source.ts'),'@/lib/realtime/hallucination':{isLikelyHallucination:()=>false},
 },globals)
 const api=hook.useRealtimeMeeting({roomToken:'room',sessionId:'session',purgeAfter:expires?new Date(expires).toISOString():null,onEnded:()=>completed++})
 refs[13].current=Date.now()-1000
 return{api,outbox,data,calls,states,completed:()=>completed,enqueue:n=>{for(let i=0;i<n;i++)callbacks[3]('guest','Answer '+i)},flush:callbacks[2],pagehide:()=>{effects.at(-1)();events.pagehide({persisted:false})},recover:()=>load('src/lib/aishodan/transcript-outbox.ts',{},globals).recoverTranscriptOutboxes('room')}
}
;(async()=>{
 await check('actual hook persists stable IDs before a network request',async()=>{const f=fixture();f.enqueue(2);assert.equal(f.calls.length,0);const saved=f.outbox.pendingTranscriptOutboxes('room')[0];assert.equal(saved.turns.length,2);await f.flush();assert.equal(f.calls[0].body.turns[0].id,saved.turns[0].id);assert.equal(f.data.size,0)})
 await check('actual hook retains text after server failure and a new page recovers it',async()=>{let failed=true;const f=fixture({responder:c=>failed?Response.json({},{status:503}):Response.json(c.url.endsWith('/end')?{status:'completed'}:{saved:c.body.turns.length})});f.enqueue(51);await f.api.end();assert.equal(f.completed(),0);assert.equal(f.outbox.pendingTranscriptOutboxes('room')[0].turns.length,51);failed=false;assert.equal(await f.recover(),true);assert.deepEqual(f.calls.slice(1).map(c=>c.url.split('/').at(-1)),['turn','turn','end']);assert.equal(f.data.size,0)})
 await check('pagehide retains excess answers plus explicit end intent beyond beacon budget',async()=>{const f=fixture();f.enqueue(51);f.pagehide();const saved=f.outbox.pendingTranscriptOutboxes('room')[0];assert.equal(saved.turns.length,51);assert.equal(saved.finishRequested,true);await new Promise(r=>setImmediate(r));assert.equal(await f.recover(),true);assert.equal(f.data.size,0)})
 await check('normal acknowledged completion clears both text and end intent',async()=>{const f=fixture();f.enqueue(2);await f.api.end();assert.equal(f.completed(),1);assert.equal(f.data.size,0)})
 await check('failed end keeps an empty durable end intent',async()=>{const f=fixture({responder:c=>c.url.endsWith('/end')?Response.json({},{status:503}):Response.json({saved:c.body.turns.length})});f.enqueue(1);await f.api.end();const saved=f.outbox.pendingTranscriptOutboxes('room')[0];assert.equal(saved.turns.length,0);assert.equal(saved.finishRequested,true);assert.equal(f.completed(),0)})
 await check('storage denied warns without pretending text survived page close',async()=>{const f=fixture({denied:true});f.enqueue(1);assert.ok(f.states[3]?.includes('一時保管できません'));assert.equal(f.data.size,0);await f.api.end();assert.equal(f.completed(),1)})
 await check('missing server deadline cannot store indefinite private text',async()=>{const f=fixture({expires:0});f.enqueue(1);assert.ok(f.states[3]);assert.equal(f.data.size,0)})
 console.log(JSON.stringify({passed:results.length}))
})().catch(error=>{console.error(error);process.exitCode=1})
