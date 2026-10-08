const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const base = 'docs/audits/2026-10-06-all-services-recheck/';
const routes = ['/api/hr/dashboard', '/api/hr/organization', '/api/hr/settings', '/api/kintai/dashboard'];
(async () => {
  const origin = process.env.DOYA_E2E_ORIGIN, url = new URL(process.env.DATABASE_URL);
  assert.match(origin || '', /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(url.searchParams.get('host') || '', /^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);
  assert.equal(url.port, '56481');
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  const cases = [], tokens = {};
  const domainSnapshot = async () => Promise.all(['hrOrganization', 'hrOrganizationMember', 'hrEmployee', 'kintaiOrganization', 'kintaiMember', 'kintaiEmployee', 'kintaiClockRecord', 'kintaiAttendance', 'kintaiRequest'].map(model => db[model].findMany({ orderBy: { id: 'asc' } })));
  try {
    const connection = await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');
    assert.equal(connection[0].address, null); assert.equal(connection[0].role, 'doya_sfa');
    for (const actor of ['A', 'B']) {
      const userId = 'synthetic-cache-user-' + actor, token = crypto.randomUUID(); tokens[actor] = token;
      await db.user.create({ data: { id: userId, email: 'cache-' + actor.toLowerCase() + '@example.invalid', name: 'SYNTHETIC_CACHE_' + actor, role: 'USER', plan: 'FREE', firstLoginAt: new Date() } });
      await db.session.create({ data: { sessionToken: token, userId, expires: new Date(Date.now() + 86400000) } });
      await db.hrOrganization.create({ data: { id: 'synthetic-hr-' + actor, name: 'SYNTHETIC_CACHE_' + actor, slug: 'synthetic-cache-' + actor.toLowerCase(), members: { create: { userId, role: 'MEMBER', status: 'ACTIVE' } } } });
      await db.kintaiOrganization.create({ data: { id: 'synthetic-kintai-' + actor, name: 'SYNTHETIC_CACHE_' + actor, slug: 'synthetic-cache-' + actor.toLowerCase(), members: { create: { userId, role: 'employee', status: 'ACTIVE', employee: { create: { organizationId: 'synthetic-kintai-' + actor, name: 'SYNTHETIC_CACHE_' + actor, email: 'cache-' + actor.toLowerCase() + '@example.invalid' } } } } } });
    }
    await db.user.create({ data: { id: 'synthetic-cache-hidden', email: 'cache-hidden@example.invalid', name: 'SYNTHETIC_HIDDEN_MEMBER', plan: 'FREE' } });
    await db.hrOrganizationMember.create({ data: { organizationId: 'synthetic-hr-A', userId: 'synthetic-cache-hidden', role: 'MEMBER', status: 'ACTIVE' } });
    const before = await domainSnapshot();
    async function get(path, actor, expected) {
      const headers = actor ? { Cookie: 'next-auth.session-token=' + tokens[actor] } : {};
      const response = await fetch(origin + path + '?org=synthetic-other-organization', { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const text = await response.text(); assert.ok(text.length < 32768);
      assert.equal(response.status, expected, path + ' ' + actor);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.ok((response.headers.get('vary') || '').split(',').some(x => x.trim().toLowerCase() === 'cookie'));
      const body = JSON.parse(text);
      if (expected === 200) {
        assert.ok(text.includes('SYNTHETIC_CACHE_' + actor));
        assert.equal(text.includes('SYNTHETIC_CACHE_' + (actor === 'A' ? 'B' : 'A')), false);
        if (path === '/api/hr/settings') {
          assert.equal(body.members.length, 1); assert.equal(body.myRole, 'MEMBER');
          assert.equal(text.includes('SYNTHETIC_HIDDEN_MEMBER'), false);
        }
      } else assert.ok(body.error && !text.includes('SYNTHETIC_CACHE_'));
      cases.push({ path, actor: actor || 'anonymous', status: expected, privateNoStore: true, varyCookie: true, passed: true });
    }
    for (const path of routes) await get(path, null, 401);
    for (const actor of ['A', 'B']) for (const path of routes) await get(path, actor, 200);
    await db.session.delete({ where: { sessionToken: tokens.A } });
    for (const path of routes) await get(path, 'A', 401);
    assert.deepEqual(await domainSnapshot(), before);
    cases.push({ name: 'GET preserves all organization, member, employee, clock, attendance and request rows', passed: true });
    const files = ['src/app/api/hr/dashboard/route.ts', 'src/app/api/hr/organization/route.ts', 'src/app/api/hr/settings/route.ts', 'src/app/api/kintai/dashboard/route.ts', 'src/lib/private-api-response.ts', 'src/lib/hr/access.ts', 'src/lib/kintai/access.ts', 'src/lib/auth.ts', 'prisma/schema.prisma', base + 'verify-personalized-cache-next.cjs', base + 'personalized-cache-next-supervise.py'];
    const report = { checkedAt: new Date().toISOString(), expected: 17, passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), scope: 'Actual built Next/auth/Prisma GET requests against isolated Unix-only PostgreSQL with two synthetic users and organizations plus hidden member. Anonymous, cross-actor sequential reads, member filtering, expired session and complete domain-row snapshot checks. No production data, real provider, external network or production OAuth/browser cache execution.' };
    fs.writeFileSync(base + 'personalized-cache-next-results.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await db.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
