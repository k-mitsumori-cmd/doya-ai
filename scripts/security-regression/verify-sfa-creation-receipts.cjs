const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
const receipts = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': crypto, './mutation-authority': authority });
const uuid = '9de845c3-90b0-4a67-870c-3750e24fc653';
function fixture() {
  let ctx = { userId: 'user-a', memberId: 'member-a', organizationId: 'org-a' }, active = true, queue = Promise.resolve();
  const state = { receipts: new Map(), tasks: new Map(), activities: new Map(), creates: 0, receiptWrites: 0, failReceipt: false, lockOrder: [] };
  const tx = {
    $queryRaw: async () => { state.lockOrder.push('actor'); return [{ id: ctx.memberId }]; },
    $executeRaw: async (strings, ...values) => { assert.match(strings.join('?'), /pg_advisory_xact_lock/); assert.equal(values.length, 1); assert.match(values[0], /^sfa-create:v1:[a-f0-9]{64}$/); state.lockOrder.push('receipt'); return 1; },
    sfaMember: { findFirst: async () => active ? { id: ctx.memberId } : null },
    systemSetting: { findUnique: async ({ where }) => state.receipts.get(where.key) || null,
      create: async ({ data }) => { if (state.failReceipt) throw Error('secret database detail'); assert.ok(!state.receipts.has(data.key)); state.receiptWrites++; state.receipts.set(data.key, { value: data.value }); return data; } },
  };
  for (const [model, map] of [['sfaTask', state.tasks], ['sfaActivity', state.activities]]) tx[model] = {
    findFirst: async ({ where }) => { const r = map.get(where.id); return r?.organizationId === where.organizationId ? r : null; },
    create: async ({ data }) => { state.creates++; const row = { id: `row-${state.creates}`, ...data }; map.set(row.id, row); return row; },
  };
  const prisma = { $transaction: fn => {
    const run = queue.then(async () => {
      const backup = structuredClone({ receipts: state.receipts, tasks: state.tasks, activities: state.activities, creates: state.creates, receiptWrites: state.receiptWrites });
      try { return await fn(tx); } catch (error) {
        for (const key of ['receipts','tasks','activities']) { state[key].clear(); for (const [k,v] of backup[key]) state[key].set(k,v); }
        state.creates = backup.creates; state.receiptWrites = backup.receiptWrites; throw error;
      }
    }); queue = run.catch(() => {}); return run;
  } };
  const mocks = { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/sfa/mutation-authority': authority,
    '@/lib/sfa/creation-receipt': receipts, '@/lib/sfa/access': { getSfaContext: async () => ctx && ({ ...ctx }), orgSlugFrom: () => 'alpha' } };
  const routes = { task: load('src/app/api/sfa/tasks/route.ts', mocks), activity: load('src/app/api/sfa/activities/route.ts', mocks) };
  return { state, scope: patch => { ctx = ctx && { ...ctx, ...patch }; }, revoke: () => { active = false; }, logout: () => { ctx = null; },
    post: (kind, body) => routes[kind].POST({ json: async () => body }),
    recover: (kind, op = uuid) => routes[kind].GET({ url: 'https://example.test/api?operationId=' + encodeURIComponent(op) }),
  };
}
(async () => {
  const cases = [];
  const check = async (name, fn) => { await fn(); cases.push(name); };
  for (const kind of ['task','activity']) {
    const body = kind === 'task' ? { title: ' 見積を送る ', operationId: uuid } : { subject: ' 面談 ', operationId: uuid };
    for (const bad of [null, '', 'not-a-uuid', 17, uuid.replace('-4a67-', '-7a67-')]) await check(kind + ' invalid operation rejected ' + JSON.stringify(bad), async () => {
      const f = fixture(), r = await f.post(kind, { ...body, operationId: bad }); assert.equal(r.status,400); assert.equal(f.state.creates,0);
    });
    await check(kind + ' 20 concurrent replays create once and return one ID', async () => {
      const f = fixture(), responses = await Promise.all(Array.from({ length: 20 }, () => f.post(kind, body)));
      assert.ok(responses.every(r => r.status === 200)); const ids = await Promise.all(responses.map(async r => (await r.json())[kind].id));
      assert.equal(new Set(ids).size,1); assert.equal(f.state.creates,1); assert.equal(f.state.receiptWrites,1);
      assert.equal(f.state.lockOrder.slice(0,2).join(','),'actor,receipt');
    });
    await check(kind + ' canonical equivalent input and uppercase UUID replay', async () => {
      const f=fixture(); assert.equal((await f.post(kind,body)).status,200);
      const next = kind==='task' ? { title:'見積を送る',dueDate:null,dealId:null,operationId:uuid.toUpperCase() } : { type:'note',subject:'面談',body:null,operationId:uuid.toUpperCase() };
      assert.equal((await f.post(kind,next)).status,200); assert.equal(f.state.creates,1);
    });
    await check(kind + ' changed payload conflicts', async () => {
      const f=fixture(); await f.post(kind,body); const r=await f.post(kind,{...body,...(kind==='task'?{title:'変更'}:{subject:'変更'})}); assert.equal(r.status,409); assert.equal(f.state.creates,1);
    });
    await check(kind + ' response loss can recover read-only', async () => {
      const f=fixture(); await f.post(kind,body); const before=f.state.receiptWrites; const r=await f.recover(kind); assert.equal(r.status,200); const d=await r.json(); assert.equal(d.state,'found'); assert.equal(d[kind].id,'row-1'); assert.equal(f.state.receiptWrites,before); assert.equal(f.state.creates,1); assert.equal(r.headers.get('cache-control'),'private, no-store');
    });
    await check(kind + ' deleted target never resurrected', async () => {
      const f=fixture(); await f.post(kind,body); f.state[kind==='task'?'tasks':'activities'].clear(); assert.equal((await f.post(kind,body)).status,409);
      assert.equal((await (await f.recover(kind)).json()).state,'unavailable'); assert.equal(f.state.creates,1);
    });
    for (const field of ['userId','organizationId']) await check(kind + ' operation scoped by ' + field, async () => {
      const f=fixture(); await f.post(kind,body); f.scope({[field]:'different'}); const r=await f.recover(kind); assert.equal((await r.json()).state,'missing'); assert.equal((await f.post(kind,body)).status,200); assert.equal(f.state.creates,2);
    });
    await check(kind + ' foreign moved target not disclosed or recreated', async () => {
      const f=fixture(); await f.post(kind,body); f.state[kind==='task'?'tasks':'activities'].get('row-1').organizationId='foreign'; const d=await (await f.recover(kind)).json(); assert.equal(d.state,'unavailable'); assert.equal(d[kind],null); assert.equal((await f.post(kind,body)).status,409); assert.equal(f.state.creates,1);
    });
    await check(kind + ' corrupt receipt fails closed', async () => {
      const f=fixture(); await f.post(kind,body); for (const value of ['null','[]','{','{"version":1,"id":"row-1","inputHash":"bad"}']) {
        for (const [key] of f.state.receipts) f.state.receipts.set(key,{value}); assert.equal((await f.post(kind,body)).status,409); assert.equal((await f.recover(kind)).status,409);
      } assert.equal(f.state.creates,1);
    });
    await check(kind + ' receipt failure rolls back creation and sanitized response', async () => {
      const f=fixture(); f.state.failReceipt=true; const r=await f.post(kind,body); assert.equal(r.status,500); assert.ok(!(await r.text()).includes('secret')); assert.equal(f.state.creates,0); assert.equal(f.state.tasks.size+f.state.activities.size,0); assert.equal(f.state.receipts.size,0);
    });
    await check(kind + ' revoked actor cannot replay or recover', async () => {
      const f=fixture(); await f.post(kind,body); f.revoke(); assert.equal((await f.post(kind,body)).status,403); assert.equal((await f.recover(kind)).status,403); assert.equal(f.state.creates,1);
    });
    await check(kind + ' logged out recovery denied', async () => { const f=fixture(); f.logout(); assert.equal((await f.recover(kind)).status,401); });
    await check(kind + ' malformed recovery operation rejected', async () => { const f=fixture(); assert.equal((await f.recover(kind,'bad')).status,400); assert.equal(f.state.lockOrder.length,0); });
    await check(kind + ' legacy omission remains separately non-idempotent', async () => {
      const f=fixture(), legacy={...body}; delete legacy.operationId; await f.post(kind,legacy); await f.post(kind,legacy); assert.equal(f.state.creates,2); assert.equal(f.state.receipts.size,0);
    });
  }
  await check('task/activity kinds never share receipt', async () => { const f=fixture(); await f.post('task',{title:'作業',operationId:uuid}); assert.equal((await (await f.recover('activity')).json()).state,'missing'); await f.post('activity',{subject:'活動',operationId:uuid}); assert.equal(f.state.receipts.size,2); });
  await check('explicit activity date conflicts with omitted server timestamp',async()=>{ const f=fixture(); await f.post('activity',{subject:'活動',operationId:uuid}); assert.equal((await f.post('activity',{subject:'活動',operationId:uuid,occurredAt:'2026-10-07'})).status,409); assert.equal(f.state.creates,1); });
  console.log(JSON.stringify({passed:cases.length,cases,scope:'Actual task/activity create and recovery handlers and actual receipt/authority helpers. Stateful synthetic transactions with rollback; concurrency serialized by fixture. Actual PostgreSQL locking, client operation UUID adoption, actor/epoch UI, task mutation versions and private production remain unproven.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
