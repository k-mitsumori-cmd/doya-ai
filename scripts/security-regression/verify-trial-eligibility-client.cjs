const assert = require('node:assert/strict');
const {load} = require('./load-typescript.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let now = 1000, sequence = 0, respond = async () => Response.json({eligible:true});
  const timers = new Map(), requests = [];
  class ClockDate extends Date { static now() { return now; } }
  const {fetchTrialEligibility: get} = load('src/lib/trial-eligibility-client.ts', {}, {
    AbortController, TextDecoder, Uint8Array, Date:ClockDate,
    fetch: (...args) => { requests.push(args); return respond(...args); },
    setTimeout: (fn,ms) => { assert.equal(ms,15000); timers.set(++sequence,fn); return sequence; },
    clearTimeout: id => timers.delete(id),
  });
  return {get,timers,requests,set:fn=>{respond=fn},advance:ms=>{now+=ms},expire:()=>{for(const fn of [...timers.values()])fn()}};
}
(async()=>{
  let passed=0;
  const dedup=fixture();const first=dedup.get('a');assert.equal(dedup.get('a'),first);
  assert.equal((await first).value,true);assert.equal((await dedup.get('a')).value,true);assert.equal(dedup.requests.length,1);assert.equal(dedup.timers.size,0);
  assert.equal(dedup.requests[0][0],'/api/stripe/trial-eligibility');assert.equal(dedup.requests[0][1].cache,'no-store');passed++;
  dedup.set(async()=>Response.json({eligible:false}));dedup.advance(60000);assert.equal((await dedup.get('a')).value,false);assert.equal(dedup.requests.length,2);passed++;
  assert.equal((await dedup.get('other-user')).value,false);assert.equal(dedup.requests.length,3);passed++;
  for(const data of [{eligible:'true'},{eligible:1},{eligible:null},[],null,{eligible:true,error:'unknown'},{eligible:true,code:'UNAVAILABLE'},{}]){
    const f=fixture();f.set(async()=>Response.json(data));assert.equal(await f.get('a'),null);assert.equal(await f.get('a'),null);assert.equal(f.requests.length,1);f.advance(1000);f.set(async()=>Response.json({eligible:true}));assert.equal((await f.get('a')).value,true);assert.equal(f.requests.length,2);assert.equal(f.timers.size,0);
  }passed++;
  for(const make of [()=>Response.json({eligible:true},{status:503}),()=>new Response('{bad'),()=>new Response(new Uint8Array([255])),()=>new Response('x'.repeat(16385)),()=>new Response('{}',{headers:{'content-length':'16385'}}),()=>new Response(null)]){
    const f=fixture();f.set(async()=>make());assert.equal(await f.get('a'),null);assert.equal(f.timers.size,0);
  }passed++;
  const header=fixture();let release;header.set(()=>new Promise(resolve=>{release=resolve}));const hang=header.get('a');header.expire();assert.equal(await hang,null);assert.equal(header.timers.size,0);assert.equal(header.requests[0][1].signal.aborted,true);
  header.advance(1000);header.set(async()=>Response.json({eligible:false}));assert.equal((await header.get('a')).value,false);release(Response.json({eligible:true}));await tick();assert.equal((await header.get('a')).value,false);assert.equal(header.requests.length,2);passed++;
  const body=fixture();let cancelled=0,releaseRead;
  body.set(async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(resolve=>{releaseRead=resolve}),cancel:()=>{cancelled++;return new Promise(()=>{})}})}}));
  const bodyHang=body.get('a');await tick();body.expire();assert.equal(await bodyHang,null);assert.equal(body.timers.size,0);assert.equal(cancelled,1);releaseRead({done:true});await tick();
  body.advance(1000);body.set(async()=>Response.json({eligible:true}));assert.equal((await body.get('a')).value,true);passed++;
  const broken=fixture();broken.set(()=>{throw Error('synthetic network failure')});assert.equal(await broken.get('a'),null);assert.equal(broken.timers.size,0);broken.advance(1000);broken.set(async()=>Response.json({eligible:false}));assert.equal((await broken.get('a')).value,false);passed++;
  const limit=fixture();for(let i=0;i<101;i++)assert.equal((await limit.get('user'+i)).value,true);await limit.get('user0');assert.equal(limit.requests.length,102);assert.equal(limit.timers.size,0);passed++;
  const chunks=fixture();let reads=0,cancel=0;
  chunks.set(async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(8193)}},cancel:async()=>{cancel++}})}}));
  assert.equal(await chunks.get('a'),null);assert.equal(reads,2);assert.equal(cancel,1);assert.equal(chunks.timers.size,0);passed++;
  console.log(JSON.stringify({passed,scope:'Actual trial eligibility module with synthetic fetch/body/clock; request deduplication, cache expiry/scope/bound, strict unknown suppression, header/body deadlines including noncooperating work, late reply immunity, retries and cleanup. No network, Stripe or DB.'}));
})().catch(error=>{console.error(error);process.exitCode=1});
