const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const writes = [];
const prisma = {
  sfaAccount: {
    create: async ({ data }) => { writes.push(['account', data]); return { id: 'account-1', ...data }; },
    findFirst: async ({ where }) => where.id === 'account-1' && where.organizationId === 'org-1' && where.isActive === true ? { id: 'account-1' } : null,
  },
  sfaContact: { create: async ({ data }) => { writes.push(['contact', data]); return { id: 'contact-1', ...data }; } },
  sfaLead: { create: async ({ data }) => { writes.push(['lead', data]); return { id: 'lead-1', ...data }; } },
};
const mocks = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1', memberId: 'member-1' }), orgSlugFrom: () => null },
  '@/lib/sfa/format': { bigIntToNumber: (value) => value },
  '@/lib/sfa/limits': { withSfaAdmission: async (_org, _requested, create) => ({ created: await create(prisma) }), sfaQuotaResponse: () => Response.json({ error: 'limit' }, { status: 402 }) },
};
const createAccount = load('src/app/api/sfa/accounts/route.ts', mocks).POST;
const createContact = load('src/app/api/sfa/contacts/route.ts', mocks).POST;
const createLead = load('src/app/api/sfa/leads/route.ts', mocks).POST;
const request = (body) => ({ json: async () => body });

(async () => {
  for (const body of [null, [], { name: 123 }, { name: '会社', industry: 123 }, { name: '会社', note: {} }]) {
    assert.equal((await createAccount(request(body))).status, 400, `account ${JSON.stringify(body)}`);
  }
  for (const body of [null, [], { name: 123 }, { name: '担当者', accountId: 123 },
    { name: '担当者', email: {} }, { name: '担当者', isKeyPerson: 'yes' },
    { name: '担当者', accountId: 'foreign' }]) {
    assert.equal((await createContact(request(body))).status, 400, `contact ${JSON.stringify(body)}`);
  }
  for (const body of [null, [], { name: 123 }, { name: 'リード', email: 123 },
    { name: 'リード', source: 'unknown' }, { name: 'リード', phone: {} }]) {
    assert.equal((await createLead(request(body))).status, 400, `lead ${JSON.stringify(body)}`);
  }
  assert.equal(writes.length, 0, 'Invalid input must not create a record');
  assert.equal((await createAccount(request({ name: ' 会社 ', industry: '製造業' }))).status, 200);
  assert.equal((await createContact(request({ name: ' 担当者 ', accountId: 'account-1', isKeyPerson: true }))).status, 200);
  assert.equal((await createLead(request({ name: ' リード ', source: 'manual' }))).status, 200);
  assert.deepEqual(writes.map(([type]) => type), ['account', 'contact', 'lead']);
  assert.equal(writes[0][1].name, '会社');
  assert.equal(writes[1][1].accountId, 'account-1');
  assert.equal(writes[2][1].source, 'manual');
  console.log('PASS SFA create input: malformed account, contact and lead fields rejected before writes');
})().catch((error) => { console.error(error); process.exitCode = 1; });
