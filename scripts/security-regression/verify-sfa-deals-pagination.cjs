const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const timestamp = new Date('2026-09-24T00:00:00.000Z');

async function verifyCount(count) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(4, '0'),
    organizationId: 'org-1',
    isActive: true,
    stageId: 'stage-1',
    accountId: null,
    amount: index === 0 ? 1000000n : 100n,
    status: index === 0 ? 'won' : 'open',
    probability: 50,
    updatedAt: timestamp,
  }));
  const foreign = { ...rows[0], id: 'foreign', organizationId: 'org-2', amount: 9000000n };
  const allRows = [...rows, foreign];
  const active = allRows.filter((row) => row.organizationId === 'org-1' && row.isActive);
  const targetDealId = rows[count - 1]?.id;
  const taskRows = targetDealId ? [
    ...Array.from({ length: 250 }, (_, index) => ({ id: `old-${index}`, dealId: 'other-deal', organizationId: 'org-1', status: 'open' })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: `target-${index}`, dealId: targetDealId, organizationId: 'org-1', status: 'open' })),
    { id: 'completed', dealId: targetDealId, organizationId: 'org-1', status: 'done' },
    { id: 'foreign-task', dealId: targetDealId, organizationId: 'org-2', status: 'open' },
  ] : [];
  let listQueries = 0;
  let groupQueries = 0;
  const prisma = {
    sfaDeal: {
      findMany: async ({ where, orderBy, take }) => {
        listQueries++;
        assert.equal(where.organizationId, 'org-1');
        assert.equal(where.isActive, true);
        assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ updatedAt: 'desc' }, { id: 'desc' }]);
        assert.equal(take, 101);
        const cursorId = where.OR?.[1]?.id?.lt;
        return active.filter((row) => !cursorId || row.id < cursorId)
          .sort((a, b) => b.id.localeCompare(a.id)).slice(0, take);
      },
      groupBy: async ({ where, by }) => {
        groupQueries++;
        assert.equal(where.organizationId, 'org-1');
        assert.deepEqual(JSON.parse(JSON.stringify(by)), ['stageId']);
        return [{ stageId: 'stage-1', _count: { _all: active.length },
          _sum: { amount: active.reduce((sum, row) => sum + row.amount, 0n) } }];
      },
    },
    sfaAccount: { findMany: async () => [] },
    sfaTask: { groupBy: async ({ where, by }) => {
      assert.equal(where.organizationId, 'org-1');
      assert.deepEqual(JSON.parse(JSON.stringify(by)), ['dealId']);
      const matches = taskRows.filter((task) => task.organizationId === where.organizationId &&
        where.dealId.in.includes(task.dealId) && task.status !== 'done');
      const counts = new Map();
      for (const task of matches) counts.set(task.dealId, (counts.get(task.dealId) || 0) + 1);
      return [...counts].map(([dealId, number]) => ({ dealId, _count: { _all: number } }));
    } },
  };
  const { GET } = load('src/app/api/sfa/deals/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => null, ensurePipeline: async () => [{ id: 'stage-1' }] },
    '@/lib/sfa/format': { bigIntToNumber: (value) => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? Number(item) : item)) },
    '@/lib/sfa/amount': load('src/lib/sfa/amount.ts'),
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    '@/lib/sfa/limits': { withSfaAdmission: async () => { throw Error('GET must not admit quota') }, sfaQuotaResponse: () => Response.json({}, { status: 402 }) },
  }, { Buffer });

  const seen = new Set();
  let cursor = null;
  let pages = 0;
  do {
    const url = 'http://local/api/sfa/deals' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
    const response = await GET({ url });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalCount, count);
    assert.equal(body.stageSummary[0].count, count);
    assert.equal(body.stageSummary[0].total, String(count ? 1000000 + (count - 1) * 100 : 0));
    assert(body.deals.length <= 100);
    for (const deal of body.deals) {
      assert(!seen.has(deal.id), 'Each deal is returned once');
      assert.notEqual(deal.id, 'foreign');
      assert.equal(deal.openTaskCount, deal.id === targetDealId ? 7 : 0);
      seen.add(deal.id);
    }
    cursor = body.nextCursor;
    pages++;
  } while (cursor);
  assert.equal(seen.size, count);
  assert.equal(pages, Math.max(1, Math.ceil(count / 100)));
  assert.equal(listQueries, pages);
  assert.equal(groupQueries, pages);
  const malformed = await GET({ url: 'http://local/api/sfa/deals?cursor=invalid' });
  assert.equal(malformed.status, 400);
}

(async () => {
  for (const count of [0, 99, 100, 101, 499, 500, 501]) await verifyCount(count);
  console.log('PASS SFA deals: all 501 records reachable, totals include every record, foreign scope excluded, invalid cursor rejected');
})().catch((error) => { console.error(error); process.exitCode = 1; });
