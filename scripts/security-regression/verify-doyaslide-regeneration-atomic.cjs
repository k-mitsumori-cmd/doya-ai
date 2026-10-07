// The old in-memory transaction fixture has been replaced by stronger actual
// PostgreSQL operation regressions in CI (ownership/branding/version/chat/rollback).
const assert=require('node:assert/strict'),fixture=require('./doyaslide-http-fixture.cjs')
const operationId='10000000-0000-4000-8000-000000000001'
;(async()=>{
 for(const kind of ['regenerate','chat']){
  const body={operationId,...(kind==='chat'?{message:'Synthetic change'}:{})}
  for(const input of [undefined,{}]){const f=fixture(kind),r=await f.post(input);assert.equal(r.status,409);assert.equal(f.calls.ownerReads,0);assert.equal(f.calls.operations.length,0)}
  const f=fixture(kind);assert.equal((await f.post(body)).status,200);assert.equal(f.calls.ownerReads,1);assert.equal(f.calls.operations.length,1);const input=f.calls.operations[0];assert.equal(input.kind,kind);assert.equal(input.actor,'actor');assert.equal(input.projectId,'project');assert.equal(input.slideId,'slide');assert.equal(input.operationId,operationId);assert.equal(f.route.maxDuration,300)
  for(const extra of [{kind:'batch'},{projectId:'foreign'},{slideId:'other'},{actor:'other'}]){const f=fixture(kind),r=await f.post({...body,...extra});assert.equal(r.status,400);assert.equal(f.calls.operations.length,0);assert.equal(f.calls.ownerReads,0)}
  for(const mode of ['foreign','anonymous','limit','outage','conflict']){const f=fixture(kind,mode),r=await f.post(body),payload=await r.json();assert.equal(r.status,{foreign:404,anonymous:401,limit:403,outage:503,conflict:409}[mode]);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');assert(!JSON.stringify(payload).includes('Synthetic private'));if(['foreign','anonymous'].includes(mode))assert.equal(f.calls.operations.length,0)}
 }
 console.log('PASS legacy regenerate/chat actor-owned binding, UUID requirement and private errors; actual atomic saves/rollback are checked by private PostgreSQL CI')
})().catch(e=>{console.error(e);process.exitCode=1})
