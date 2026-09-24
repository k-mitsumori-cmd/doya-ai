const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(type, count, failure = null) {
  const createdAt = new Date('2026-09-01T00:00:00.000Z');
  const rows = Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(6, '0'), organizationId: 'org-1', isActive: true, createdAt,
    name: index === 0 ? '=unsafe' : `record-${index}`,
    industry: null, prefecture: null, address: null, url: null, corporateNumber: null,
    employeeCount: null, creditRank: null,
    accountId: index === 0 ? 'account-1' : null, stageId: index === 0 ? 'stage-1' : null,
    amount: index === count - 1 ? 9007199254740993n : 1n, probability: 50, status: 'open',
    expectedCloseDate: null, updatedAt: createdAt,
  }));
  rows.push({ ...rows[0], id: 'foreign', organizationId: 'org-2', name: 'foreign-secret' });
  let pageCalls = 0;
  const model = {
    findFirst: async ({ where }) => {
      assert.equal(where.organizationId, 'org-1');
      return count ? { id: rows[count - 1].id } : null;
    },
    findMany: async ({ where, orderBy, take }) => {
      pageCalls++;
      if (failure === 'first' && pageCalls === 1) throw new Error('database unavailable');
      if (failure === 'later' && pageCalls === 2) throw new Error('database unavailable');
      assert.equal(where.organizationId, 'org-1');
      assert.equal(where.isActive, true);
      assert(where.createdAt.lte instanceof Date);
      assert.equal(orderBy.id, 'asc');
      assert.equal(take, 500);
      return rows.filter((row) => row.organizationId === 'org-1'
        && row.id <= where.id.lte && (!where.id.gt || row.id > where.id.gt)).slice(0, take);
    },
  };
  const prisma = {
    sfaAccount: type === 'accounts' ? model : {
      findMany: async ({ where }) => {
        assert.equal(where.organizationId, 'org-1');
        return [{ id: 'account-1', name: '取引先' }];
      },
    },
    sfaDeal: type === 'deals' ? model : {},
    sfaStage: { findMany: async ({ where }) => {
      assert.equal(where.pipeline.organizationId, 'org-1');
      return [{ id: 'stage-1', name: '商談中' }];
    } },
  };
  const { GET } = load('src/app/api/sfa/export/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => null },
  }, { TextEncoder, ReadableStream });
  return { GET: () => GET({ url: `http://local/api/sfa/export?type=${type}` }), getPageCalls: () => pageCalls };
}

(async () => {
  for (const type of ['accounts', 'deals']) {
    const f = fixture(type, 5001);
    const response = await f.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /sfa_(accounts|deals)\.csv/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [239, 187, 191], 'UTF-8 BOM is present');
    const csv = new TextDecoder().decode(bytes);
    assert.equal(csv.trimEnd().split('\r\n').length, 5002, `${type} exports header plus all 5001 records`);
    assert(!csv.includes('foreign-secret'));
    assert(csv.includes("'=unsafe"), 'Formula-like input remains escaped');
    if (type === 'deals') {
      assert(csv.includes('9007199254740993'), 'Large yen amount stays exact');
      assert(csv.includes('取引先'));
      assert(csv.includes('商談中'));
    }
    assert.equal(f.getPageCalls(), 11);
  }
  for (const type of ['accounts', 'deals']) {
    const firstFailure = fixture(type, 501, 'first');
    assert.equal((await firstFailure.GET()).status, 503, 'First-page failure is not a successful CSV');
    const laterFailure = fixture(type, 501, 'later');
    const response = await laterFailure.GET();
    assert.equal(response.status, 200);
    await assert.rejects(response.text(), /CSV出力を完了できませんでした/, 'Later failure aborts the download');
  }
  const empty = await fixture('accounts', 0).GET();
  assert.equal((await empty.text()).trimEnd().split('\r\n').length, 1);
  console.log('PASS SFA CSV: 5001 accounts and deals exported, tenant scope and exact yen preserved, failures do not return completed CSV');
})().catch((error) => { console.error(error); process.exitCode = 1; });
