const assert=require('node:assert/strict'),{load,check}=require('./load-typescript.cjs')
const {createAudioWindowClient}=load('src/lib/cunning/audio-window-client.ts',{}, {Blob,FormData,setTimeout,clearTimeout,AbortController})
const tick=()=>new Promise(setImmediate)
function fixture(overrides={}){
 let next=0,uploads=0,reservations=0,finalizations=0
 const rows=new Map(),seen=[],delivered=[],sequences={remote:0,self:0}
 const response=(d,status=200)=>Response.json(d,{status})
 const server=async(url,init)=>{
  if(typeof init.body==='string'){
   const body=JSON.parse(init.body)
   if(body.action==='reserve'){
    reservations++;let row=rows.get(body.requestKey)
    if(!row){row={windowId:'w'+rows.size,speaker:body.speaker,sequence:sequences[body.speaker]++};rows.set(body.requestKey,row)}
    return response({state:'reserved',...row})
   }
   finalizations++;const last=new Map();for(const row of rows.values())last.set(row.speaker,row)
   return response({state:'complete',finalTranscripts:[...last.values()].map(row=>({speaker:row.speaker,sequence:row.sequence,transcriptId:row.result?.transcriptId}))})
  }
  uploads++;const id=url.split('/').pop(),row=[...rows.values()].find(r=>r.windowId===id),form=init.body
  const payload={id,language:form.get('language'),text:form.has('silent')?'':await form.get('audio').text()};seen.push(payload)
  if(!row.result)row.result={text:payload.text,transcriptId:'t'+id}
  return response(row.result)
 }
 const request=async(url,init)=>overrides.fetch?overrides.fetch(url,init,server):server(url,init)
 const client=createAudioWindowClient('session','token',{fetch:request,requestKey:()=>String(++next),onResult:r=>{delivered.push(r);overrides.onResult?.(r)},...overrides.options})
 const prepare=async(speaker='remote')=>{const h=client.reserve(speaker);await client.ready(h);client.begin(h);return h}
 return{client,prepare,rows,seen,delivered,stats:()=>({uploads,reservations,finalizations})}
}
;(async()=>{
await check('parallel uploads deliver in reserved channel order; successful payload is never reuploaded',async()=>{
 let release,first=true;const f=fixture({fetch:async(u,i,server)=>{if(typeof i.body!=='string'&&first){first=false;await new Promise(r=>release=r)}return server(u,i)}})
 const a=await f.prepare(),b=await f.prepare(),one=new Blob(['first']),two=new Blob(['second'])
 const pending=f.client.submit(a,one,'ja');await tick();await f.client.submit(b,two,'en');assert.equal(f.delivered.length,0)
 release();await pending;assert.deepEqual(f.delivered.map(r=>r.text),['first','second']);await f.client.retry();await f.client.submit(a,one,'ja');assert.equal(f.stats().uploads,2)
 f.client.stop();assert.equal((await f.client.finish()).finalTranscripts.length,1)
})
await check('failure retains original audio/language; overlapping retries have one in-flight upload',async()=>{
 let attempts=0,release;const f=fixture({fetch:async(u,i,server)=>{if(typeof i.body!=='string'){attempts++;if(attempts===1)return Response.json({error:'fail'},{status:503});await new Promise(r=>release=r)}return server(u,i)}})
 const h=await f.prepare(),blob=new Blob(['original']);await assert.rejects(f.client.submit(h,blob,'en'));assert.ok(f.client.hasPending())
 assert.throws(()=>f.client.submit(h,new Blob(['changed']),'ja'))
 const a=f.client.retry(),b=f.client.retry();await tick();assert.equal(attempts,2);release();await Promise.all([a,b]);assert.equal(f.seen[0].text,'original');assert.equal(f.seen[0].language,'en');assert.equal(f.delivered.length,1)
})
await check('lost reservation response is recovered with same key after stop; unused slot is silent',async()=>{
 let first=true;const keys=[];const f=fixture({fetch:async(u,i,server)=>{if(typeof i.body==='string'&&JSON.parse(i.body).action==='reserve'){keys.push(JSON.parse(i.body).requestKey);const r=await server(u,i);if(first){first=false;throw Error('lost response')}return r}return server(u,i)}})
 const h=f.client.reserve('remote');await assert.rejects(f.client.ready(h));f.client.stop();await f.client.finish();assert.equal(new Set(keys).size,1);assert.equal(f.rows.size,1);assert.equal(f.seen[0].text,'');assert.equal(f.client.hasPending(),false)
})
await check('explicit expired response discards only an unused unaccepted reservation',async()=>{
 let stopped=false;const f=fixture({fetch:async(u,i,server)=>{if(typeof i.body==='string'&&JSON.parse(i.body).action==='reserve'){if(!stopped)throw Error('offline');return Response.json({code:'expired'},{status:409})}return server(u,i)}})
 const h=f.client.reserve('remote');await assert.rejects(f.client.ready(h));stopped=true;f.client.stop();await f.client.finish();assert.equal(f.client.hasPending(),false);assert.equal(f.stats().uploads,0)
})
await check('captured-but-missing data blocks finalize and is never silently acknowledged',async()=>{
 const f=fixture();await f.prepare();f.client.stop();await assert.rejects(f.client.finish());assert.equal(f.stats().uploads,0);assert.equal(f.stats().finalizations,0);assert.equal(f.client.hasPending(),true)
})
await check('reservation order, stop boundary and both-channel completion are enforced',async()=>{
 const f=fixture(),a=f.client.reserve('remote'),b=f.client.reserve('remote');await assert.rejects(f.client.ready(b));await f.client.ready(a);await f.client.ready(b);f.client.begin(a)
 const self=await f.prepare('self');await f.client.submit(a,new Blob(['remote']),'ja');await f.client.submit(self,null,'ja');f.client.stop();assert.throws(()=>f.client.begin(b));assert.throws(()=>f.client.reserve('remote'));const result=await f.client.finish();assert.equal(result.finalTranscripts.length,2);assert.equal(f.delivered.length,3)
})
await check('hung fetch ignoring abort is bounded; late response cannot publish a reservation',async()=>{
 const callbacks=[];let release;const f=fixture({options:{schedule:fn=>{callbacks.push(fn);return callbacks.length},cancel:()=>{}},fetch:async(u,i,server)=>{await new Promise(r=>release=r);return server(u,i)}})
 const h=f.client.reserve('remote'),pending=f.client.ready(h);await tick();callbacks[0]();await assert.rejects(pending,/タイムアウト/);release();await tick();assert.throws(()=>f.client.begin(h));assert.equal(f.delivered.length,0);assert.equal(f.client.hasPending(),true)
})
await check('consumer failure blocks completion without another paid upload',async()=>{
 const f=fixture({onResult:()=>{throw Error('UI failure')}}),h=await f.prepare();await f.client.submit(h,new Blob(['text']),'ja');await f.client.retry();await assert.rejects(f.client.finish());assert.equal(f.stats().uploads,1);assert.equal(f.client.hasPending(),true)
})
await check('final response must match every last saved channel window',async()=>{
 const f=fixture({fetch:async(u,i,server)=>typeof i.body==='string'&&JSON.parse(i.body).action==='finalize'?Response.json({state:'complete',finalTranscripts:[]}):server(u,i)}),h=await f.prepare();await f.client.submit(h,null,'ja');await assert.rejects(f.client.finish(),/一致/)
})
})().catch(e=>{console.error(e);process.exitCode=1})
