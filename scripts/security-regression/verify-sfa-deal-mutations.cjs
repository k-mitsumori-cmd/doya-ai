const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
const receipt = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': crypto, './mutation-authority': authority });
const amount = load('src/lib/sfa/amount.ts');
const helper = load('src/lib/sfa/deal-mutation.ts', { './amount': amount, './mutation-authority': authority });
const stamp = new Date('2026-10-07T00:00:00.000Z'), op = 'f1536c85-32e5-46f6-919a-8bc55a5a92fb';
const results = [];
async function check(name, fn) { await fn(); results.push(name); console.log('PASS ' + name); }
function fixture() {
  let active = true, actor = 'actor', org = 'org', failReceipt = false, usage = 0, id = 0, queue = Promise.resolve();
  let rows = new Map(), receipts = new Map();
  const stages = new Map(['open', 'won', 'lost'].map((name, order) => [name, { id: name, pipelineId: 'pipeline', name, order, probability: order === 1 ? 100 : 0, isWon: name === 'won', isLost: name === 'lost', pipeline: { organizationId: 'org' } }]));
  const find = where => [...rows.values()].find(r => Object.entries(where).every(([k, v]) => r[k] === v)) || null;
  const db = {
    sfaMember: { findFirst: async ({ where }) => where.id ? active && where.userId === actor && where.organizationId === org ? { id: 'member' } : null : { userId: 'owner' }, count: async () => 2 },
    user: { findUnique: async () => ({ plan: 'FREE' }) },
    sfaAccount: { count: async () => 0, findFirst: async ({ where }) => where.id === 'account' && where.organizationId === 'org' ? { id: 'account', name: 'Synthetic account' } : null },
    sfaStage: { findUnique: async ({ where }) => stages.get(where.id), findMany: async () => [...stages.values()] },
    sfaLineItem: { findMany: async () => [] }, sfaActivity: { findMany: async () => [] },
    systemSetting: { findUnique: async ({ where }) => receipts.get(where.key) || null, create: async ({ data }) => { if (failReceipt) throw Error('secret database failure'); receipts.set(data.key, data); return data; } },
    sfaDeal: {
      count: async ({ where }) => [...rows.values()].filter(r => r.organizationId === where.organizationId && r.isActive).length,
      findFirst: async ({ where }) => find(where),
      findUnique: async ({ where }) => rows.get(where.id) || null,
      create: async ({ data }) => { const row = { id: 'deal-' + (++id), createdAt: stamp, updatedAt: stamp, isActive: true, contactName: null, note: null, lostReason: null, expectedCloseDate: null, ...data }; rows.set(row.id, row); return row; },
      update: async ({ where, data }) => { const row = { ...rows.get(where.id), ...data }; rows.set(row.id, row); return row; },
    },
    $executeRaw: async () => 1,
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('sfa_members')) return active && values[1] === org && values[2] === actor ? [{ id: 'member' }] : [];
      if (sql.includes('sfa_accounts')) return values[0] === 'account' && values[1] === 'org' ? [{ id: 'account' }] : [];
      if (sql.includes('sfa_stages')) return values.length === 1 ? [{ id: 'open' }] : stages.has(values[0]) && values[1] === 'org' ? [{ id: values[0] }] : [];
      if (sql.includes('sfa_deals')) { const row = rows.get(values[0]); return row && row.organizationId === values[1] ? [{ id: row.id }] : []; }
      throw Error('Unexpected SQL ' + sql);
    },
  };
  db.$transaction = fn => {
    const result = queue.then(async () => { const savedRows = structuredClone(rows), savedReceipts = structuredClone(receipts); try { return await fn(db); } catch (e) { rows = savedRows; receipts = savedReceipts; throw e; } });
    queue = result.catch(() => {}); return result;
  };
  const limits = load('src/lib/sfa/limits.ts', { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, '@/lib/plan-utils': { tierFrom: () => 'FREE' } });
  const mocks = { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: org, userId: actor, memberId: 'member' }), orgSlugFrom: () => 'alpha' }, '@/lib/sfa/format': load('src/lib/sfa/format.ts'), '@/lib/sfa/deal-mutation': helper, '@/lib/sfa/mutation-authority': authority, '@/lib/sfa/creation-receipt': receipt, '@/lib/sfa/limits': limits, '@/lib/service-usage': { recordServiceUsage: async () => { usage++; } } };
  const collection = load('src/app/api/sfa/deals/route.ts', mocks), detail = load('src/app/api/sfa/deals/[id]/route.ts', mocks);
  const req = (body, query = '') => ({ url: 'https://example.invalid/api/sfa/deals' + query, json: async () => body });
  const ctx = id => ({ params: Promise.resolve({ id }) });
  return { rows: () => rows, receipts: () => receipts, usage: () => usage, active: v => active = v, actor: v => actor = v, org: v => org = v, failReceipt: v => failReceipt = v,
    post: body => collection.POST(req(body)), recover: () => collection.GET(req(null, '?operationId=' + op)), cancel: () => collection.DELETE(req(null, '?operationId=' + op)),
    patch: (id, body) => detail.PATCH(req(body), ctx(id)), remove: (id, version) => detail.DELETE(req(null, version ? '?expectedUpdatedAt=' + encodeURIComponent(version) : ''), ctx(id)), get: (id, recovery = false) => detail.GET(req(null, recovery ? '?recovery=1' : ''), ctx(id)),
  };
}
(async () => {
  await check('20 deal replays create once, usage once and full-quota replay still returns committed row', async () => {
    const f = fixture(); for (let i = 0; i < 49; i++) assert.equal((await f.post({ name: 'Seed ' + i })).status, 200);
    const rs = await Promise.all(Array.from({ length: 20 }, () => f.post({ name: 'Replay', amount: '1.6', operationId: op })));
    assert.ok(rs.every(r => r.status === 200)); assert.equal(new Set(await Promise.all(rs.map(async r => (await r.json()).deal.id))).size, 1);
    assert.equal(f.rows().size, 50); assert.equal(f.usage(), 50); assert.equal((await f.post({ name: 'Over quota' })).status, 402);
    assert.equal((await f.post({ name: 'Changed', operationId: op })).status, 409);
  });
  await check('Cancelled missing deal operation permanently fences late creation without business deletion', async () => {
    const f = fixture(); assert.equal((await (await f.recover()).json()).state, 'missing'); assert.equal((await (await f.cancel()).json()).state, 'cancelled');
    assert.equal((await f.post({ name: 'Late', operationId: op })).status, 409); assert.equal(f.rows().size, 0); assert.equal((await (await f.recover()).json()).state, 'cancelled');
  });
  await check('Committed and subsequently deleted deal retains receipt without resurrection or cancellation deletion', async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Saved', operationId: op })).json()).deal;
    assert.equal((await (await f.cancel()).json()).state, 'found'); assert.equal(f.rows().get(row.id).isActive, true);
    assert.equal((await f.remove(row.id, row.updatedAt)).status, 200); assert.equal((await (await f.recover()).json()).state, 'unavailable');
    assert.equal((await (await f.cancel()).json()).state, 'unavailable'); assert.equal((await f.post({ name: 'Saved', operationId: op })).status, 409); assert.equal(f.rows().size, 1);
  });
  await check('Receipt failure rolls back deal creation and hides internal failure details', async () => {
    const f = fixture(); f.failReceipt(true); const r = await f.post({ name: 'Rollback', operationId: op }); assert.equal(r.status, 500); assert.ok(!(await r.text()).includes('secret')); assert.equal(f.rows().size, 0); assert.equal(f.receipts().size, 0);
    f.failReceipt(false); assert.equal((await f.post({ name: 'Rollback', operationId: op })).status, 200);
  });
  for (const action of ['post', 'patch', 'remove', 'recover', 'cancel', 'get']) await check('Revoked actor denied inside transaction: ' + action, async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Initial' })).json()).deal; f.active(false);
    const r = await ({ post: () => f.post({ name: 'Denied', operationId: op }), patch: () => f.patch(row.id, { name: 'Denied' }), remove: () => f.remove(row.id), recover: () => f.recover(), cancel: () => f.cancel(), get: () => f.get(row.id) })[action]();
    assert.equal(r.status, 403); assert.equal(f.rows().size, 1); assert.equal(f.rows().get(row.id).name, 'Initial'); assert.equal(f.rows().get(row.id).isActive, true);
  });
  await check('Stage transitions clear opposite timestamps, preserve same-outcome timestamp and bump monotonic versions', async () => {
    const f = fixture(); let row = (await (await f.post({ name: 'Stages', stageId: 'won' })).json()).deal; assert.ok(row.wonAt); assert.equal(row.lostAt, null);
    const originalWon = row.wonAt;
    const same = await f.patch(row.id, { stageId: 'won', expectedUpdatedAt: row.updatedAt }); row = (await same.json()).deal; assert.equal(row.wonAt, originalWon);
    const before = row.updatedAt; row = (await (await f.patch(row.id, { stageId: 'lost', expectedUpdatedAt: before })).json()).deal; assert.equal(row.wonAt, null); assert.ok(row.lostAt); assert.ok(row.updatedAt > before);
    row = (await (await f.patch(row.id, { stageId: 'open', expectedUpdatedAt: row.updatedAt })).json()).deal; assert.equal(row.status, 'open'); assert.equal(row.wonAt, null); assert.equal(row.lostAt, null);
  });
  await check('Two same-version updates allow one; stale delete cannot hide newer data', async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Initial' })).json()).deal;
    const rs = await Promise.all(['First', 'Second'].map(name => f.patch(row.id, { name, expectedUpdatedAt: row.updatedAt })));
    assert.deepEqual(rs.map(r => r.status).sort(), [200, 409]); assert.equal((await f.remove(row.id, row.updatedAt)).status, 409); assert.equal(f.rows().get(row.id).isActive, true);
  });
  await check('Soft-deleted and foreign deals reject updates and expose only scoped read-only absence', async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Initial' })).json()).deal; await f.remove(row.id);
    assert.equal((await f.patch(row.id, { name: 'Hidden' })).status, 404); assert.equal((await f.get(row.id)).status, 404); assert.equal((await (await f.get(row.id, true)).json()).state, 'missing');
    f.org('foreign'); assert.equal((await f.patch(row.id, { name: 'Foreign' })).status, 404);
  });
  for (const [key, max] of [['name', 200], ['contactName', 100], ['note', 5000], ['lostReason', 300]]) await check('Reject overlong ' + key + ' without truncation; exact boundary persists', async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Initial' })).json()).deal;
    assert.equal((await f.patch(row.id, { [key]: 'x'.repeat(max + 1) })).status, 400); assert.equal(f.rows().get(row.id).name, 'Initial');
    assert.equal((await f.patch(row.id, { [key]: 'x'.repeat(max) })).status, 200); assert.equal(f.rows().get(row.id)[key].length, max);
    if (key === 'name') assert.equal((await f.post({ name: 'x'.repeat(max + 1) })).status, 400);
  });
  await check('Malformed date, unknown fields, invalid amount, invalid related IDs and version fail before write', async () => {
    const f = fixture(); const row = (await (await f.post({ name: 'Initial' })).json()).deal;
    for (const body of [{ startDate: '2026-02-30' }, { expectedCloseDate: '2026-01-01junk' }, { note: 5 }, { probability: '1e2' }, { amount: '1e309' }, { organizationId: 'foreign' }, { expectedUpdatedAt: 'bad', name: 'Wrong' }, { stageId: 'foreign' }, { accountId: 'foreign' }]) assert.equal((await f.patch(row.id, body)).status, 400);
    assert.equal(f.rows().get(row.id).name, 'Initial'); assert.equal(f.rows().get(row.id).updatedAt.getTime(), stamp.getTime());
  });
  await check('Actor/organization isolate creation receipts and all handled responses are private', async () => {
    const f = fixture(); const first = await f.post({ name: 'Scoped', operationId: op }); assert.equal(first.status, 200);
    for (const response of [first, await f.recover(), await f.cancel(), await f.get('absent', true), await f.patch('absent', { name: 'No' })]) { assert.match(response.headers.get('cache-control'), /private.*no-store/); assert.match(response.headers.get('vary'), /Cookie/); }
    f.actor('another'); assert.equal((await (await f.recover()).json()).state, 'missing'); f.org('foreign'); assert.equal((await (await f.recover()).json()).state, 'missing');
  });
  const sources = ['src/app/api/sfa/deals/route.ts', 'src/app/api/sfa/deals/[id]/route.ts', 'src/lib/sfa/deal-mutation.ts', 'src/lib/sfa/creation-receipt.ts', 'src/lib/sfa/mutation-authority.ts', 'src/lib/sfa/limits.ts'];
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-deal-mutation-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: results.length, cases: results, sourceHashes: Object.fromEntries(sources.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Actual deal API handlers, receipt/authority/validation and quota admission helpers; synthetic auth/Prisma with serialized rollback fixture. No live customer writes/provider requests. Actual PostgreSQL lock scheduling and real browser/private production remain unproven.' }, null, 2) + '\n');
})().catch(e => { console.error(e); process.exitCode = 1; });
