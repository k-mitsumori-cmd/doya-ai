const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const timestamp = new Date('2026-09-24T00:00:00.000Z');
const accounts = Array.from({ length: 501 }, (_, index) => ({
  id: String(index).padStart(6, '0'), organizationId: 'org-1', isActive: true,
  name: index < 250 ? `検索対象 ${index}` : `通常 ${index}`, updatedAt: timestamp,
}));
accounts.push({ ...accounts[0], id: 'foreign', organizationId: 'org-2', name: 'foreign-secret' });
accounts.push({ ...accounts[0], id: 'inactive-account', isActive: false, name: '旧取引先' });
const contacts = Array.from({ length: 501 }, (_, index) => ({
  id: String(index).padStart(6, '0'), organizationId: 'org-1', isActive: true,
  name: index < 250 ? `検索対象 ${index}` : `通常 ${index}`, updatedAt: timestamp,
  accountId: index === 0 ? 'foreign' : index === 1 ? 'inactive-account' : '000001',
}));
contacts.push({ ...contacts[0], id: 'foreign-contact', organizationId: 'org-2' });

function matches(row, where) {
  if (where.AND && !where.AND.every((part) => matches(row, part))) return false;
  if (where.OR && !where.OR.some((part) => matches(row, part))) return false;
  if (where.organizationId && row.organizationId !== where.organizationId) return false;
  if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
  if (where.accountId && row.accountId !== where.accountId) return false;
  if (where.id?.lt && !(row.id < where.id.lt)) return false;
  if (where.id?.in && !where.id.in.includes(row.id)) return false;
  if (where.updatedAt?.lt && !(row.updatedAt < where.updatedAt.lt)) return false;
  if (where.updatedAt instanceof Date && row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
  if (where.name?.contains && !row.name.toLowerCase().includes(where.name.contains.toLowerCase())) return false;
  return true;
}
function model(rows, isAccount) {
  return {
    findMany: async ({ where, orderBy, take, select }) => {
      if (!orderBy) {
        assert(isAccount, 'Only accounts may be looked up by id');
        assert.equal(where.organizationId, 'org-1', 'Contact account names stay organization-scoped');
        return rows.filter((row) => matches(row, where));
      }
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ updatedAt: 'desc' }, { id: 'desc' }]);
      assert.equal(take, 201);
      const page = rows.filter((row) => matches(row, where)).sort((a, b) => b.id.localeCompare(a.id)).slice(0, take);
      if (select) {
        assert.deepEqual(JSON.parse(JSON.stringify(select)), { id: true, name: true, updatedAt: true });
        return page.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt }));
      }
      return page;
    },
    count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
  };
}
const prisma = { sfaAccount: model(accounts, true), sfaContact: model(contacts, false) };
const mocks = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => null },
  '@/lib/sfa/format': { bigIntToNumber: (value) => value },
};
const accountGet = load('src/app/api/sfa/accounts/route.ts', mocks).GET;
const contactGet = load('src/app/api/sfa/contacts/route.ts', mocks).GET;

async function collect(get, type, params, expected) {
  const seen = new Set();
  let cursor = null;
  do {
    const url = new URL(`http://local/api/sfa/${type}`);
    if (params.q) url.searchParams.set('q', params.q);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await get({ url: url.toString() });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalCount, expected);
    assert(body[type].length <= 200);
    for (const row of body[type]) {
      assert(!seen.has(row.id), 'Each record appears once');
      assert(!row.id.startsWith('foreign'));
      seen.add(row.id);
      if (type === 'contacts' && row.id === '000000') assert.equal(row.accountName, null, 'Foreign account name is hidden');
      if (type === 'contacts' && row.id === '000001') assert.equal(row.accountName, '旧取引先', 'Own inactive account name remains visible for history');
    }
    cursor = body.nextCursor;
  } while (cursor);
  assert.equal(seen.size, expected);
}

(async () => {
  for (const [get, type] of [[accountGet, 'accounts'], [contactGet, 'contacts']]) {
    await collect(get, type, {}, 501);
    await collect(get, type, { q: '検索対象' }, 250);
    assert.equal((await get({ url: `http://local/api/sfa/${type}?cursor=invalid` })).status, 400);
    assert.equal((await get({ url: `http://local/api/sfa/${type}?q=${'x'.repeat(101)}` })).status, 400);
  }
  const helper = load('src/lib/sfa/client.ts', {}, {
    URLSearchParams,
    fetch: async (path, init) => {
      assert.equal(init.headers['x-sfa-org'], 'org-1');
      assert.equal(new URL(path, 'http://local').searchParams.get('options'), '1');
      return accountGet({ url: new URL(path, 'http://local').toString() });
    },
  });
  const options = await helper.fetchAllSfaAccounts('org-1');
  assert.equal(options.length, 501);
  assert(options.some((row) => row.id === '000500'));

  const writes = [];
  const writePrisma = {
    sfaAccount: { findFirst: async ({ where }) => where.id === 'valid' && where.organizationId === 'org-1' && where.isActive === true ? { id: 'valid' } : null },
    sfaContact: { create: async ({ data }) => { writes.push(['contact', data]); return { id: 'contact', ...data }; } },
    sfaStage: { findFirst: async () => null },
    sfaDeal: {
      findUnique: async () => ({ id: 'deal', organizationId: 'org-1' }),
      create: async ({ data }) => { writes.push(['deal-create', data]); return { id: 'deal', accountId: data.accountId }; },
      update: async ({ data }) => { writes.push(['deal-update', data]); return { id: 'deal', accountId: data.accountId }; },
    },
  };
  const writeMocks = {
    ...mocks,
    '@/lib/prisma': { prisma: writePrisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1', memberId: 'member', userId: 'owner' }), orgSlugFrom: () => null },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
  };
  const createContact = load('src/app/api/sfa/contacts/route.ts', writeMocks).POST;
  const createDeal = load('src/app/api/sfa/deals/route.ts', writeMocks).POST;
  const updateDeal = load('src/app/api/sfa/deals/[id]/route.ts', writeMocks).PATCH;
  const ctx = { params: Promise.resolve({ id: 'deal' }) };
  for (const accountId of ['foreign', 'inactive', 'missing']) {
    const request = () => ({ json: async () => ({ name: 'テスト', accountId }) });
    assert.equal((await createContact(request())).status, 400);
    assert.equal((await createDeal(request())).status, 400);
    assert.equal((await updateDeal(request(), ctx)).status, 400);
  }
  assert.equal(writes.length, 0, 'Invalid accounts cannot be silently discarded or written');
  const validRequest = () => ({ json: async () => ({ name: 'テスト', accountId: 'valid' }) });
  assert.equal((await createContact(validRequest())).status, 200);
  assert.equal((await createDeal(validRequest())).status, 200);
  assert.equal((await updateDeal(validRequest(), ctx)).status, 200);
  assert(writes.every(([, data]) => data.accountId === 'valid'));
  console.log('PASS SFA CRM: 501 accounts and contacts reachable, full dropdown options, search, owner-scoped account names, invalid accounts rejected');
})().catch((error) => { console.error(error); process.exitCode = 1; });
