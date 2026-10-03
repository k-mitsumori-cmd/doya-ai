const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const tokenHelpers = load('src/lib/kintai/invite-token.ts', {}, { crypto: require('node:crypto').webcrypto });
const manager = load('src/lib/kintai/manager-admission.ts');

function fixture({ status = 'PENDING', isActive = true, member = true, race = false, actorRole = 'hr_admin', actorStatus = 'ACTIVE', actorActive = true } = {}) {
  const row = { id: 'employee', organizationId: 'org', name: 'Test', email: 'test@example.com', isActive,
    member: member ? { id: 'member', status, inviteToken: 'old-token' } : null };
  let sends = 0;
  let updates = 0;
  const prisma = {
    $transaction: async work => work(prisma),
    $queryRaw: async () => [{ role: actorRole, status: actorStatus, isActive: actorActive }],
    kintaiEmployee: { findFirst: async () => row },
    kintaiMember: { updateMany: async ({ where, data }) => {
      updates++;
      assert.equal(where.organizationId, 'org');
      assert.equal(where.status, status);
      assert.equal(where.inviteToken, 'old-token');
      assert.equal(data.status, 'PENDING');
      if (race) return { count: 0 };
      row.member.inviteToken = data.inviteToken;
      row.member.status = data.status;
      return { count: 1 };
    } },
    kintaiOrganization: { findUnique: async () => ({ name: 'Org' }) },
  };
  const route = load('src/app/api/kintai/employees/[id]/invite/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/prisma': { prisma },
    '@/lib/html-escape': { escapeHtml: (value) => value },
    '@/lib/kintai/access': { getKintaiContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'actor-member', role: 'hr_admin' }), hasMinRole: () => true },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => {} },
    '@/lib/kintai/manager-admission': manager,
    '@/lib/email': { sendEmail: async () => { sends++; return { success: true }; } },
    '@/lib/kintai/invite-token': tokenHelpers,
  });
  return { post: () => route.POST({}, { params: Promise.resolve({ id: 'employee' }) }), row, get sends() { return sends; }, get updates() { return updates; } };
}

(async () => {
  for (const options of [{ status: 'ACTIVE' }, { isActive: false }, { member: false }]) {
    const f = fixture(options);
    assert.equal((await f.post()).status, 409);
    assert.equal(f.updates, 0);
    assert.equal(f.sends, 0);
  }
  const race = fixture({ race: true });
  assert.equal((await race.post()).status, 409);
  assert.equal(race.sends, 0);
  const pending = fixture();
  const response = await pending.post();
  assert.equal(response.status, 200);
  assert.equal(pending.sends, 1);
  assert.equal(tokenHelpers.isKintaiInviteExpired(pending.row.member.inviteToken, new Date(Date.now() - 72 * 60 * 60 * 1000)), false);
  const inactive = fixture({ status: 'INACTIVE' });
  assert.equal((await inactive.post()).status, 200);
  assert.equal(inactive.row.member.status, 'PENDING');
  assert.equal(inactive.sends, 1);
  for (const options of [{ actorRole: 'employee' }, { actorStatus: 'INACTIVE' }, { actorActive: false }]) {
    const revoked = fixture(options);
    assert.equal((await revoked.post()).status, 403);
    assert.equal(revoked.updates, 0);
    assert.equal(revoked.sends, 0);
  }
  console.log('PASS Kintai issuance: active guard, inactive reactivation, race guard, renewed expiry, mock delivery');
})().catch((error) => { console.error(error); process.exitCode = 1; });
