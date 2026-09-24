const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const updatedAt = new Date('2026-09-24T00:00:00.000Z');
const rows = Array.from({ length: 501 }, (_, index) => ({
  id: String(index).padStart(6, '0'), organizationId: 'org-1', isActive: true,
  name: index < 250 ? `検索対象 ${index}` : `通常 ${index}`,
  status: index % 2 ? 'working' : 'new', score: index % 3 === 0 ? 100 : index % 3 === 1 ? 50 : null,
  updatedAt,
}));
rows.push({ ...rows[0], id: 'foreign', organizationId: 'org-2', name: 'foreign-secret' });
function matches(row, where) {
  if (where.AND && !where.AND.every((part) => matches(row, part))) return false;
  if (where.OR && !where.OR.some((part) => matches(row, part))) return false;
  if (where.organizationId && row.organizationId !== where.organizationId) return false;
  if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.name?.contains && !row.name.toLowerCase().includes(where.name.contains.toLowerCase())) return false;
  if (where.score === null && row.score !== null) return false;
  if (typeof where.score === 'number' && row.score !== where.score) return false;
  if (where.score?.lt !== undefined && !(row.score !== null && row.score < where.score.lt)) return false;
  if (where.updatedAt?.lt && !(row.updatedAt < where.updatedAt.lt)) return false;
  if (where.updatedAt instanceof Date && row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
  if (where.id?.lt && !(row.id < where.id.lt)) return false;
  return true;
}
let pageCalls = 0;
const prisma = { sfaLead: {
  findMany: async ({ where, orderBy, take }) => {
    assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ score: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }, { id: 'desc' }]);
    assert.equal(take, 201);
    pageCalls++;
    return rows.filter((row) => matches(row, where)).sort((a, b) => {
      if (a.score === null && b.score !== null) return 1;
      if (a.score !== null && b.score === null) return -1;
      if (a.score !== b.score) return b.score - a.score;
      return b.id.localeCompare(a.id);
    }).slice(0, take);
  },
  count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
} };
const { GET } = load('src/app/api/sfa/leads/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => null },
  '@/lib/sfa/format': { bigIntToNumber: (value) => value },
});
async function collect(params, expected) {
  const seen = new Set();
  let cursor = null;
  let lastKey = null;
  do {
    const url = new URL('http://local/api/sfa/leads');
    if (params.q) url.searchParams.set('q', params.q);
    if (params.status) url.searchParams.set('status', params.status);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await GET({ url: url.toString() });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalCount, expected);
    assert(body.leads.length <= 200);
    for (const row of body.leads) {
      assert(!seen.has(row.id), 'No duplicated lead across pages');
      assert.notEqual(row.id, 'foreign');
      const key = [row.score === null ? -1 : row.score, row.id];
      if (lastKey) assert(lastKey[0] > key[0] || (lastKey[0] === key[0] && lastKey[1] > key[1]), 'Score and ID order preserved');
      lastKey = key;
      seen.add(row.id);
    }
    cursor = body.nextCursor;
  } while (cursor);
  assert.equal(seen.size, expected);
}
(async () => {
  await collect({}, 501);
  await collect({ q: '検索対象' }, 250);
  await collect({ status: 'working' }, 250);
  await collect({ status: 'working', q: '検索対象' }, 125);
  assert.equal((await GET({ url: 'http://local/api/sfa/leads?cursor=invalid' })).status, 400);
  assert.equal((await GET({ url: 'http://local/api/sfa/leads?status=invalid' })).status, 400);
  assert.equal((await GET({ url: `http://local/api/sfa/leads?q=${'x'.repeat(101)}` })).status, 400);
  assert.equal(pageCalls, 8);
  console.log('PASS SFA leads: all 501 reachable in score order including nulls, filtered search spans pages, foreign scope excluded');
})().catch((error) => { console.error(error); process.exitCode = 1; });
