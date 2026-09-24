const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const occurredAt = new Date('2026-09-24T00:00:00.000Z');
const rows = Array.from({ length: 501 }, (_, index) => ({
  id: String(index).padStart(6, '0'), organizationId: 'org-1',
  accountId: index < 250 ? 'account-1' : 'account-2',
  dealId: index < 250 ? 'deal-1' : 'deal-2',
  occurredAt: index < 10 ? new Date('2026-09-25T00:00:00.000Z') : index >= 491 ? new Date('2026-09-23T00:00:00.000Z') : occurredAt,
}));
rows.push({ ...rows[0], id: 'foreign', organizationId: 'org-2' });

function matches(row, where) {
  if (where.AND && !where.AND.every((part) => matches(row, part))) return false;
  if (where.OR && !where.OR.some((part) => matches(row, part))) return false;
  if (where.organizationId && row.organizationId !== where.organizationId) return false;
  if (where.accountId && row.accountId !== where.accountId) return false;
  if (where.dealId && row.dealId !== where.dealId) return false;
  if (where.occurredAt?.lt && !(row.occurredAt < where.occurredAt.lt)) return false;
  if (where.occurredAt instanceof Date && row.occurredAt.getTime() !== where.occurredAt.getTime()) return false;
  if (where.id?.lt && !(row.id < where.id.lt)) return false;
  return true;
}

const prisma = { sfaActivity: {
  findMany: async ({ where, orderBy, take }) => {
    assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ occurredAt: 'desc' }, { id: 'desc' }]);
    assert.equal(take, 201);
    return rows.filter((row) => matches(row, where)).sort((a, b) =>
      b.occurredAt - a.occurredAt || b.id.localeCompare(a.id)).slice(0, take);
  },
  count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
} };

const { GET } = load('src/app/api/sfa/activities/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => null },
});

async function collect(params, expected) {
  const ids = new Set();
  let cursor = null;
  let lastKey = null;
  do {
    const url = new URL('http://local/api/sfa/activities');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await GET({ url: url.toString() });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalCount, expected);
    assert(body.activities.length <= 200);
    for (const row of body.activities) {
      assert(!ids.has(row.id), 'No duplicate at the page boundary');
      assert.notEqual(row.id, 'foreign');
      const key = [new Date(row.occurredAt).getTime(), row.id];
      if (lastKey) assert(lastKey[0] > key[0] || (lastKey[0] === key[0] && lastKey[1] > key[1]), 'Stable date and ID order');
      if (params.accountId) assert.equal(row.accountId, params.accountId);
      if (params.dealId) assert.equal(row.dealId, params.dealId);
      ids.add(row.id);
      lastKey = key;
    }
    cursor = body.nextCursor;
  } while (cursor);
  assert.equal(ids.size, expected);
}

(async () => {
  await collect({}, 501);
  await collect({ accountId: 'account-1' }, 250);
  await collect({ dealId: 'deal-2' }, 251);
  assert.equal((await GET({ url: 'http://local/api/sfa/activities?cursor=bad' })).status, 400);
  console.log('PASS SFA activities: all 501 reachable with stable ties, scoped account/deal pages and malformed cursor rejected');
})().catch((error) => { console.error(error); process.exitCode = 1; });
