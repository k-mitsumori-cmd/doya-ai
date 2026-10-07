const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
const before = '2099-01-01T00:00:00.000Z';
function fixture(options = {}) {
  let active = true, queue = Promise.resolve();
  const state = { row: options.missing ? null : { id:'task',organizationId:options.foreign?'foreign':'org',title:'元の作業',status:'open',dealId:null,dueDate:null,createdAt:new Date('2026-10-01T00:00:00.000Z'),updatedAt:new Date(before),completedAt:null }, updates:0,deletes:0,locks:[],transactions:0 };
  const tx = {
    $queryRaw:async (strings,...values)=> { const sql=strings.join('?');state.locks.push(sql);if(sql.includes('sfa_members'))return [{id:'member'}];assert.match(sql,/sfa_tasks/);assert.ok(values.includes('org'));assert.ok(values.includes('task'));return state.row?.organizationId==='org'&&!options.emptyLock?[{id:'task'}]:[]; },
    sfaMember:{findFirst:async()=>active?{id:'member'}:null},
    sfaTask:{findUnique:async()=>state.row,findFirst:async({where,select})=>{assert.equal(where.organizationId,'org');assert.equal(select.updatedAt,true);return state.row?.organizationId===where.organizationId?state.row:null;},
      update:async({where,data,select})=>{assert.equal(where.id,'task');assert.equal(select.updatedAt,true);state.updates++;return state.row={...state.row,...data};},
      delete:async({where})=>{assert.equal(where.id,'task');state.deletes++;const row=state.row;state.row=null;return row;},
    },
  };
  const prisma={$transaction:fn=>{const run=queue.then(async()=>{state.transactions++;return fn(tx)});queue=run.catch(()=>{});return run;}};
  const api=load('src/app/api/sfa/tasks/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/access':{getSfaContext:async()=>options.noSession?null:{userId:'user',memberId:'member',organizationId:'org'},orgSlugFrom:()=> 'alpha'}});
  return {state,revoke:()=>{active=false},call:async(method,body={},query='',id='task')=>{
    const response=await api[method]({json:async()=>body,nextUrl:new URL('https://example.test/api'+query)},{params:Promise.resolve({id})});
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie');return response;
  }};
}
(async()=>{
 const cases=[];const check=async(name,fn)=>{await fn();cases.push(name)};
 for(const bad of [null,'',0,'bad','2099-01-01','2099-01-01T00:00:00Z','2099-02-30T00:00:00.000Z'])await check('malformed PATCH version rejected '+JSON.stringify(bad),async()=>{const f=fixture();assert.equal((await f.call('PATCH',{title:'変更',expectedUpdatedAt:bad})).status,400);assert.equal(f.state.transactions,0)});
 await check('version alone never toggles or writes',async()=>{const f=fixture();assert.equal((await f.call('PATCH',{expectedUpdatedAt:before})).status,400);assert.equal(f.state.row.status,'open');assert.equal(f.state.updates,0)});
 await check('modern title update returns monotonically increasing full DTO',async()=>{const f=fixture();const r=await f.call('PATCH',{title:'変更',expectedUpdatedAt:before});assert.equal(r.status,200);const d=await r.json();assert.equal(d.task.title,'変更');assert.equal(d.task.updatedAt,'2099-01-01T00:00:00.001Z');assert.equal(d.task.createdAt,'2026-10-01T00:00:00.000Z');assert.match(f.state.locks[1],/FOR UPDATE/)});
 await check('stale title never overwrites newer value',async()=>{const f=fixture();await f.call('PATCH',{title:'新しい作業',expectedUpdatedAt:before});const r=await f.call('PATCH',{title:'古い作業',expectedUpdatedAt:before});assert.equal(r.status,409);assert.equal((await r.json()).code,'VERSION_CONFLICT');assert.equal(f.state.row.title,'新しい作業');assert.equal(f.state.updates,1)});
 await check('12 same-version concurrent changes have one winner',async()=>{const f=fixture();const r=await Promise.all(Array.from({length:12},(_,i)=>f.call('PATCH',{title:'作業'+i,expectedUpdatedAt:before})));assert.equal(r.filter(x=>x.status===200).length,1);assert.equal(r.filter(x=>x.status===409).length,11);assert.equal(f.state.updates,1)});
 await check('opposing same-version status writes cannot cancel each other',async()=>{const f=fixture();const r=await Promise.all([f.call('PATCH',{status:'done',expectedUpdatedAt:before}),f.call('PATCH',{status:'open',expectedUpdatedAt:before})]);assert.deepEqual(r.map(x=>x.status),[200,409]);assert.equal(f.state.row.status,'done');assert.ok(f.state.row.completedAt)});
 await check('same-status explicit update preserves completion time and advances version',async()=>{const f=fixture();await f.call('PATCH',{status:'done',expectedUpdatedAt:before});const completed=f.state.row.completedAt;const next=f.state.row.updatedAt.toISOString();assert.equal((await f.call('PATCH',{status:'done',expectedUpdatedAt:next})).status,200);assert.equal(f.state.row.completedAt,completed);assert.equal(f.state.row.updatedAt.toISOString(),'2099-01-01T00:00:00.002Z')});
 await check('legacy empty toggle remains serialized but version advances',async()=>{const f=fixture();await f.call('PATCH',{});await f.call('PATCH',{});assert.equal(f.state.row.status,'open');assert.equal(f.state.row.updatedAt.toISOString(),'2099-01-01T00:00:00.002Z')});
 await check('stale DELETE cannot remove a newer task',async()=>{const f=fixture();await f.call('PATCH',{title:'更新済み',expectedUpdatedAt:before});const r=await f.call('DELETE',{},'?expectedUpdatedAt='+before);assert.equal(r.status,409);assert.equal((await r.json()).code,'VERSION_CONFLICT');assert.equal(f.state.deletes,0)});
 await check('current-version DELETE removes exactly one task; recovery says absent',async()=>{const f=fixture();assert.equal((await f.call('DELETE',{},'?expectedUpdatedAt='+before)).status,200);assert.equal(f.state.deletes,1);const d=await (await f.call('GET')).json();assert.equal(d.state,'missing');assert.equal(d.task,null)});
 for(const query of ['?expectedUpdatedAt=','?expectedUpdatedAt=bad','?expectedUpdatedAt='+before+'&expectedUpdatedAt='+before])await check('invalid DELETE version rejected '+query,async()=>{const f=fixture();assert.equal((await f.call('DELETE',{},query)).status,400);assert.equal(f.state.transactions,0);assert.equal(f.state.deletes,0)});
 await check('legacy DELETE retained',async()=>{const f=fixture();assert.equal((await f.call('DELETE')).status,200);assert.equal(f.state.deletes,1)});
 await check('read-only recovery returns current version under task share lock',async()=>{const f=fixture();await f.call('PATCH',{title:'更新済み',expectedUpdatedAt:before});const n=f.state.updates;const r=await f.call('GET');assert.equal(r.status,200);const d=await r.json();assert.equal(d.state,'found');assert.equal(d.task.title,'更新済み');assert.equal(d.task.updatedAt,'2099-01-01T00:00:00.001Z');assert.match(f.state.locks.at(-1),/FOR SHARE/);assert.equal(f.state.updates,n);assert.equal(f.state.deletes,0)});
 for(const options of [{missing:true},{foreign:true},{emptyLock:true}])await check('recovery missing/foreign/empty lock discloses nothing '+JSON.stringify(options),async()=>{const f=fixture(options);const d=await (await f.call('GET')).json();assert.equal(d.state,'missing');assert.equal(d.task,null);assert.equal(f.state.updates+f.state.deletes,0)});
 for(const method of ['GET','PATCH','DELETE'])await check(method+' denies revoked actor',async()=>{const f=fixture();f.revoke();assert.equal((await f.call(method,{title:'変更',expectedUpdatedAt:before},'?expectedUpdatedAt='+before)).status,403);assert.equal(f.state.locks.length,1);assert.equal(f.state.updates+f.state.deletes,0)});
 await check('anonymous GET rejected before transaction',async()=>{const f=fixture({noSession:true});assert.equal((await f.call('GET')).status,401);assert.equal(f.state.transactions,0)});
 for (const method of ['PATCH','DELETE']) await check(method+' invalid target rejected before transaction',async()=>{const f=fixture();assert.equal((await f.call(method,{title:'変更',expectedUpdatedAt:before},'','bad/id')).status,400);assert.equal(f.state.transactions,0)});
 await check('invalid recovery target rejected before transaction',async()=>{const f=fixture();assert.equal((await f.call('GET',{},'','bad/id')).status,400);assert.equal(f.state.transactions,0)});
 console.log(JSON.stringify({passed:cases.length,cases,scope:'Actual task detail handlers with actual fresh authority helper. Independent stateful synthetic Prisma with serialized transactions and SQL shape assertions. Actual PostgreSQL scheduling, modern client adoption and private production unproven.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
