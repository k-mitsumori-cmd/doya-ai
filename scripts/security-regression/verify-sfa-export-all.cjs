const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(type, count, failure = null, initialRole = 'admin', databaseRole = initialRole) {
  const createdAt = new Date('2026-09-01T00:00:00.000Z');
  const rows = Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(6, '0'), organizationId: 'org-1', isActive: true, createdAt,
    name: index === 0 ? '=unsafe' : index === 1 ? ' \t=unsafe' : `record-${index}`,
    industry: null, prefecture: null, address: null, url: null, corporateNumber: null,
    employeeCount: null, creditRank: null,
    accountId: index === 0 ? 'account-1' : null, stageId: index === 0 ? 'stage-1' : null,
    amount: index === count - 1 ? 9007199254740993n : 1n, probability: 50, status: 'open',
    expectedCloseDate: null, updatedAt: createdAt,
  }));
  rows.push({ ...rows[0], id: 'foreign', organizationId: 'org-2', name: 'foreign-secret' });
  let currentRole = databaseRole, ceiling = null, memberChecks = 0, ceilingChecks = 0;
  let pageCalls = 0, actorActive = failure !== 'revoked-first', lockChecks = 0;
  const controller = new AbortController();
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
      if (failure === 'revoke' && pageCalls === 1) actorActive = false;
      if (failure === 'demote' && pageCalls === 1) currentRole = 'manager';
      if (failure === 'ceiling-demote' && pageCalls === 1) ceiling = 'member';
      if (failure === 'abort' && pageCalls === 1) controller.abort();
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
  prisma.$transaction = async (run, options) => { assert.equal(options.isolationLevel, 'ReadCommitted'); return run(prisma); };
  prisma.$queryRaw = async () => { lockChecks++; return [{id:'member-1'}]; };
  prisma.sfaMember = {findFirst:async ({where, select}) => {
    memberChecks++;
    assert.equal(where.id, 'member-1'); assert.equal(where.userId, 'actor-1'); assert.equal(where.organizationId, 'org-1'); assert.equal(where.status, 'ACTIVE');
    if (!actorActive || !where.role.in.includes(currentRole)) return null;
    return select.role ? {role: currentRole} : {id:'member-1'};
  }};
  const authority = load('src/lib/sfa/mutation-authority.ts', {});
  const { GET } = load('src/app/api/sfa/export/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/export-policy': load('src/lib/sfa/export-policy.ts'),
    '@/lib/company-roles/access.server': {ceilToolRole: async input => {
      ceilingChecks++; assert.equal(input.tool,'sfa'); assert.equal(input.userId,'actor-1'); assert.equal(input.organizationId,'org-1'); assert.equal(input.toolRole,currentRole);
      if (failure === 'ceiling-denied') return null;
      if (failure === 'ceiling-error') throw new Error('private-secret');
      return ceiling || input.toolRole;
    }},
    '@/lib/sfa/mutation-authority': authority,
    '@/lib/sfa/access': { getSfaContext: async () => { if (failure === 'context') throw new Error('private-secret'); return failure === 'guest' ? null : { organizationId: 'org-1', userId:'actor-1', memberId:'member-1', role:initialRole }; }, orgSlugFrom: () => null },
  }, { TextEncoder, ReadableStream });
  return { GET: () => GET({ url: `http://local/api/sfa/export?type=${type}`, signal: controller.signal }), getPageCalls: () => pageCalls, getLockChecks: () => lockChecks, getMemberChecks: () => memberChecks, getCeilingChecks: () => ceilingChecks };
}

