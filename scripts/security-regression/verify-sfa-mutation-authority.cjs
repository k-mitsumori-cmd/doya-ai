const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
const receipts = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': require('node:crypto'), './mutation-authority': authority });
const ctx = { userId: 'user', memberId: 'member', organizationId: 'org', organizationSlug: 'alpha', role: 'owner' };
const definitions = {
  'task-create': ['src/app/api/sfa/tasks/route.ts', 'POST', { title: '作業' }],
  'task-update': ['src/app/api/sfa/tasks/[id]/route.ts', 'PATCH', { title: '変更後' }],
  'task-delete': ['src/app/api/sfa/tasks/[id]/route.ts', 'DELETE', {}],
  'activity-create': ['src/app/api/sfa/activities/route.ts', 'POST', { subject: '活動' }],
};
function fixture(options = {}) {
  const state = {
    actor: { id: 'member', userId: 'user', organizationId: 'org', status: 'ACTIVE', role: 'member', ...options.actor },
    task: { id: 'task', title: '元の作業', organizationId: options.foreignTask ? 'foreign' : 'org', status: 'open', dueDate: null, completedAt: null },
    relation: { id: 'related', organizationId: 'org', isActive: true, ...options.relation },
    createdTasks: [], activities: [], updates: 0, deletes: 0, queries: [], membershipReads: 0, transactions: 0,
  };
  let inTransaction = false, locks = new Set(), queue = Promise.resolve();
  const assertActor = () => { assert.ok(inTransaction); assert.ok(state.membershipReads > 0); assert.ok(locks.has('sfa_members')); };
  const relation = name => ({ findFirst: async ({ where }) => {
    assertActor(); assert.ok(locks.has(name));
    assert.equal(where.organizationId, ctx.organizationId); assert.equal(where.isActive, true);
    const row = state.relation; return row.id === where.id && row.organizationId === where.organizationId && row.isActive ? { id: row.id } : null;
  } });
  const tx = {
    $queryRaw: async (strings, ...values) => {
      assert.ok(inTransaction); const sql = strings.join('?'), table = sql.match(/FROM (sfa_\w+)/)?.[1];
      assert.ok(table); assert.ok(values.includes('org'));
      if (table === 'sfa_members') { assert.match(sql, /FOR SHARE/); assert.ok(values.includes('member')); assert.ok(values.includes('user')); }
      else { assertActor(); assert.match(sql, table === 'sfa_deals' || table === 'sfa_tasks' ? /FOR UPDATE/ : /FOR SHARE/); }
      if (options.failLock) throw Error('synthetic-secret-provider-detail');
      locks.add(table); state.queries.push({ table, sql });
      if (options.emptyLock || options.emptyTable === table) return [];
      if (table === 'sfa_members') return !options.removed && state.actor.userId === 'user' && state.actor.organizationId === 'org' ? [{ id: 'member' }] : [];
      if (table === 'sfa_tasks') return state.task && state.task.organizationId === 'org' ? [{ id: 'task' }] : [];
      return state.relation.id === values[0] && state.relation.organizationId === 'org' ? [{ id: state.relation.id }] : [];
    },
    sfaMember: { findFirst: async ({ where }) => {
      assert.ok(inTransaction); assert.ok(locks.has('sfa_members')); state.membershipReads++;
      assert.equal(where.id, ctx.memberId); assert.equal(where.userId, ctx.userId); assert.equal(where.organizationId, ctx.organizationId); assert.equal(where.status, 'ACTIVE');
      assert.deepEqual(Array.from(where.role.in), ['owner', 'admin', 'manager', 'member']);
      const row = state.actor;
      return !options.removed && row.id === where.id && row.userId === where.userId && row.organizationId === where.organizationId && row.status === where.status && where.role.in.includes(row.role) ? { id: row.id } : null;
    } },
    sfaAccount: relation('sfa_accounts'), sfaContact: relation('sfa_contacts'),
    sfaDeal: { ...relation('sfa_deals'), updateMany: async () => { assertActor(); assert.ok(locks.has('sfa_deals')); if (options.failActivityUpdate) throw Error('synthetic-secret-provider-detail'); return { count: 1 }; } },
    sfaTask: {
      findUnique: async () => { assertActor(); assert.ok(locks.has('sfa_tasks')); return state.task; },
      create: async ({ data }) => { assertActor(); state.createdTasks.push(data); return { id: 'new-task', ...data }; },
      update: async ({ data }) => { assertActor(); assert.ok(locks.has('sfa_tasks')); state.updates++; return state.task = { ...state.task, ...data }; },
      delete: async () => { assertActor(); assert.ok(locks.has('sfa_tasks')); state.deletes++; const row = state.task; state.task = null; return row; },
    },
    sfaActivity: { create: async ({ data }) => { assertActor(); state.activities.push(data); return { id: 'new-activity', ...data }; } },
  };
  const prisma = { $transaction: fn => {
    const running = queue.then(async () => {
      state.transactions++; inTransaction = true; locks = new Set();
      const snapshot = structuredClone({ task: state.task, createdTasks: state.createdTasks, activities: state.activities, updates: state.updates, deletes: state.deletes });
      try { return await fn(tx); } catch (e) { Object.assign(state, snapshot); throw e; } finally { inTransaction = false; }
    }); queue = running.catch(() => {}); return running;
  } };
  const mocks = { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/sfa/mutation-authority': authority, '@/lib/sfa/creation-receipt': receipts,
    '@/lib/sfa/access': { getSfaContext: async () => options.noSession ? null : ({ ...ctx }), orgSlugFrom: () => 'alpha' } };
  const routes = Object.fromEntries(Object.entries(definitions).map(([name, [file]]) => [name, load(file, mocks)]));
  return { state, invoke: (name, body) => {
    const [, method, defaults] = definitions[name];
    return routes[name][method]({ json: async () => body || defaults }, { params: Promise.resolve({ id: 'task' }) }).then(response => {
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Cookie'); return response;
    });
  } };
}
(async () => {
  const cases = [];
  const check = async (name, run) => { await run(); cases.push(name); };
  for (const name of Object.keys(definitions)) {
    for (const [change, options] of Object.entries({ removed: { removed: true }, inactive: { actor: { status: 'INACTIVE' } }, wrongUser: { actor: { userId: 'other' } }, wrongOrganization: { actor: { organizationId: 'foreign' } }, unknownRole: { actor: { role: 'invalid' } } })) {
      await check(name + ' denies fresh ' + change, async () => {
        const f = fixture(options), response = await f.invoke(name);
        assert.equal(response.status, 403); assert.equal(f.state.createdTasks.length + f.state.activities.length + f.state.updates + f.state.deletes, 0);
        assert.ok(f.state.membershipReads <= 1); assert.equal(f.state.queries.length, 1);
      });
    }
    for (const role of ['member', 'manager', 'admin', 'owner']) await check(name + ' allows fresh ' + role, async () => {
      const f = fixture({ actor: { role } }); assert.equal((await f.invoke(name)).status, 200); assert.equal(f.state.membershipReads, 1);
    });
    await check(name + ' rejects an empty membership lock before later snapshot', async () => {
      const f = fixture({ emptyLock: true }); assert.equal((await f.invoke(name)).status, 403); assert.equal(f.state.membershipReads, 0);
    });
    await check(name + ' sanitizes lock failure', async () => {
      const f = fixture({ failLock: true }), response = await f.invoke(name); assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('synthetic-secret'));
    });
    await check(name + ' denies no session before transaction', async () => {
      const f = fixture({ noSession: true }); assert.equal((await f.invoke(name)).status, 401); assert.equal(f.state.transactions, 0);
    });
  }
  for (const field of ['accountId', 'dealId', 'contactId']) for (const [name, relation] of Object.entries({ foreign: { organizationId: 'foreign' }, inactive: { isActive: false }, missing: { id: 'missing' } })) await check('activity fresh ' + field + ' ' + name, async () => {
    const f = fixture({ relation }); assert.equal((await f.invoke('activity-create', { subject: '活動', [field]: 'related' })).status, 400); assert.equal(f.state.activities.length, 0);
  });
  for (const relation of [{ organizationId: 'foreign' }, { isActive: false }, { id: 'missing' }]) await check('task fresh relation rejected ' + JSON.stringify(relation), async () => {
    const f = fixture({ relation }); assert.equal((await f.invoke('task-create', { title: '作業', dealId: 'related' })).status, 400); assert.equal(f.state.createdTasks.length, 0);
  });
  for (const name of ['task-update', 'task-delete']) await check(name + ' foreign row denied under lock', async () => {
    const f = fixture({ foreignTask: true }); assert.equal((await f.invoke(name)).status, 404); assert.equal(f.state.updates + f.state.deletes, 0);
  });
  for (const [name, field, table] of [['task-create', 'dealId', 'sfa_deals'], ['activity-create', 'accountId', 'sfa_accounts'], ['activity-create', 'dealId', 'sfa_deals'], ['activity-create', 'contactId', 'sfa_contacts']]) await check(name + ' rejects empty ' + table + ' lock', async () => {
    const f = fixture({ emptyTable: table }); assert.equal((await f.invoke(name, { title: '作業', subject: '活動', [field]: 'related' })).status, 400);
    assert.equal(f.state.createdTasks.length + f.state.activities.length, 0);
  });
  for (const name of ['task-update', 'task-delete']) await check(name + ' rejects empty task lock before later row snapshot', async () => {
    const f = fixture({ emptyTable: 'sfa_tasks' }); assert.equal((await f.invoke(name)).status, 404); assert.equal(f.state.updates + f.state.deletes, 0);
  });
  await check('activity related locks ordered and held before creation', async () => {
    const f = fixture(); assert.equal((await f.invoke('activity-create', { subject: '活動', accountId: 'related', dealId: 'related', contactId: 'related' })).status, 200);
    assert.deepEqual(f.state.queries.map(q => q.table), ['sfa_members', 'sfa_accounts', 'sfa_deals', 'sfa_contacts']);
  });
  await check('activity failed deal update rolls back created activity', async () => {
    const f = fixture({ failActivityUpdate: true }); assert.equal((await f.invoke('activity-create', { subject: '活動', dealId: 'related' })).status, 500); assert.equal(f.state.activities.length, 0);
  });
  await check('legacy task toggles re-read status under exclusive lock', async () => {
    const f = fixture(); const responses = await Promise.all([f.invoke('task-update', {}), f.invoke('task-update', {})]);
    assert.ok(responses.every(r => r.status === 200)); assert.equal(f.state.task.status, 'open'); assert.equal(f.state.updates, 2);
  });
  console.log(JSON.stringify({ passed: cases.length, cases, scope: 'Actual four SFA mutation handlers and actual authority helper. Stateful synthetic auth/Prisma with transaction rollback and serialized task execution; SQL lock shape and ordering asserted. No real PostgreSQL scheduling, customer data, paid provider or private production operation. Client replay/version/scope issues remain separately open.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
