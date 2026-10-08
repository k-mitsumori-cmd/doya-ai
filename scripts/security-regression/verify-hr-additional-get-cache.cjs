const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const helper = process.env.DOYA_TEST_BASELINE || fs.existsSync('src/lib/private-api-response.ts') ? load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } }) : null;
const files = ['src/app/api/hr/organization/route.ts', 'src/app/api/hr/settings/route.ts'];
const cases = [];
function fixture(file, mode) {
  const queries = [];
  const context = async () => {
    if (mode === 'failure') throw Error('SYNTHETIC_PRIVATE_ERROR');
    return mode === 'denied' ? null : { organizationId: 'org-synthetic', userId: 'user-synthetic', memberId: 'member-synthetic', role: 'MEMBER' };
  };
  const read = value => async args => { queries.push(args); return value; };
  const roles = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' };
  const api = load(file, {
    'next/server': { NextResponse: Response },
    '@/lib/private-api-response': helper,
    'next-auth': { getServerSession: async () => { const ctx = await context(); return ctx ? { user: { id: ctx.userId } } : null; } },
    '@prisma/client': { Prisma: { DbNull: null } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/hr/types': { HrMemberRole: roles },
    '@/lib/hr/access': { getHrContext: context, getOrCreateOrganization: () => { throw Error('Writes forbidden'); }, hasMinRole: () => false },
    '@/lib/prisma': { prisma: {
      hrOrganization: { findUnique: read({ id: 'org-synthetic', name: 'SYNTHETIC_PRIVATE_ORGANIZATION' }) },
      hrOrganizationMember: { findMany: read(file.includes('/settings/') ? [{ id: 'member-synthetic', role: 'MEMBER', employeeId: 'employee-synthetic', user: { name: 'SYNTHETIC_PRIVATE_MEMBER', email: 'synthetic@example.invalid', image: null }, createdAt: new Date('2026-01-01') }] : [{ id: 'member-synthetic', role: 'MEMBER', organization: { id: 'org-synthetic', name: 'SYNTHETIC_PRIVATE_ORGANIZATION' } }]) },
    } },
  });
  return { api, queries };
}
(async () => {
  for (const file of files) for (const mode of ['allowed', 'denied', 'failure']) {
    const c = { file, mode, behaviorPassed: false, privateNoStore: false };
    try {
      const f = fixture(file, mode), r = await f.api.GET(), body = await r.json();
      assert.equal(r.status, mode === 'allowed' ? 200 : mode === 'denied' ? 401 : 500);
      assert.equal(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_ERROR'), false);
      if (mode === 'allowed') {
        assert.ok(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_'));
        if (file.includes('/settings/')) {
          assert.equal(f.queries[0].where.id, 'org-synthetic');
          assert.equal(f.queries[1].where.organizationId, 'org-synthetic');
          assert.equal(f.queries[1].where.id, 'member-synthetic');
        } else {
          assert.equal(f.queries[0].where.userId, 'user-synthetic');
          assert.equal(f.queries[0].where.status, 'ACTIVE');
          assert.deepEqual(Array.from(f.queries[0].where.role.in), ['OWNER', 'ADMIN', 'MEMBER']);
        }
      } else assert.equal(f.queries.length, 0);
      c.behaviorPassed = true;
      assert.ok((r.headers.get('cache-control') || '').split(',').map(x => x.trim().toLowerCase()).includes('no-store'), 'Personalized GET must prohibit cache storage');
      assert.ok((r.headers.get('vary') || '').split(',').some(x => x.trim().toLowerCase() === 'cookie'));
      c.privateNoStore = true;
    } catch (e) { c.error = e.message; }
    cases.push(c);
  }
  const report = { checkedAt: new Date().toISOString(), expected: 6, behaviorPassed: cases.filter(x => x.behaviorPassed).length, passed: cases.filter(x => x.privateNoStore).length, cases, sourceHashes: Object.fromEntries([...files, ...(helper ? ['src/lib/private-api-response.ts'] : [])].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE ? require('node:path').join(process.env.DOYA_TEST_BASELINE, f) : f)).digest('hex')])), scope: 'Actual HR organization/settings GET handlers; synthetic auth and DB read boundaries. Read scope and non-admin member filter checked. No customer/production requests, writes or cache leakage demonstrated. Current-source cache policy probe; overlay results are not production verification.' };
  fs.writeFileSync(require('node:path').resolve(__dirname, '../../docs/audits/2026-10-06-all-services-recheck') + '/hr-additional-get-cache-' + (process.env.DOYA_TEST_BASELINE ? 'overlay' : helper ? 'integrated' : 'baseline') + '.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  process.exitCode = report.passed === report.expected ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
