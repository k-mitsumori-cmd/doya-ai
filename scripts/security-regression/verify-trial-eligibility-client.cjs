const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const A={kind:'authenticated',actorId:'a'},B={kind:'authenticated',actorId:'b'},G={kind:'guest'};
const dto=(principal,eligible)=>({version:1,principal,eligible});
function fixture(principal=A){
 let now=1000,seq=0,respond=async()=>Response.json(dto(principal,true));
 const timers=new Map(),requests=[];
 class ClockDate extends Date{static now(){return now}}
 const {createTrialEligibilityReader}=load('src/lib/trial-eligibility-client.ts',{}, {AbortController,TextDecoder,Uint8Array,URLSearchParams,Date:ClockDate,fetch:(...args)=>{requests.push(args);return respond(...args)},setTimeout:(fn,ms)=>{assert.equal(ms,15000);timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id)});
 const reader=createTrialEligibilityReader(principal);
 return {reader,requests,timers,set:fn=>respond=fn,advance:ms=>now+=ms,expire:()=>{for(const fn of [...timers.values()])fn()}};
}
(async()=>{
 let passed=0;
 const f=fixture();const first=f.reader.read();assert.equal(f.reader.read(),first);assert.equal((await first).value,true);assert.equal(f.reader.peek().value,true);assert.equal(f.requests.length,1);assert.match(f.requests[0][0],/expectedKind=authenticated&expectedActor=a/);assert.equal(f.requests[0][1].cache,'no-store');passed++;
 f.advance(60000);f.set(async()=>Response.json(dto(A,false)));assert.equal(f.reader.peek(),null);assert.equal((await f.reader.read()).value,false);assert.equal(f.requests.length,2);passed++;
 for(const bad of [dto(B,true),dto(G,true),{eligible:true},dto(A,'true'),{...dto(A,true),code:'x'},null,[],{version:1,principal:{kind:'authenticated'},eligible:true}]){
  const t=fixture();t.set(async()=>Response.json(bad));assert.equal((await t.reader.read()).kind,'unknown');assert.equal(t.reader.peek(),null);assert.equal((await t.reader.read()).kind,'unknown');assert.equal(t.requests.length,1);t.reader.retire();
 }passed++;
 for(const make of [()=>Response.json(dto(A,true),{status:503}),()=>new Response('{bad'),()=>new Response(new Uint8Array([255])),()=>new Response('x'.repeat(16385)),()=>new Response('{}',{headers:{'content-length':'16385'}}),()=>new Response(null)]){
  const t=fixture();t.set(async()=>make());assert.equal((await t.reader.read()).kind,'unknown');assert.equal(t.timers.size,0);t.reader.retire();
 }passed++;
 const mismatch=fixture();mismatch.set(async()=>Response.json({code:'PRINCIPAL_CHANGED'},{status:409}));assert.equal((await mismatch.reader.read()).kind,'reauth');assert.equal(mismatch.reader.peek(),null);passed++;
 const header=fixture();let release;header.set(()=>new Promise(resolve=>{release=resolve}));const hang=header.reader.read();header.expire();assert.equal((await hang).kind,'unknown');assert.equal(header.requests[0][1].signal.aborted,true);header.advance(1000);header.set(async()=>Response.json(dto(A,false)));assert.equal((await header.reader.read()).value,false);release(Response.json(dto(A,true)));await tick();assert.equal(header.reader.peek().value,false);passed++;
 const body=fixture();let releaseRead,cancel=0;body.set(async()=>({ok:true,status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(resolve=>{releaseRead=resolve}),cancel:()=>{cancel++;return Promise.resolve()}})}}));const hung=body.reader.read();await tick();body.expire();assert.equal((await hung).kind,'unknown');assert.equal(cancel,1);releaseRead({done:true});await tick();body.reader.retire();passed++;
 const lateBody=fixture();let releaseBody;
 lateBody.set(async()=>({ok:true,status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(resolve=>{releaseBody=resolve}),cancel:async()=>{}})}}));
 const lateRead=lateBody.reader.read();await tick();lateBody.reader.retire();
 releaseBody({done:false,value:new TextEncoder().encode(JSON.stringify(dto(A,true)))});await tick();
 assert.equal((await lateRead).kind,'unknown');assert.equal(lateBody.reader.peek(),null);passed++;
 const retired=fixture();let delayed;retired.set(()=>new Promise(resolve=>{delayed=resolve}));const old=retired.reader.read();retired.reader.retire();assert.equal(retired.requests[0][1].signal.aborted,true);delayed(Response.json(dto(A,true)));assert.equal((await old).kind,'unknown');assert.equal(retired.reader.peek(),null);passed++;
 const isolated=fixture();let finishOld;isolated.set(()=>new Promise(resolve=>{finishOld=resolve}));
 const oldAttempt=isolated.reader.read();isolated.reader.retire();
 const newer=fixture();assert.equal((await newer.reader.read()).value,true);
 finishOld(Response.json({code:'TRIAL_CHECK_UNAVAILABLE'},{status:503}));assert.equal((await oldAttempt).kind,'unknown');
 assert.equal(newer.reader.peek().value,true);assert.equal(newer.requests.length,1);passed++;
 const abandonHeader=fixture();abandonHeader.set(()=>new Promise(()=>{}));
 const abandoned=abandonHeader.reader.read();abandonHeader.reader.retire();
 assert.equal((await abandoned).kind,'unknown');assert.equal(abandonHeader.timers.size,0);assert.equal(abandonHeader.requests[0][1].signal.aborted,true);passed++;
 const abandonBody=fixture();let bodyCancelled=0;
 abandonBody.set(async()=>({ok:true,status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{bodyCancelled++;return new Promise(()=>{})}})}}));
 const abandonedBody=abandonBody.reader.read();await tick();abandonBody.reader.retire();
 assert.equal((await abandonedBody).kind,'unknown');assert.equal(abandonBody.timers.size,0);assert.equal(bodyCancelled,1);passed++;
 const guest=fixture(G);assert.equal((await guest.reader.read()).value,true);assert.match(guest.requests[0][0],/expectedKind=guest/);assert.doesNotMatch(guest.requests[0][0],/expectedActor/);passed++;
 console.log(JSON.stringify({passed,scope:'Actual client reader with synthetic fetch/clock; no network, provider, DB or Stripe.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
