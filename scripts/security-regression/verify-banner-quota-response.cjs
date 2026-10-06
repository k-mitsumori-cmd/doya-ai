const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const results=[];
async function test(name,run){let reply,seq=0;const timers=new Map(),requests=[];const clock={setTimeout:(fn,ms)=>{assert.equal(ms,10000);timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id)};
 const {readBannerQuotaResponse}=load('src/lib/banner-quota-response-client.ts',{}, {AbortController,TextDecoder,Uint8Array,...clock,fetch:(url,init)=>{requests.push({url,init});return reply(url,init)}});
 const signal=new AbortController();await run({read:()=>readBannerQuotaResponse(signal.signal),reply:fn=>reply=fn,timers,requests,signal});assert.equal(timers.size,0);results.push(name)}
(async()=>{
 await test('Valid bounded JSON uses private uncached GET',async f=>{f.reply(async()=>Response.json({signedIn:true}));assert.equal((await f.read()).signedIn,true);assert.equal(f.requests[0].url,'/api/usage/banner');assert.equal(f.requests[0].init.cache,'no-store');assert.equal(f.requests[0].init.signal.aborted,true)});
 await test('Total deadline releases fetch that ignores abort',async f=>{let resolve;f.reply(()=>new Promise(r=>resolve=r));const task=f.read();for(const expire of [...f.timers.values()])expire();await assert.rejects(task);resolve(Response.json({signedIn:true}));assert.equal(f.requests[0].init.signal.aborted,true)});
 await test('Total deadline releases stalled body',async f=>{f.reply(async()=>new Response(new ReadableStream({start(){}})));const task=f.read();await new Promise(r=>setImmediate(r));for(const expire of [...f.timers.values()])expire();await assert.rejects(task)});
 await test('Actor cancellation releases pending fetch',async f=>{f.reply(()=>new Promise(()=>{}));const task=f.read();f.signal.abort();await assert.rejects(task);assert.equal(f.requests[0].init.signal.aborted,true)});
 await test('Already cancelled request never fetches',async f=>{f.signal.abort();await assert.rejects(f.read());assert.equal(f.requests.length,0)});
 for(const [name,response] of [['Non-success',()=>Response.json({signedIn:true},{status:500})],['Invalid JSON',()=>new Response('bad')],['Declared oversized body',()=>new Response('{}',{headers:{'content-length':'65537'}})],['Actual oversized body',()=>new Response(' '.repeat(65537))],['Invalid UTF8',()=>new Response(new Uint8Array([255]))]])await test(name,async f=>{f.reply(async()=>response());await assert.rejects(f.read())});
 console.log(JSON.stringify({passed:results.length,results,scope:'Actual readonly quota reader; synthetic fetch, body, abort and deadline only. No network or customer data.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