(async () => {
  for (const type of ['accounts', 'deals']) {
    const f = fixture(type, 5001);
    const response = await f.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.match(response.headers.get('vary'), /Cookie/);
    assert.match(response.headers.get('content-disposition'), /sfa_(accounts|deals)\.csv/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [239, 187, 191], 'UTF-8 BOM is present');
    const csv = new TextDecoder().decode(bytes);
    assert.equal(csv.trimEnd().split('\r\n').length, 5002, `${type} exports header plus all 5001 records`);
    assert(!csv.includes('foreign-secret'));
    assert(csv.includes("'=unsafe"), 'Formula-like input remains escaped');
    assert(csv.includes("' \t=unsafe"), 'Whitespace before a formula is also escaped');
    if (type === 'deals') {
      assert(csv.includes('9007199254740993'), 'Large yen amount stays exact');
      assert(csv.includes('取引先'));
      assert(csv.includes('商談中'));
    }
    assert.equal(f.getPageCalls(), 11);
    assert.equal(f.getLockChecks(), 12, "Boundary and every batch require fresh authority");
  }
  for (const type of ['accounts', 'deals']) {
    const firstFailure = fixture(type, 501, 'first');
    assert.equal((await firstFailure.GET()).status, 503, 'First-page failure is not a successful CSV');
    const laterFailure = fixture(type, 501, 'later');
    const response = await laterFailure.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.match(response.headers.get('vary'), /Cookie/);
    await assert.rejects(response.text(), /CSV出力を完了できませんでした/, 'Later failure aborts the download');
  }
  for (const type of ['accounts', 'deals']) {
    const revoked = fixture(type, 501, 'revoke');
    const response = await revoked.GET();
    assert.equal(response.status, 200);
    await assert.rejects(response.text(), /CSV出力を完了できませんでした/);
    assert.equal(revoked.getPageCalls(), 1, 'Revocation stops before second private page read');
    const initial = fixture(type, 501, 'revoked-first');
    assert.equal((await initial.GET()).status, 403);
    assert.equal(initial.getPageCalls(), 0);
    const aborted = fixture(type, 501, 'abort');
    assert.equal((await aborted.GET()).status, 503);
    assert.equal(aborted.getPageCalls(), 1);
    const cancelled = fixture(type, 2001);
    const download = await cancelled.GET();
    await download.body.cancel();
    const pages = cancelled.getPageCalls();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(cancelled.getPageCalls(), pages, 'Cancelled stream does not read future pages');
  }
  for (const [failure, status] of [['guest', 401], ['context', 503]]) {
    const response = await fixture('accounts', 1, failure).GET();
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.match(response.headers.get('vary'), /Cookie/);
    assert(!(await response.text()).includes('private-secret'));
  }
  for (const type of ['accounts','deals']) {
    for (const role of ['owner','admin']) {
      const allowed = fixture(type, 1, null, role);
      const response = await allowed.GET(); assert.equal(response.status,200); await response.text();
      assert.equal(allowed.getCeilingChecks(),2); console.log('PASS SFA CSV role: '+type+' '+role+' allowed');
    }
    for (const role of ['manager','member','ADMIN','unknown',null,undefined,{},'toString']) {
      const f = fixture(type,1,null,role === undefined ? '' : role);
      const r=await f.GET(); assert.equal(r.status,403); assert.match(r.headers.get('cache-control'),/private.*no-store/); assert.equal(r.headers.get('vary'),'Cookie');
      assert.equal(f.getPageCalls(),0); assert.equal(f.getLockChecks(),0); assert.equal(f.getMemberChecks(),0);
    }
    console.log('PASS SFA CSV role: '+type+' lower and malformed roles denied before database access');
    for (const role of ['member','manager','unknown']) {
      const f=fixture(type,1,null,'admin',role); assert.equal((await f.GET()).status,403); assert.equal(f.getPageCalls(),0);
    }
    console.log('PASS SFA CSV role: '+type+' stale context cannot grant elevated access');
    for (const failure of ['demote','ceiling-demote']) {
      const f=fixture(type,501,failure); const r=await f.GET(); assert.equal(r.status,200);
      await assert.rejects(r.text(),/CSV出力を完了できませんでした/); assert.equal(f.getPageCalls(),1);
      console.log('PASS SFA CSV role: '+type+' '+failure+' aborts before next page');
    }
    for (const [failure,status] of [['ceiling-denied',403],['ceiling-error',503]]) {
      const f=fixture(type,1,failure); const r=await f.GET(); assert.equal(r.status,status); assert.equal(f.getPageCalls(),0); assert(!(await r.text()).includes('private-secret'));
      console.log('PASS SFA CSV role: '+type+' '+failure+' fails closed');
    }
  }
  const empty = await fixture('accounts', 0).GET();
  assert.equal((await empty.text()).trimEnd().split('\r\n').length, 1);
  console.log('PASS SFA CSV: 5001 accounts and deals exported, tenant scope and exact yen preserved, failures do not return completed CSV');
})().catch((error) => { console.error(error); process.exitCode = 1; });
