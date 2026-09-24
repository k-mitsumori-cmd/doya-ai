const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const createdAt = new Date('2026-09-24T00:00:00.000Z');
const rows = Array.from({ length: 123 }, (_, index) => ({
  id: String(index).padStart(4, '0'), userId: 'owner', guestId: null,
  title: index < 60 ? `検索対象 ${index}` : `通常 ${index}`,
  status: index % 2 ? 'EDITING' : 'DRAFT', createdAt, updatedAt: createdAt,
  intervieweeName: null, intervieweeRole: null, intervieweeCompany: null,
  genre: null, theme: null, thumbnailUrl: null,
  _count: { materials: 0, drafts: 0 }, drafts: [], transcriptions: [],
}));
rows.push({ ...rows[0], id: 'foreign', userId: 'other' });

function matches(row, where) {
  if (where.AND && !where.AND.every((part) => matches(row, part))) return false;
  if (where.OR && !where.OR.some((part) => matches(row, part))) return false;
  if (where.userId && row.userId !== where.userId) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.id?.lt && !(row.id < where.id.lt)) return false;
  if (where.createdAt?.lt && !(row.createdAt < where.createdAt.lt)) return false;
  if (where.createdAt instanceof Date && row.createdAt.getTime() !== where.createdAt.getTime()) return false;
  for (const field of ['title', 'intervieweeName', 'intervieweeCompany']) {
    if (where[field]?.contains && !(row[field] || '').toLowerCase().includes(where[field].contains.toLowerCase())) return false;
  }
  return true;
}
const prisma = { interviewProject: {
  findMany: async ({ where, orderBy, take }) => {
    assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(take, 51);
    return rows.filter((row) => matches(row, where)).sort((a, b) => b.id.localeCompare(a.id)).slice(0, take);
  },
  count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
  groupBy: async ({ where }) => {
    const groups = new Map();
    for (const row of rows.filter((item) => matches(item, where))) groups.set(row.status, (groups.get(row.status) || 0) + 1);
    return [...groups].map(([status, count]) => ({ status, _count: { _all: count } }));
  },
} };
const { GET } = load('src/app/api/interview/projects/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: 'owner' }), getGuestIdFromRequest: () => null,
    requireDatabase: () => null,
  },
}, { Buffer, console });

async function get(params) {
  const url = new URL('http://local/api/interview/projects');
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return GET({ nextUrl: url });
}
async function collect(params, expected) {
  const seen = new Set();
  let cursor = null;
  do {
    const response = await get({ ...params, cursor });
    if (response.status !== 200) console.error('Unexpected response', response.status, await response.clone().text());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalCount, 123);
    assert.equal(body.filteredCount, expected);
    assert.equal(body.statusCounts.DRAFT, 62);
    assert.equal(body.statusCounts.EDITING, 61);
    assert(body.projects.length <= 50);
    for (const row of body.projects) {
      assert.equal(row.id === 'foreign', false);
      assert.equal(seen.has(row.id), false, 'No duplicate across pages');
      seen.add(row.id);
    }
    cursor = body.nextCursor;
  } while (cursor);
  assert.equal(seen.size, expected);
}

(async () => {
  await collect({}, 123);
  await collect({ q: '検索対象' }, 60);
  await collect({ status: 'EDITING' }, 61);
  await collect({ q: '検索対象', status: 'EDITING' }, 30);
  assert.equal((await get({ cursor: 'invalid' })).status, 400);
  assert.equal((await get({ q: 'a'.repeat(101) })).status, 400);
  console.log('PASS Interview projects: pagination reaches 123, search and status span all pages, owner scope, malformed input rejected');
})().catch((error) => { console.error(error); process.exitCode = 1; });
