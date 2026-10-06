const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');
const start = Date.parse('2026-10-06T00:00:00Z'), expiry = start + 1000;
const day = 24 * 60 * 60 * 1000;
function clockFixture() {
  let now = start;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  return { Clock, set: value => { now = value; }, now: () => now };
}
function promane({ stage = 'lookup', offset = 0, role = 'member' } = {}) {
  const c = clockFixture(); let writes = 0;
  const tx = {
    promaneMember: { findUnique: async () => ({ isActive: true, role: 'admin' }), findFirst: async () => null,
      count: async () => { if (stage === 'active') c.set(expiry + offset); return 1; } },
    promaneWorkspace: { findUnique: async () => ({ name: 'Team', userId: 'owner' }) },
    promaneInvitation: {
      findFirst: async ({ where }) => {
        const row = expiry > where.expiresAt.gt.getTime() ? { token: 'old-token', role, expiresAt: new Date(expiry) } : null;
        if (stage === 'lookup') c.set(expiry + offset);
        return row;
      },
      count: async ({ where }) => { assert.equal(where.expiresAt.gt.getTime(), c.now()); return expiry > where.expiresAt.gt.getTime() ? 1 : 0; },
      create: async ({ data }) => { writes++; assert.equal(data.role, 'member'); return { token: data.token, expiresAt: data.expiresAt }; },
    },
  };
  const helper = load('src/lib/promane/invite-admission.ts', {
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } }, crypto: require('node:crypto'),
    '@/lib/prisma': { prisma: { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); } } },
    '@/lib/promane/limits': { getUserPromaneLimits: async (owner, db) => { assert.equal(owner, 'owner'); assert.equal(db, tx); return { maxMembersPerWorkspace: 3 }; } },
  }, { Date: c.Clock });
  return { run: () => helper.issuePromaneInvitation({ workspaceId: 'ws', userId: 'admin', email: 'qa@example.invalid', role: 'member' }), now: c.now, writes: () => writes };
}
function hr({ offset = 0, delayCreation = false } = {}) {
  const c = clockFixture(); let writes = 0, deliveries = 0, audits = 0, deliveredExpiry;
  const tx = {
    $queryRaw: async () => [{ id: 'org' }], hrOrganizationMember: { findFirst: async () => null },
    hrInvitation: {
      findFirst: async ({ where }) => { const row = expiry > where.expiresAt.gt.getTime() ? { id: 'old', expiresAt: new Date(expiry) } : null; c.set(expiry + offset); return row; },
      create: async ({ data }) => { writes++; return { id: 'new', ...data }; },
    },
    hrOrganization: { findUnique: async () => { if (delayCreation) c.set(expiry + 5000); return { name: 'Team' }; } },
  };
  const api = load('src/app/api/hr/organization/invite/route.ts', {
    'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: 'admin' } }) }, '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', memberId: 'actor', userId: 'admin', role: 'ADMIN' }), hasMinRole: () => true },
    '@/lib/hr/types': { HrMemberRole: { MEMBER: 'MEMBER', ADMIN: 'ADMIN', OWNER: 'OWNER' } }, '@/lib/hr/billing': { checkMemberLimit: async () => null },
    '@/lib/hr/email': { sendInvitationEmail: async args => { deliveries++; deliveredExpiry = args.expiresAt.getTime(); return false; } },
    '@/lib/hr/audit': { logAudit: async () => { audits++; } }, crypto: require('node:crypto'),
  }, { Date: c.Clock });
  return { run: () => api.POST({ json: async () => ({ email: 'qa@example.invalid' }) }), now: c.now, state: () => ({ writes, deliveries, audits, deliveredExpiry }) };
}
(async () => {
  for (const stage of ['active', 'lookup']) {
    await check(`Promane expiry before/exact/after ${stage} wait never reuses an expired token`, async () => {
      for (const offset of [-1, 0, 1]) {
        const f = promane({ stage, offset }), result = await f.run();
        assert.equal(result.success, true); assert.equal(result.reused, offset < 0); assert.equal(f.writes(), offset < 0 ? 0 : 1);
        assert.ok(result.invitation.expiresAt.getTime() > f.now());
        if (offset >= 0) { assert.notEqual(result.invitation.token, 'old-token'); assert.equal(result.invitation.expiresAt.getTime(), f.now() + 30 * day); }
      }
    });
  }
  await check('Promane expired different-role invite no longer blocks reissue; valid conflicting role remains rejected', async () => {
    const expired = promane({ role: 'guest', offset: 0 }); assert.equal((await expired.run()).reused, false); assert.equal(expired.writes(), 1);
    const valid = promane({ role: 'guest', offset: -1 }); assert.equal((await valid.run()).response.code, 'PROMANE_INVITE_ROLE_CONFLICT'); assert.equal(valid.writes(), 0);
  });
  await check('HR expiry before/exact/after read wait distinguishes valid duplicates from expired invitations', async () => {
    for (const offset of [-1, 0, 1]) {
      const f = hr({ offset }), response = await f.run(), body = await response.json();
      assert.equal(response.status, offset < 0 ? 400 : 200);
      assert.equal(f.state().writes, offset < 0 ? 0 : 1); assert.equal(f.state().deliveries, offset < 0 ? 0 : 1);
      if (offset >= 0) { assert.equal(body.emailSent, false); assert.equal(Date.parse(body.invitation.expiresAt), f.now() + 7 * day); }
    }
  });
  await check('HR newly issued expiry and email payload use creation time after organization lookup', async () => {
    const f = hr({ delayCreation: true }), response = await f.run(), body = await response.json();
    assert.equal(response.status, 200); assert.equal(Date.parse(body.invitation.expiresAt), f.now() + 7 * day);
    assert.equal(f.state().deliveredExpiry, Date.parse(body.invitation.expiresAt)); assert.equal(f.state().audits, 1);
  });
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual issuance code; synthetic DB/auth/clock/email only', results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
