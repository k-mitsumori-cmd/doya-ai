// Atomic reservation/partial refunds/crash recovery moved to the actual private
// PostgreSQL operation probe executed by CI. This suite checks the legacy boundary.
const assert=require('node:assert/strict'),fixture=require('./doyaslide-http-fixture.cjs')
const operationId='10000000-0000-4000-8000-000000000001'
;(async()=>{
 for(const body of [undefined,{}, {projectId:'project'}]){const f=fixture('batch'),r=await f.post(body);assert.equal(r.status,409);assert.equal((await r.json()).code,'OPERATION_REQUIRED');assert.equal(f.calls.operations.length,0)}
 for(const body of [{operationId:12,projectId:'project'},{operationId,projectId:'project',kind:'chat'},'{', 'x'.repeat(16385)]){const f=fixture('batch'),r=await f.post(body);assert([400,413].includes(r.status));assert.equal(f.calls.operations.length,0)}
 const f=fixture('batch');assert.equal((await f.post({operationId,projectId:'project',onlyPending:true})).status,200);assert.equal(f.calls.operations.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.calls.operations[0])),{operationId,projectId:'project',onlyPending:true,actor:'actor',kind:'batch'});assert.equal(f.route.maxDuration,300)
 for(const mode of ['anonymous','limit','outage','conflict']){const f=fixture('batch',mode),r=await f.post({operationId,projectId:'project'}),body=await r.json();assert.equal(r.status,{anonymous:401,limit:403,outage:503,conflict:409}[mode]);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');assert(!JSON.stringify(body).includes('Synthetic private'));if(mode==='limit')assert.equal(body.upgradeUrl,'/doyaslide/pricing')}
 console.log('PASS legacy batch admission/strict body/UUID/private errors; actual quota and partial-settlement atomicity are checked by private PostgreSQL CI')
})().catch(e=>{console.error(e);process.exitCode=1})
