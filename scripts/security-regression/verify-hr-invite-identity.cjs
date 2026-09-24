const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

async function acceptCase({ signedIn = true, accountEmail = 'invited@example.com', inviteRole = 'MEMBER', status = 'PENDING', claimCount = 1, memberCount = 1 } = {}) {
  let created = 0;
  let claims = 0;
  let locks = 0;
  let expiredWrites = 0;
  const invitation = {
    id: 'invite-1', token: 'opaque-token', organizationId: 'org-1', email: 'Invited@Example.com',
    role: inviteRole, status, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(),
    organization: { id: 'org-1', name: 'Example' },
  };
  const prisma = {
    hrInvitation: {
      findUnique: async () => invitation,
      updateMany: async () => { expiredWrites++; return { count: 1 }; },
    },
    user: { findUnique: async () => ({ email: accountEmail }) },
    hrOrganizationMember: { findFirst: async () => null },
    $transaction: async (fn) => fn({
      $queryRaw: async () => { locks++; return [{ id: 'org-1' }]; },
      hrInvitation: { updateMany: async ({ where }) => {
        claims++;
        assert.equal(where.status, 'PENDING');
        assert.equal(where.id, invitation.id);
        return { count: claimCount };
      } },
      hrOrganizationMember: { count: async () => memberCount, create: async ({ data }) => {
        created++;
        assert.equal(data.userId, 'user-1');
        assert.equal(data.role, 'MEMBER');
        return { id: 'member-1' };
      } },
    }),
  };
  const { POST } = load('src/app/api/hr/organization/invite/accept/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => signedIn ? { user: { id: 'user-1', name: 'Invited' } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/hr/audit': { logAudit: async () => {} },
    '@/lib/hr/billing': { getOrgPlan: async () => 'FREE', getOrgPlanLimits: () => ({ maxMembers: 2 }) },
  });
  const response = await POST({ json: async () => ({ token: invitation.token }) });
  return { status: response.status, body: await response.json(), created, claims, locks, expiredWrites };
}

(async () => {
  let r = await acceptCase({ signedIn: false });
  assert.equal(r.status, 401);
  assert.equal(r.created, 0);

  r = await acceptCase({ accountEmail: 'other@example.com' });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'INVITE_EMAIL_MISMATCH');
  assert.equal(r.claims, 0);
  assert.equal(r.created, 0);

  r = await acceptCase({ inviteRole: 'OWNER' });
  assert.equal(r.status, 403);
  assert.equal(r.created, 0);

  r = await acceptCase({ status: 'ACCEPTED' });
  assert.equal(r.status, 400);
  assert.equal(r.created, 0);

  r = await acceptCase({ claimCount: 0 });
  assert.equal(r.status, 409);
  assert.equal(r.created, 0);

  r = await acceptCase({ memberCount: 2 });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'HR_ORG_MEMBER_LIMIT');
  assert.equal(r.locks, 1);
  assert.equal(r.claims, 0, 'A full organization must not consume the invitation');
  assert.equal(r.created, 0);

  r = await acceptCase();
  assert.equal(r.status, 200);
  assert.equal(r.created, 1);
  assert.equal(r.claims, 1);
  assert.equal(r.locks, 1);

  let sent = 0;
  let createdRole;
  const { POST } = load('src/app/api/hr/organization/invite/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'admin-1', name: 'Admin' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      hrOrganizationMember: { findFirst: async () => null },
      hrInvitation: { findFirst: async () => null, create: async ({ data }) => {
        createdRole = data.role;
        return { ...data, id: 'invite-2' };
      } },
      hrOrganization: { findUnique: async () => ({ name: 'Example' }) },
    } },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org-1', userId: 'admin-1', role: 'ADMIN' }), hasMinRole: () => true },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' } },
    '@/lib/hr/billing': { checkMemberLimit: async () => null },
    '@/lib/hr/email': { sendInvitationEmail: async () => { sent++; } },
    '@/lib/hr/audit': { logAudit: async () => {} },
    crypto: require('node:crypto'),
  }, { process: { env: { NEXTAUTH_URL: 'https://example.com' } } });
  const response = await POST({ json: async () => ({ email: 'Invited@Example.com', role: 'OWNER' }) });
  assert.equal(response.status, 200);
  assert.equal(createdRole, 'MEMBER');
  assert.equal(sent, 1, 'Only the mocked sender is called; no external email is sent');
  const badEmail = await POST({ json: async () => ({ email: 'not-an-address', role: 'OWNER' }) });
  assert.equal(badEmail.status, 400);
  assert.equal(sent, 1);
  for (const [role, plan, expectedField] of [
    ['OWNER', 'FREE', 'upgradeUrl'],
    ['ADMIN', 'PRO', 'contactUrl'],
  ]) {
    const limited = load('src/app/api/hr/organization/invite/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'owner-1' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: {} },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org-1', userId: 'owner-1', role }), hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } },
      '@/lib/hr/billing': { checkMemberLimit: async () => 'メンバー枠の上限です', getOrgPlan: async () => plan },
      '@/lib/hr/email': { sendInvitationEmail: async () => { throw Error('email must not be sent') } },
      '@/lib/hr/audit': { logAudit: async () => {} },
      crypto: require('node:crypto'),
    });
    const denied = await limited.POST({ json: async () => ({ email: 'invited@example.com' }) });
    assert.equal(denied.status, 403);
    const payload = await denied.json();
    assert.equal(payload.code, 'HR_ORG_MEMBER_LIMIT');
    assert.ok(payload[expectedField]);
    assert.equal(payload.canManageBilling, role === 'OWNER');
  }
  console.log('PASS HR invitation: matching account required, old elevated role rejected, atomic claim, role injection ignored');
})().catch((error) => { console.error(error); process.exitCode = 1; });
