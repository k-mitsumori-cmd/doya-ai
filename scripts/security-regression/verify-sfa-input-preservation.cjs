const { withSfaAuthority } = require('./sfa-authority-fixture.cjs');
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let saved = [], relationReads = 0, transactions = 0;
const prisma = {
  sfaTask: { create: async ({ data }) => { saved.push(data); return { id: 'task', ...data }; } },
  sfaDeal: { findFirst: async () => { relationReads++; return { id: 'deal' }; } },
  $transaction: async fn => { transactions++; return fn({ sfaActivity: { create: async ({ data }) => { saved.push(data); return { id: 'activity', ...data }; } } }); },
};
const mocks = {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org', memberId: 'member' }), orgSlugFrom: () => 'org' },
};
const task = load('src/app/api/sfa/tasks/route.ts', withSfaAuthority(mocks));
const activity = load('src/app/api/sfa/activities/route.ts', withSfaAuthority(mocks));
const req = body => ({ json: async () => body });
(async () => {
  let cases = 0;
  const rejects = async (route, body) => {
    const before = [saved.length, relationReads, transactions];
    assert.equal((await route.POST(req(body))).status, 400);
    assert.deepEqual([saved.length, relationReads, transactions], before, 'invalid input must stop before relation reads and writes');
    cases++;
  };
  await rejects(task, { title: '名'.repeat(201), dealId: 'deal' });
  for (const body of [null, [], 'text', { subject: 3 }, { body: [] }, { subject: '件'.repeat(201) }, { body: '文'.repeat(4001) }]) await rejects(activity, body);
  for (const type of [null, 1, '', 'unknown', 'NOTE']) await rejects(activity, { subject: '記録', type });
  for (const occurredAt of [null, 1, '', 'invalid-date', '2026-02-30', '2026-02-29T10:00:00Z', '2026-09-23T24:00:00Z', '2026-09-23T20:08:00', '2026-09-23T20:60:00Z']) await rejects(activity, { subject: '記録', occurredAt });
  const thrown = await activity.POST({ json: async () => { throw Error('malformed JSON'); } });
  assert.equal(thrown.status, 400); cases++;
  const title = 'タ'.repeat(200);
  assert.equal((await task.POST(req({ title }))).status, 200);
  assert.equal(saved.at(-1).title, title); cases++;
  const subject = '件'.repeat(200), body = '文'.repeat(4000);
  for (const type of ['call', 'meeting', 'email', 'note']) {
    const response = await activity.POST(req({ type, subject, body, occurredAt: '2026-09-23T20:08:46+09:00' }));
    assert.equal(response.status, 200);
    const row = saved.at(-1); assert.equal(row.type, type); assert.equal(row.subject, subject); assert.equal(row.body, body);
    assert.equal(row.occurredAt.toISOString(), '2026-09-23T11:08:46.000Z'); cases++;
  }
  for (const date of ['2024-02-29', '2026-09-23T11:08:46.000Z']) {
    assert.equal((await activity.POST(req({ subject: '活動', occurredAt: date }))).status, 200);
    assert.equal(saved.at(-1).occurredAt.toISOString(), new Date(date).toISOString()); cases++;
  }
  const before = Date.now();
  assert.equal((await activity.POST(req({ subject: '  メモ  ' }))).status, 200);
  const row = saved.at(-1); assert.equal(row.type, 'note'); assert.equal(row.subject, 'メモ');
  assert.ok(row.occurredAt.getTime() >= before && row.occurredAt.getTime() <= Date.now()); cases++;
  const definitions = {
    accounts: { name: 200, industry: 80, prefecture: 40, url: 300, note: 2000 },
    contacts: { name: 80, title: 80, department: 80, email: 200, phone: 40, note: 2000 },
    leads: { name: 200, corporateNumber: 20, contactName: 80, email: 200, phone: 40, note: 2000 },
  };
  for (const [collection, fields] of Object.entries(definitions)) {
    let collectionSaved = [], admissions = 0;
    const model = { accounts: 'sfaAccount', contacts: 'sfaContact', leads: 'sfaLead' }[collection];
    const collectionPrisma = { [model]: { create: async ({ data }) => { collectionSaved.push(data); return { id: 'synthetic', ...data }; } } };
    const route = load(`src/app/api/sfa/${collection}/route.ts`, {
      ...mocks, '@/lib/prisma': { prisma: collectionPrisma },
      '@/lib/sfa/format': load('src/lib/sfa/format.ts'),
      '@/lib/sfa/limits': { withSfaAdmission: async (_org, _counts, create) => { admissions++; return { created: await create(collectionPrisma) }; } },
    });
    for (const [field, limit] of Object.entries(fields)) {
      const before = [collectionSaved.length, admissions];
      const failure = await route.POST(req({ name: 'synthetic', [field]: 'x'.repeat(limit + 1) }));
      assert.equal(failure.status, 400, `${collection}.${field} rejects excess`);
      assert.deepEqual([collectionSaved.length, admissions], before, 'invalid inputs must stop before admission and writes'); cases++;
      const value = 'x'.repeat(limit);
      assert.equal((await route.POST(req({ name: 'synthetic', [field]: value }))).status, 200);
      assert.equal(collectionSaved.at(-1)[field], value, `${collection}.${field} boundary content must be stored intact`); cases++;
    }
  }
  console.log(JSON.stringify({ passed: cases, scope: 'Actual SFA task/activity/account/contact/lead POST routes with synthetic auth, Prisma and account admission. Exact boundary content and explicit timestamps preserved; invalid inputs rejected before all reads/writes. Does not verify client lifecycle, real database, production or concurrency.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
