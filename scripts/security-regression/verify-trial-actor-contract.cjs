const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const A={user:{id:'a',email:'a@example.invalid'}},B={user:{id:'b',email:'b@example.invalid'}};
const mockRequest=(kind,actor)=>({nextUrl:new URL('https://example.invalid/api/stripe/trial-eligibility?expectedKind='+kind+(actor===undefined?'':'&expectedActor='+encodeURIComponent(actor)))});
function fixture(session=A,user={id:'a',email:'a@example.invalid',stripeCustomerId:null},eligible=true){
 let db=0,provider=0;
 const route=load('src/app/api/stripe/trial-eligibility/route.ts',{
  'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>{if(session instanceof Error)throw session;return session}},'@/lib/auth':{},
  '@/lib/prisma':{prisma:{user:{findUnique:async query=>{db++;assert.equal(query.where.id,session?.user?.id);return user}}}},
  '@/lib/trial':{isTrialEligible:async input=>{provider++;assert.equal(input.email,user.email);return eligible}},
 });
 return {GET:route.GET,counts:()=>({db,provider})};
}
const headers=response=>{assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/i)};
(async()=>{
 let passed=0;
 for(const [session,kind,actor] of [[B,'authenticated','a'],[A,'guest',undefined],[null,'authenticated','a']]){
  const f=fixture(session);const res=await f.GET(mockRequest(kind,actor));assert.equal(res.status,409);headers(res);assert.deepEqual(f.counts(),{db:0,provider:0});passed++;
 }
 for(const url of ['?','?expectedKind=foo','?expectedKind=guest&expectedActor=a','?expectedKind=authenticated','?expectedKind=authenticated&expectedActor=','?expectedKind=guest&expectedKind=guest','?expectedKind=authenticated&expectedActor=a&expectedActor=b']){
  const f=fixture();const res=await f.GET({nextUrl:new URL('https://example.invalid/'+url)});assert.equal(res.status,400,url);headers(res);assert.deepEqual(f.counts(),{db:0,provider:0});passed++;
 }
 {const f=fixture(Error('synthetic session failure'));const res=await f.GET(mockRequest('authenticated','a'));assert.equal(res.status,503);headers(res);assert.deepEqual(f.counts(),{db:0,provider:0});passed++;}
 for(const [session,user] of [[{user:{email:'a@example.invalid'}},undefined],[{user:{id:'a'}},undefined],[A,null],[A,{id:'a',email:'other@example.invalid',stripeCustomerId:null}]]){
  const f=fixture(session,user);const res=await f.GET(mockRequest('authenticated','a'));assert.equal(res.status,503);headers(res);assert.equal(f.counts().provider,0);passed++;
 }
 for(const [session,kind,actor,eligible] of [[A,'authenticated','a',true],[A,'authenticated','a',false],[null,'guest',undefined,true]]){
  const f=fixture(session,session?{id:'a',email:'a@example.invalid',stripeCustomerId:null}:undefined,eligible);
  const res=await f.GET(mockRequest(kind,actor));assert.equal(res.status,200);headers(res);const body=await res.json();assert.equal(body.version,1);assert.equal(body.principal.kind,kind);assert.equal(body.eligible,eligible);if(actor)assert.equal(body.principal.actorId,actor);passed++;
 }
 // Parent A/B counterexample through the actual route and actual helper.
 const f=fixture(B,{id:'b',email:'b@example.invalid',stripeCustomerId:null},true);
 const {createTrialEligibilityReader}=load('src/lib/trial-eligibility-client.ts',{}, {AbortController,TextDecoder,Uint8Array,URLSearchParams,setTimeout,clearTimeout,fetch:async url=>f.GET({nextUrl:new URL(url,'https://example.invalid')})});
 const reader=createTrialEligibilityReader({kind:'authenticated',actorId:'a'});assert.equal((await reader.read()).kind,'reauth');assert.equal(reader.peek(),null);assert.deepEqual(f.counts(),{db:0,provider:0});reader.retire();passed++;
 const malformed=load('src/lib/trial-eligibility-client.ts',{}, {AbortController,TextDecoder,Uint8Array,URLSearchParams,setTimeout,clearTimeout,fetch:async()=>Response.json({version:1,principal:{kind:'authenticated',actorId:'b'},eligible:true})}).createTrialEligibilityReader({kind:'authenticated',actorId:'a'});
 assert.equal((await malformed.read()).kind,'unknown');assert.equal(malformed.peek(),null);malformed.retire();passed++;
 console.log(JSON.stringify({passed,scope:'Actual route and client helper with synthetic session, DB and trial provider; no real DB, Stripe or network.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
